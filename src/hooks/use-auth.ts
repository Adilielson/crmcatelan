import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { readLocalSession } from '@/lib/local-session';
import { User, Tenant } from '../types/database.types';

/** Promise com timeout — getSession() pode travar para sempre (navigator.locks). */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | 'timeout'> {
  return Promise.race([
    p,
    new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), ms)),
  ]);
}

export const DEV_TENANT_ID = '00000000-0000-0000-0000-000000000001';

interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setTenant: (tenant: Tenant | null) => void;
  logout: () => Promise<void>;
  initialize: () => void;
}

let _initialized = false;
let _loadingUserId: string | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  tenant: null,
  loading: true,
  setUser: (user) => set({ user }),
  setTenant: (tenant) => set({ tenant }),

  logout: async () => {
    await supabase.auth.signOut();
    _loadingUserId = null;
    try { localStorage.removeItem('crm_profile_cache_v1'); } catch { /* ignore */ }
    set({ user: null, tenant: null });
  },

  initialize: () => {
    if (_initialized) return;
    _initialized = true;

    // Safety net 100% SÍNCRONA: nunca deixa o spinner infinito.
    // IMPORTANTE: não pode usar getSession() aqui — se o lock de auth do
    // navegador estiver travado (causa raiz do loop após F5), getSession()
    // nunca resolve e a própria rede de segurança ficaria pendurada.
    setTimeout(() => {
      if (!get().loading) return;
      console.warn('[auth] ⏱️ timeout de inicialização — aplicando fallback local');
      const local = readLocalSession();
      if (local && !get().user) {
        set({ user: buildFallbackUser(local.userId, local.email), loading: false });
      } else {
        set({ loading: false });
      }
    }, 6000);

    // getSession() com timeout: se travar, usa a sessão lida do localStorage.
    withTimeout(supabase.auth.getSession(), 4000).then((res) => {
      if (res === 'timeout') {
        console.warn('[auth] ⚠️ getSession() travou — usando sessão do localStorage');
        const local = readLocalSession();
        if (local && !get().user) {
          set({ user: buildFallbackUser(local.userId, local.email), loading: false });
          // Tenta carregar o perfil real em paralelo (pode destravar depois).
          setTimeout(() => loadProfile(local.userId, local.email, set, get), 0);
        } else if (!get().user) {
          set({ loading: false });
        }
        return;
      }
      const session = res.data.session;
      if (session?.user) {
        if (get().user?.id !== session.user.id && _loadingUserId !== session.user.id) {
          loadProfile(session.user.id, session.user.email ?? '', set, get);
        }
      } else {
        set({ loading: false });
      }
    }).catch((e) => {
      console.error('[auth] getSession falhou', e);
      set({ loading: false });
    });

    supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user) {
        // Só limpa o estado em SIGNED_OUT explícito. Eventos com sessão nula
        // transitória (ex.: INITIAL_SESSION durante hidratação) não devem
        // derrubar um user já carregado.
        if (event === 'SIGNED_OUT') {
          _loadingUserId = null;
          set({ user: null, tenant: null, loading: false });
        } else if (!get().user) {
          set({ loading: false });
        }
        return;
      }
      // Dedup: se já carregamos esse user, ignora (TOKEN_REFRESHED, INITIAL_SESSION etc.)
      const currentId = get().user?.id;
      if (currentId === session.user.id || _loadingUserId === session.user.id) return;
      // Marca loading para o guard do layout não redirecionar para /login
      // durante a janela entre SIGNED_IN e o profile carregado.
      set({ loading: true });
      const uid = session.user.id;
      const email = session.user.email ?? '';
      // IMPORTANTE: nunca fazer await de queries Supabase DENTRO do callback
      // do onAuthStateChange — isso deadlocka o auto-refresh do token e causa
      // logout "do nada". Deferimos para o próximo tick.
      setTimeout(() => loadProfile(uid, email, set, get), 0);
    });
  },
}));

const PROFILE_CACHE_KEY = 'crm_profile_cache_v1';

function readProfileCache(userId: string): User | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as User;
    // só usa o cache se for do MESMO usuário — nunca herda role de outra conta
    if (cached?.id !== userId) return null;
    return cached;
  } catch {
    return null;
  }
}

function writeProfileCache(user: User) {
  try {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(user));
  } catch {
    /* ignore */
  }
}

export function buildFallbackUser(userId: string, email: string): User {
  // Usa o último perfil conhecido deste usuário (role/tenant reais) em vez de
  // assumir 'seller' — isso evitava que admins perdessem o menu após um F5
  // quando o carregamento do perfil falhava transitoriamente.
  const cached = readProfileCache(userId);
  if (cached) return { ...cached, email: email || cached.email };
  return {
    id: userId,
    email,
    name: email || 'Usuário',
    role: 'seller',
    tenant_id: DEV_TENANT_ID,
    avatar_url: null,
  };
}

async function loadProfile(
  userId: string,
  email: string,
  set: (partial: Partial<AuthState>) => void,
  get: () => AuthState,
) {
  _loadingUserId = userId;
  try {
    // 1 round-trip: profile + tenant via join.
    // IMPORTANTE: NÃO usar `tenants(*)` — a tabela `tenants` tem GRANT por
    // colunas (token/CNPJ ficam protegidos). Selecionar apenas colunas seguras.
    const { data, error } = await supabase
      .from('profiles')
      .select('id, tenant_id, full_name, role, status, tenants(id, name, slug, plan, status, logo_url, created_at, updated_at, settings)')
      .eq('id', userId)
      .single();

    if (error || !data) {
      // Falha transitória (rede, rebuild do sandbox) NÃO pode derrubar a
      // sessão. Mantém o user logado com dados mínimos e tenta de novo.
      console.warn('[auth] loadProfile falhou — mantendo sessão com fallback', error?.message);
      if (!get().user) {
        set({ user: buildFallbackUser(userId, email), loading: false });
      } else {
        set({ loading: false });
      }
      // Retry silencioso em 5s para recuperar role/tenant reais.
      setTimeout(() => {
        if (get().user?.id === userId) loadProfile(userId, email, set, get);
      }, 5000);
      return;
    }

    const profile = data as any;
    const user: User = {
      id: profile.id,
      email,
      name: profile.full_name || email,
      role: profile.role,
      tenant_id: profile.tenant_id,
      avatar_url: profile.avatar_url || null,
    };

    const tenant = (profile.tenants as Tenant | null) ?? null;

    writeProfileCache(user);
    set({ user, tenant, loading: false });
  } catch (e) {
    console.error('[auth] loadProfile EXCEÇÃO', e);
    if (!get().user) {
      set({ user: buildFallbackUser(userId, email), loading: false });
    } else {
      set({ loading: false });
    }
  } finally {
    _loadingUserId = null;
  }
}

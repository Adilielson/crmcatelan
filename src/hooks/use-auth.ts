import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { User, Tenant } from '../types/database.types';

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
    set({ user: null, tenant: null });
  },

  initialize: () => {
    if (_initialized) return;
    _initialized = true;

    // Safety net: nunca deixa o spinner infinito — se em 10s o auth não
    // resolver (rede, rebuild do servidor, sessão corrompida), libera a UI.
    setTimeout(() => {
      if (get().loading) {
        console.warn('[auth] ⏱️ timeout de inicialização — forçando loading=false');
        set({ loading: false });
      }
    }, 10000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadProfile(session.user.id, session.user.email ?? '', set, get);
      } else {
        set({ loading: false });
      }
    }).catch((e) => {
      console.error('[auth] getSession falhou', e);
      set({ loading: false });
    });

    supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user) {
        _loadingUserId = null;
        set({ user: null, tenant: null, loading: false });
        return;
      }
      // Dedup: se já carregamos esse user, ignora (TOKEN_REFRESHED, INITIAL_SESSION etc.)
      const currentId = get().user?.id;
      if (currentId === session.user.id || _loadingUserId === session.user.id) return;
      loadProfile(session.user.id, session.user.email ?? '', set, get);
    });
  },
}));

async function loadProfile(
  userId: string,
  email: string,
  set: (partial: Partial<AuthState>) => void,
  get: () => AuthState,
) {
  _loadingUserId = userId;
  try {
    // 1 round-trip: profile + tenant via join
    const { data, error } = await supabase
      .from('profiles')
      .select('id, tenant_id, full_name, role, status, tenants(*)')
      .eq('id', userId)
      .single();

    if (error || !data) {
      console.warn('[auth] loadProfile sem profile', error?.message);
      set({ loading: false });
      return;
    }

    const profile = data as any;
    const user: User = {
      id: profile.id,
      email,
      name: profile.full_name || email,
      role: profile.role,
      tenant_id: profile.tenant_id,
    };

    const tenant = (profile.tenants as Tenant | null) ?? null;

    set({ user, tenant, loading: false });
  } catch (e) {
    console.error('[auth] loadProfile EXCEÇÃO', e);
    set({ loading: false });
  } finally {
    _loadingUserId = null;
  }
}

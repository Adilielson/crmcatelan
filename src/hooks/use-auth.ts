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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tenant: null,
  loading: true,
  setUser: (user) => set({ user }),
  setTenant: (tenant) => set({ tenant }),

  logout: async () => {
    console.log('[auth] 🔻 logout() chamado');
    await supabase.auth.signOut();
    set({ user: null, tenant: null });
  },

  initialize: () => {
    console.log('[auth] 🟡 initialize() — chamando getSession()');
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('[auth] 🟢 getSession resolvido', {
        hasSession: !!session,
        userId: session?.user?.id ?? null,
        email: session?.user?.email ?? null,
        error: error?.message ?? null,
      });
      if (session?.user) {
        loadProfile(session.user.id, set);
      } else {
        console.log('[auth] ⚪ sem sessão → loading=false');
        set({ loading: false });
      }
    });

    supabase.auth.onAuthStateChange((event, session) => {
      console.log('[auth] 🔔 onAuthStateChange', {
        event,
        hasSession: !!session,
        userId: session?.user?.id ?? null,
        email: session?.user?.email ?? null,
      });
      if (session?.user) {
        loadProfile(session.user.id, set);
      } else {
        set({ user: null, tenant: null, loading: false });
      }
    });
  },
}));

async function loadProfile(userId: string, set: (partial: Partial<AuthState>) => void) {
  console.log('[auth] ▶️ loadProfile início', { userId });
  try {
    const [profileRes, authRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.auth.getUser(),
    ]);

    console.log('[auth] 📄 query profiles', {
      hasData: !!profileRes.data,
      error: profileRes.error?.message ?? null,
      errorCode: profileRes.error?.code ?? null,
      errorDetails: profileRes.error?.details ?? null,
      errorHint: profileRes.error?.hint ?? null,
    });
    console.log('[auth] 👤 auth.getUser', {
      hasUser: !!authRes.data.user,
      email: authRes.data.user?.email ?? null,
      error: authRes.error?.message ?? null,
    });

    const profile = profileRes.data as {
      id: string; tenant_id: string; full_name: string | null;
      role: User['role']; status: string;
    } | null;
    const authUser = authRes.data.user;

    if (!profile || !authUser) {
      console.warn('[auth] ⛔ loadProfile ABORTOU — profile ou authUser ausente', {
        hasProfile: !!profile,
        hasAuthUser: !!authUser,
        profileError: profileRes.error?.message ?? null,
      });
      set({ loading: false });
      return;
    }

    const user: User = {
      id: profile.id,
      email: authUser.email || '',
      name: profile.full_name || authUser.email || '',
      role: profile.role,
      tenant_id: profile.tenant_id,
    };
    console.log('[auth] ✅ user montado', user);

    if (profile.role === 'super_admin') {
      console.log('[auth] 👑 super_admin — set sem tenant');
      set({ user, tenant: null, loading: false });
      return;
    }

    console.log('[auth] 🏢 buscando tenant', { tenant_id: profile.tenant_id });
    const { data: tenantData, error: tenantErr } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', profile.tenant_id)
      .single();

    console.log('[auth] 🏢 tenant resultado', {
      hasTenant: !!tenantData,
      tenantName: (tenantData as Tenant | null)?.name ?? null,
      error: tenantErr?.message ?? null,
      errorCode: tenantErr?.code ?? null,
    });

    set({ user, tenant: (tenantData as Tenant | null) ?? null, loading: false });
    console.log('[auth] 🎉 loadProfile FINALIZADO com sucesso');
  } catch (e) {
    console.error('[auth] 💥 loadProfile EXCEÇÃO', e);
    set({ loading: false });
  }
}

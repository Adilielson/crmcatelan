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
    await supabase.auth.signOut();
    set({ user: null, tenant: null });
  },

  initialize: () => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadProfile(session.user.id, set);
      } else {
        set({ loading: false });
      }
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadProfile(session.user.id, set);
      } else {
        set({ user: null, tenant: null, loading: false });
      }
    });
  },
}));

async function loadProfile(userId: string, set: (partial: Partial<AuthState>) => void) {
  try {
    const [profileRes, authRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.auth.getUser(),
    ]);

    const profile = profileRes.data as {
      id: string; tenant_id: string; full_name: string | null;
      role: User['role']; status: string;
    } | null;
    const authUser = authRes.data.user;

    if (!profile || !authUser) {
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

    if (profile.role === 'super_admin') {
      set({ user, tenant: null, loading: false });
      return;
    }

    const { data: tenantData } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', profile.tenant_id)
      .single();

    set({ user, tenant: (tenantData as Tenant | null) ?? null, loading: false });
  } catch {
    set({ loading: false });
  }
}

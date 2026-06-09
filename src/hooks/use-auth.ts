import { create } from 'zustand';
import { User, Tenant } from '../types/database.types';

interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  setUser: (user: User | null) => void;
  setTenant: (tenant: Tenant | null) => void;
  logout: () => void;
}

export const DEV_TENANT_ID = '00000000-0000-0000-0000-000000000001';

export const useAuthStore = create<AuthState>((set) => ({
  user: {
    id: '1',
    email: 'agencia@marketing.com',
    name: 'Agência Performance',
    role: 'marketing_partner',
    tenant_id: DEV_TENANT_ID,
  },
  tenant: {
    id: DEV_TENANT_ID,
    name: 'Ótica Catelan Matriz',
    slug: 'catelan-matriz',
    status: 'active',
    plan: 'pro',
    settings: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  setUser: (user: User | null) => set({ user }),
  setTenant: (tenant: Tenant | null) => set({ tenant }),
  logout: () => set({ user: null, tenant: null }),
}));

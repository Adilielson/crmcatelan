import { create } from 'zustand';
import { User, Tenant } from '../types/database.types';

interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  setUser: (user: User | null) => void;
  setTenant: (tenant: Tenant | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: {
    id: '1',
    email: 'admin@castelar.com',
    name: 'Admin Castelar',
    role: 'admin',
    tenant_id: 'tenant-1'
  },
  tenant: {
    id: 'tenant-1',
    name: 'Ótica Castelar Matriz',
    slug: 'castelar-matriz',
    status: 'active',
    plan: 'pro',
    settings: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  setUser: (user: User | null) => set({ user }),
  setTenant: (tenant: Tenant | null) => set({ tenant }),
  logout: () => set({ user: null, tenant: null }),
}));

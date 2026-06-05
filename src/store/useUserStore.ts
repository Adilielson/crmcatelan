import { create } from 'zustand';

interface User {
  id: string;
  full_name: string;
  email: string;
  role: 'admin' | 'manager' | 'seller';
  status: 'active' | 'pending' | 'inactive';
  units: string[];
}

interface UserStore {
  users: User[];
  addUser: (user: Omit<User, 'id'>) => void;
  updateUser: (id: string, updates: Partial<User>) => void;
  deleteUser: (id: string) => void;
}

export const useUserStore = create<UserStore>((set) => ({
  users: [
    {
      id: '1',
      full_name: 'Admin Principal',
      email: 'admin@castelar.com',
      role: 'admin',
      status: 'active',
      units: ['Unidade Matriz'],
    },
    {
      id: '2',
      full_name: 'Gerente Comercial',
      email: 'gerente@castelar.com',
      role: 'manager',
      status: 'active',
      units: ['Unidade Sul'],
    },
  ],
  addUser: (user) => set((state) => ({
    users: [...state.users, { ...user, id: Math.random().toString(36).substr(2, 9) }]
  })),
  updateUser: (id, updates) => set((state) => ({
    users: state.users.map(u => u.id === id ? { ...u, ...updates } : u)
  })),
  deleteUser: (id) => set((state) => ({
    users: state.users.filter(u => u.id !== id)
  })),
}));

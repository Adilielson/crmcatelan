import { create } from 'zustand'

export type Notification = {
  id: string
  title: string
  message: string
  category: 'ai_training' | 'performance' | 'system_error' | 'lead_alert'
  read_at: string | null
  created_at: string
  link?: string
}

interface NotificationStore {
  notifications: Notification[]
  addNotification: (notification: Omit<Notification, 'id' | 'created_at' | 'read_at'>) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [
    {
      id: '1',
      title: 'Treinamento Concluído',
      message: 'O novo modelo de comportamento da IA está pronto para teste.',
      category: 'ai_training',
      read_at: null,
      created_at: new Date().toISOString(),
      link: '/settings/ai-training'
    },
    {
      id: '2',
      title: 'Alerta de Performance',
      message: 'A taxa de No-Show da Unidade Sul ultrapassou 20%.',
      category: 'performance',
      read_at: null,
      created_at: new Date(Date.now() - 3600000).toISOString(),
      link: '/analytics/no-show'
    }
  ],
  addNotification: (n) => set((state) => ({
    notifications: [
      {
        ...n,
        id: Math.random().toString(36).substring(7),
        created_at: new Date().toISOString(),
        read_at: null
      },
      ...state.notifications
    ]
  })),
  markAsRead: (id) => set((state) => ({
    notifications: state.notifications.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n)
  })),
  markAllAsRead: () => set((state) => ({
    notifications: state.notifications.map(n => ({ ...n, read_at: new Date().toISOString() }))
  }))
}))

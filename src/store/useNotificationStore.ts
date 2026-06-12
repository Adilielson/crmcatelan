import { create } from 'zustand'
import { supabase } from '@/integrations/supabase/client'

export type Notification = {
  id: string
  title: string
  message: string
  category: 'ai_training' | 'performance' | 'system_error' | 'lead_alert' | 'sla_warning' | 'webhook_event' | 'chat_update'
  read_at: string | null
  created_at: string
  link?: string | null
}

interface NotificationStore {
  notifications: Notification[]
  hydrated: boolean
  setNotifications: (n: Notification[]) => void
  upsertNotification: (n: Notification) => void
  addNotification: (notification: Omit<Notification, 'id' | 'created_at' | 'read_at'>) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
}

const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  hydrated: false,

  setNotifications: (n) => set({ notifications: n, hydrated: true }),

  upsertNotification: (n) => set((state) => {
    if (state.notifications.some(x => x.id === n.id)) return state
    return { notifications: [n, ...state.notifications] }
  }),

  addNotification: (n) => set((state) => ({
    notifications: [
      {
        ...n,
        id: Math.random().toString(36).substring(7),
        created_at: new Date().toISOString(),
        read_at: null,
      },
      ...state.notifications,
    ],
  })),

  markAsRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map(n =>
        n.id === id ? { ...n, read_at: new Date().toISOString() } : n
      ),
    }))
    if (isUuid(id)) {
      void supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
    }
  },

  markAllAsRead: () => {
    const now = new Date().toISOString()
    const ids = get().notifications.filter(n => !n.read_at && isUuid(n.id)).map(n => n.id)
    set((state) => ({
      notifications: state.notifications.map(n => ({ ...n, read_at: n.read_at ?? now })),
    }))
    if (ids.length) {
      void supabase.from('notifications').update({ read_at: now }).in('id', ids)
    }
  },
}))

import { create } from 'zustand'

export interface ChatSession {
  id: string
  name: string
  lastMessage: string
  time: string
  unread: number
  status: 'online' | 'offline'
  leadId?: string
}

interface ChatState {
  sessions: ChatSession[]
  selectedSessionId: string | null
  setSelectedSession: (id: string | null) => void
  addSession: (session: ChatSession) => void
}

export const useChatStore = create<ChatState>((set) => ({
  sessions: [
    { id: '1', name: 'João Silva', lastMessage: 'Olá, gostaria de saber mais...', time: '10:30', unread: 2, status: 'online' },
    { id: '2', name: 'Maria Souza', lastMessage: 'Pode agendar para amanhã?', time: '09:15', unread: 0, status: 'offline' },
  ],
  selectedSessionId: '1',
  setSelectedSession: (id) => set({ selectedSessionId: id }),
  addSession: (session) => set((state) => ({ sessions: [...state.sessions, session] })),
}))

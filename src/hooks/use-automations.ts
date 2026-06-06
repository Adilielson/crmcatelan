import { create } from 'zustand'

export interface AutomationRule {
  id: string
  columnName: string
  slaHours: number
  notifyManager: boolean
  notifyAgent: boolean
}

export interface WebhookConfig {
  id: string
  name: string
  url: string
  event: 'lead_qualified' | 'appointment_scheduled' | 'sale_closed'
  active: boolean
}

interface AutomationState {
  rules: AutomationRule[]
  webhooks: WebhookConfig[]
  abandonmentThreshold: number // horas para leads de alta prioridade
  updateRule: (id: string, updates: Partial<AutomationRule>) => void
  addWebhook: (webhook: Omit<WebhookConfig, 'id'>) => void
  updateWebhook: (id: string, updates: Partial<WebhookConfig>) => void
  setAbandonmentThreshold: (hours: number) => void
}

export const useAutomations = create<AutomationState>((set) => ({
  rules: [
    { id: '1', columnName: 'Leads Prontos', slaHours: 2, notifyManager: true, notifyAgent: true },
    { id: '2', columnName: 'Em Atendimento', slaHours: 24, notifyManager: true, notifyAgent: false },
    { id: '3', columnName: 'Agendado', slaHours: 48, notifyManager: false, notifyAgent: true },
  ],
  webhooks: [
    { id: 'w1', name: 'Facebook Conversions API', url: 'https://graph.facebook.com/v19.0/...', event: 'appointment_scheduled', active: true },
    { id: 'w2', name: 'Agência Marketing Webhook', url: 'https://agency-api.com/leads', event: 'lead_qualified', active: true },
  ],
  abandonmentThreshold: 4,
  updateRule: (id, updates) => set(state => ({
    rules: state.rules.map(r => r.id === id ? { ...r, ...updates } : r)
  })),
  addWebhook: (w) => set(state => ({
    webhooks: [...state.webhooks, { ...w, id: Math.random().toString(36).substr(2, 9) }]
  })),
  updateWebhook: (id, updates) => set(state => ({
    webhooks: state.webhooks.map(w => w.id === id ? { ...w, ...updates } : w)
  })),
  setAbandonmentThreshold: (hours) => set({ abandonmentThreshold: hours }),
}))

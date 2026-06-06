import { create } from 'zustand'
import { useKanban } from './use-kanban'
import { useNotificationStore } from '@/store/useNotificationStore'
import { useAutomations } from './use-automations'


export type AppointmentStatus = 'pendente' | 'confirmado' | 'realizado' | 'no-show' | 'cancelado'
export type AppointmentOrigin = 'manual' | 'automatizado_ia' | 'link_externo'

export interface Appointment {
  id: string
  leadId: string
  leadName: string
  date: string
  startTime: string
  endTime: string
  status: AppointmentStatus
  examType: string
  medicalNotes?: string
  reminderSent: boolean
  professionalId: string
  unit: string
  origin: AppointmentOrigin
  value: number
  cancellationReason?: string
  confirmationUrl?: string
  propensityScore: number
  notificationChannel: 'whatsapp' | 'sms' | 'email'
  rescheduleCount: number
  checkinAt?: string
  checkoutAt?: string
  roomId?: string
  needsTransport: boolean
  customField?: string
}

interface AgendaState {
  appointments: Appointment[]
  workingHours: {
    start: string
    end: string
    lunchStart: string
    lunchEnd: string
  }
  addAppointment: (appointment: Omit<Appointment, 'id'>) => boolean
  updateAppointment: (id: string, updates: Partial<Appointment>) => void
  deleteAppointment: (id: string) => void
  checkConflict: (date: string, start: string, end: string, excludeId?: string) => boolean
}

export const useAgenda = create<AgendaState>((set, get) => ({
  appointments: [
    {
      id: '1',
      leadId: '1',
      leadName: 'João Silva',
      date: '2026-06-15',
      startTime: '14:00',
      endTime: '15:00',
      status: 'confirmado',
      examType: 'Exame de Vista Completo',
      reminderSent: true,
      professionalId: 'dr-claudio',
      unit: 'Loja Centro',
      origin: 'manual',
      value: 150,
      propensityScore: 0.95,
      notificationChannel: 'whatsapp',
      rescheduleCount: 0,
      needsTransport: false,
    }
  ],
  workingHours: {
    start: '08:00',
    end: '18:00',
    lunchStart: '12:00',
    lunchEnd: '13:00',
  },
  checkConflict: (date, start, end, excludeId) => {
    const { appointments } = get()
    return appointments.some(appt => 
      appt.id !== excludeId &&
      appt.date === date &&
      appt.status !== 'cancelado' &&
      ((start >= appt.startTime && start < appt.endTime) ||
       (end > appt.startTime && end <= appt.endTime) ||
       (start <= appt.startTime && end >= appt.endTime))
    )
  },
  addAppointment: (data) => {
    if (get().checkConflict(data.date, data.startTime, data.endTime)) {
      return false
    }
    
    const id = Math.random().toString(36).substr(2, 9)
    const newAppt = { ...data, id }
    
    set(state => ({ appointments: [...state.appointments, newAppt] }))
    
    // Regra de Negócio: Mover para "Agendado" no Kanban
    const { updateLead } = useKanban.getState()
    updateLead(data.leadId, { status: 'Agendado', scheduledAt: `${data.date}T${data.startTime}` })
    
    // Automação: Webhook para Facebook Conversion API
    const { webhooks } = useAutomations.getState()
    const fbWebhook = webhooks.find(w => w.event === 'appointment_scheduled' && w.active)
    if (fbWebhook) {
      console.log(`[Webhook] Enviando evento '${fbWebhook.event}' para ${fbWebhook.url}`)
      useNotificationStore.getState().addNotification({
        title: 'Webhook Enviado',
        message: `Evento de agendamento disparado para ${fbWebhook.name}.`,
        category: 'webhook_event'
      })
    }

    return true

  },
  updateAppointment: (id, updates) => {
    const { appointments } = get()
    const current = appointments.find(a => a.id === id)
    if (!current) return

    // Se mudar data/hora, verificar conflito
    if (updates.date || updates.startTime || updates.endTime) {
      const date = updates.date || current.date
      const start = updates.startTime || current.startTime
      const end = updates.endTime || current.endTime
      if (get().checkConflict(date, start, end, id)) {
        return
      }
    }

    set(state => ({
      appointments: state.appointments.map(a => a.id === id ? { ...a, ...updates } : a)
    }))

    // Regras de Negócio baseadas em Status
    if (updates.status === 'realizado') {
      const { updateLead } = useKanban.getState()
      updateLead(current.leadId, { status: 'Pós-Venda' })
    }
    
    if (updates.status === 'no-show') {
       useNotificationStore.getState().addNotification({
         title: 'Alerta de No-show',
         message: `Follow-up necessário para ${current.leadName} (atraso > 15min).`,
         category: 'lead_alert'
       })
    }
  },
  deleteAppointment: (id) => set(state => ({
    appointments: state.appointments.filter(a => a.id !== id)
  }))
}))

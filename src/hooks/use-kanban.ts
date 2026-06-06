import { create } from 'zustand'

export type LeadSource = 'whatsapp' | 'instagram' | 'google' | 'direct'

export interface Lead {
  id: string
  name: string
  value: number
  source: LeadSource
  status: string
  pipelineId: string
  isUrgent?: boolean
  lossReason?: string
  scheduledAt?: string
  createdAt: string
}

export interface Pipeline {
  id: string
  name: string
  columns: string[]
}

interface KanbanState {
  pipelines: Pipeline[]
  currentPipelineId: string
  leads: Lead[]
  addLead: (lead: Omit<Lead, 'id' | 'createdAt'>) => void
  moveLead: (leadId: string, newStatus: string) => void
  updateLead: (leadId: string, updates: Partial<Lead>) => void
  setCurrentPipeline: (id: string) => void
}

export const useKanban = create<KanbanState>((set) => ({
  pipelines: [
    { id: 'p1', name: 'Vendas Unidade Sul', columns: ['Leads Prontos', 'Em Atendimento', 'Agendado', 'Perdido'] },
    { id: 'p2', name: 'Vendas Unidade Norte', columns: ['Leads Prontos', 'Em Atendimento', 'Agendado', 'Perdido'] },
  ],
  currentPipelineId: 'p1',
  leads: [
    { 
      id: '1', 
      name: 'João Silva', 
      value: 2500, 
      source: 'whatsapp', 
      status: 'Leads Prontos', 
      pipelineId: 'p1', 
      isUrgent: true,
      createdAt: new Date().toISOString() 
    },
    { 
      id: '2', 
      name: 'Maria Souza', 
      value: 4200, 
      source: 'instagram', 
      status: 'Em Atendimento', 
      pipelineId: 'p1', 
      createdAt: new Date().toISOString() 
    },
  ],
  addLead: (lead) => set((state) => ({
    leads: [...state.leads, { ...lead, id: Math.random().toString(36).substr(2, 9), createdAt: new Date().toISOString() }]
  })),
  moveLead: (leadId, newStatus) => set((state) => ({
    leads: state.leads.map(l => l.id === leadId ? { ...l, status: newStatus } : l)
  })),
  updateLead: (leadId, updates) => set((state) => ({
    leads: state.leads.map(l => l.id === leadId ? { ...l, ...updates } : l)
  })),
  setCurrentPipeline: (id) => set({ currentPipelineId: id }),
}))

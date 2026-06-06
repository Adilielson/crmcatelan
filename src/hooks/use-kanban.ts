import { create } from 'zustand'

export type LeadSource = 'whatsapp' | 'instagram' | 'google' | 'direct'
export type IAStatus = 'aguardando' | 'processando' | 'qualificado' | 'desqualificado'
export type IAUrgencia = 'baixa' | 'media' | 'alta'
export type IASentimento = 'positivo' | 'neutro' | 'negativo'
export type IAPerfil = 'analitico' | 'pragmatico' | 'expressivo' | 'afavel'

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
  // Campos IA SDR
  ia_score?: number // 0-100
  ia_status?: IAStatus
  ia_resumo?: string
  ia_motivo_desqualificacao?: string
  ia_sugestao_proximo_passo?: string
  ia_interesses?: string[]
  ia_urgencia?: IAUrgencia
  ia_sentimento?: IASentimento
  ia_perfil?: IAPerfil
  ia_tokens_uso?: number
  ia_pergunta_chave_respondida?: boolean
  ia_probabilidade_comparecimento?: number
  ia_tags?: string[]
  ia_receita_validade?: string
  ia_receita_grau?: string
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
      ia_status: 'qualificado',
      ia_score: 85,
      ia_urgencia: 'alta',
      ia_sentimento: 'positivo',
      ia_interesses: ['Lentes Multifocais', 'Armação Titanium'],
      ia_resumo: 'O lead possui receita recente e busca lentes de alta tecnologia.',
      ia_tags: ['Lead VIP', 'Pronto para Atendimento'],
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

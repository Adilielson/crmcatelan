/** @jsxImportSource react */
import React, { useState } from 'react'

import { useKanban, Lead } from '@/hooks/use-kanban'
import { useAgenda } from '@/hooks/use-agenda'
import { Calendar, MessageSquare, MapPin, DollarSign, MessageCircle, MoreVertical, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useNotificationStore } from '@/store/useNotificationStore'


// Manual Instagram icon to avoid import issues
const InstagramIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
)

export function KanbanBoard() {
  const { pipelines, currentPipelineId, setCurrentPipeline, leads, moveLead, updateLead } = useKanban()
  const { addNotification } = useNotificationStore()
  const currentPipeline = pipelines.find(p => p.id === currentPipelineId) || pipelines[0]

  
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [modalType, setModalType] = useState<'schedule' | 'loss' | null>(null)
  const [scheduleData, setScheduleData] = useState({ date: '', time: '' })
  const [lossReason, setLossReason] = useState('')

  const handleMove = (leadId: string, newStatus: string) => {
    const lead = leads.find(l => l.id === leadId)
    if (!lead) return

    if (newStatus === 'Agendado') {
      setSelectedLead(lead)
      setModalType('schedule')
    } else if (newStatus === 'Perdido') {
      setSelectedLead(lead)
      setModalType('loss')
    } else {
      moveLead(leadId, newStatus)
      toast.success(`Lead movido para ${newStatus}`)
      addNotification({
        title: 'Movimentação de Lead',
        message: `${lead.name} foi movido para ${newStatus}.`,
        category: 'lead_alert'
      })
    }
  }


  const confirmSchedule = () => {
    if (selectedLead && scheduleData.date && scheduleData.time) {
      moveLead(selectedLead.id, 'Agendado')
      updateLead(selectedLead.id, { scheduledAt: `${scheduleData.date}T${scheduleData.time}` })
      setModalType(null)
      setSelectedLead(null)
      toast.success('Agendamento realizado com sucesso!')
    }
  }

  const confirmLoss = () => {
    if (selectedLead && lossReason) {
      moveLead(selectedLead.id, 'Perdido')
      updateLead(selectedLead.id, { lossReason })
      setModalType(null)
      setSelectedLead(null)
      toast.error('Lead marcado como perdido')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border shadow-sm">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-bold text-slate-800">Pipeline</h3>
          <Select value={currentPipelineId} onValueChange={setCurrentPipeline}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Selecionar Unidade" />
            </SelectTrigger>
            <SelectContent>
              {pipelines.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="relative">
            <AlertCircle className="w-4 h-4 mr-2" />
            Notificações
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
          </Button>
          <Button size="sm">Novo Lead</Button>
        </div>
      </div>

      <div className="flex gap-6 overflow-x-auto pb-6 scrollbar-hide">
        {currentPipeline.columns.map((column) => (
          <div key={column} className="min-w-[320px] flex-1 flex flex-col gap-4">
            <div className="flex justify-between items-center px-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700">{column}</span>
                <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-full border font-bold">
                  {leads.filter(l => l.status === column && l.pipelineId === currentPipelineId).length}
                </span>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="w-4 h-4 text-slate-400" />
              </Button>
            </div>
            
            <div 
              className="bg-slate-50/50 p-3 rounded-2xl border border-dashed border-slate-200 min-h-[600px] flex flex-col gap-3"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const id = e.dataTransfer.getData('leadId')
                handleMove(id, column)
              }}
            >
              {leads
                .filter(l => l.status === column && l.pipelineId === currentPipelineId)
                .map(lead => (
                  <LeadCard key={lead.id} lead={lead} onDragStart={(e) => e.dataTransfer.setData('leadId', lead.id)} />
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* Modal de Agendamento */}
      <Dialog open={modalType === 'schedule'} onOpenChange={() => setModalType(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Agendar Atendimento - {selectedLead?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="date">Data</Label>
              <Input id="date" type="date" value={scheduleData.date} onChange={e => setScheduleData(prev => ({ ...prev, date: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="time">Hora</Label>
              <Input id="time" type="time" value={scheduleData.time} onChange={e => setScheduleData(prev => ({ ...prev, time: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalType(null)}>Cancelar</Button>
            <Button onClick={confirmSchedule}>Confirmar Agendamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Perda */}
      <Dialog open={modalType === 'loss'} onOpenChange={() => setModalType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Motivo da Perda - {selectedLead?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Selecione o motivo principal</Label>
              <Select value={lossReason} onValueChange={setLossReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um motivo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="price">Preço alto</SelectItem>
                  <SelectItem value="competition">Fechou com concorrente</SelectItem>
                  <SelectItem value="no_response">Não responde mais</SelectItem>
                  <SelectItem value="bad_quality">Lead sem perfil (Qualidade)</SelectItem>
                  <SelectItem value="other">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalType(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmLoss}>Confirmar Perda</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function LeadCard({ lead, onDragStart }: { lead: Lead, onDragStart: (e: React.DragEvent) => void }) {
  const sourceIcons = {
    whatsapp: <MessageCircle className="w-4 h-4 text-green-500" />,
    instagram: <InstagramIcon className="text-pink-500" />,

    google: <MessageSquare className="w-4 h-4 text-blue-500" />,
    direct: <MessageSquare className="w-4 h-4 text-slate-500" />,
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={`bg-white p-4 rounded-xl border shadow-sm cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors group relative ${lead.isUrgent ? 'border-red-200' : 'border-slate-200'}`}
    >
      <AnimatePresence>
        {lead.isUrgent && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: [0.4, 1, 0.4],
              scale: [1, 1.02, 1]
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute inset-0 rounded-xl border-2 border-red-500 pointer-events-none"
          />
        )}
      </AnimatePresence>

      {lead.isUrgent && (
        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full z-10">
          URGENTE
        </div>
      )}

      
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className="font-bold text-sm text-slate-800 line-clamp-1">{lead.name}</h4>
          <span className="text-xs text-primary font-bold">R$ {lead.value.toLocaleString('pt-BR')}</span>
        </div>
        <div className="bg-slate-50 p-1.5 rounded-lg border group-hover:bg-primary/5 transition-colors">
          {sourceIcons[lead.source]}
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-primary transition-colors border border-transparent hover:border-slate-200" title="Agenda">
          <Calendar className="w-3.5 h-3.5" />
        </button>
        <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-primary transition-colors border border-transparent hover:border-slate-200" title="WhatsApp">
          <MessageSquare className="w-3.5 h-3.5" />
        </button>
        <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-primary transition-colors border border-transparent hover:border-slate-200" title="Localização">
          <MapPin className="w-3.5 h-3.5" />
        </button>
        <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-primary transition-colors border border-transparent hover:border-slate-200" title="Venda Fechada">
          <DollarSign className="w-3.5 h-3.5" />
        </button>
      </div>

      {lead.lossReason && (
        <div className="mt-2 pt-2 border-t text-[10px] text-red-500 font-medium">
          Perda: {lead.lossReason}
        </div>
      )}
      {lead.scheduledAt && (
        <div className="mt-2 pt-2 border-t text-[10px] text-blue-500 font-medium">
          Agendado: {new Date(lead.scheduledAt).toLocaleString('pt-BR')}
        </div>
      )}
    </div>
  )
}


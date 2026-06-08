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
import { cn } from '@/lib/utils'


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
  const { addAppointment } = useAgenda()
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
      // Calcular horário de fim (padrão 1h)
      const [hours, minutes] = scheduleData.time.split(':')
      const endHours = (parseInt(hours) + 1).toString().padStart(2, '0')
      const endTime = `${endHours}:${minutes}`

      const success = addAppointment({
        leadId: selectedLead.id,
        leadName: selectedLead.name,
        date: scheduleData.date,
        startTime: scheduleData.time,
        endTime: endTime,
        status: 'pendente',
        examType: 'Consulta Oftalmológica',
        reminderSent: false,
        professionalId: 'dr-claudio',
        unit: 'Loja Centro',
        origin: 'manual',
        value: 150,
        propensityScore: 0.85,
        notificationChannel: 'whatsapp',
        rescheduleCount: 0,
        needsTransport: false
      })

      if (success) {
        setModalType(null)
        setSelectedLead(null)
        toast.success('Agendamento realizado e lead movido!')
        console.log('API WhatsApp: Disparando template para', selectedLead.name)
      } else {
        toast.error('Conflito de horário na Agenda Mestre!')
      }
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-[#17171B] p-6 rounded-[14px] border border-[#23232B] shadow-sm gap-4">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex flex-col">
            <h3 className="text-sm font-black text-[#6C727C] uppercase tracking-[0.2em] font-jakarta">Fluxo de Vendas</h3>
            <p className="text-xs font-bold text-white mt-1">Gerencie seus leads e pipeline</p>
          </div>
          <Select value={currentPipelineId} onValueChange={setCurrentPipeline}>
            <SelectTrigger className="w-full md:w-[300px] h-11 bg-[#0E0E11] border-[#23232B] font-bold text-xs uppercase tracking-wider text-white rounded-[14px]">
              <SelectValue placeholder="Selecionar Unidade" />
            </SelectTrigger>
            <SelectContent className="bg-[#17171B] border-[#23232B] text-white">
              {pipelines.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" className="relative h-11 px-6 font-bold text-xs uppercase tracking-wider border-[#23232B] bg-[#17171B] text-white shadow-sm rounded-[14px] hover:bg-[#23232B]">
            <AlertCircle className="w-4 h-4 mr-2 text-[#FFC400]" />
            Notificações
            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-[#D64545] rounded-full border-2 border-[#17171B] animate-pulse" />
          </Button>
          <Button size="sm" className="h-11 px-8 font-black text-xs uppercase tracking-[0.1em] bg-[#FFC400] text-[#1a1500] hover:bg-[#FFD60A] shadow-md shadow-[#FFC400]/10 rounded-[14px]">Novo Lead</Button>
        </div>
      </div>

      <div className="flex gap-6 overflow-x-auto pb-8 scrollbar-hide -mx-4 px-4">
        {currentPipeline.columns.map((column, index) => (
          <div key={column} className="min-w-[340px] flex-1 flex flex-col gap-6">
            <div className={cn(
              "flex justify-between items-center px-4 py-3 rounded-t-[14px] border-b border-[#23232B]",
              index === 0 ? "bg-[#0E0E11]" : 
              index === 1 ? "bg-[#23232B]" :
              index === 2 ? "bg-[#474C55]" :
              index === 3 ? "bg-[#A7ADB8] text-[#1a1a1a]" :
              "bg-[#FFC400] text-[#1a1500]"
            )}>
              <div className="flex items-center gap-3">
                <span className="font-black uppercase tracking-widest text-[11px] font-jakarta">{column}</span>
                <span className={cn(
                  "text-[11px] px-2 py-0.5 rounded-full font-mono font-bold",
                  column === "Compareceu" ? "bg-[#1a1500]/10" : "bg-gray-50/50"
                )}>
                  {leads.filter(l => l.status === column && l.pipelineId === currentPipelineId).length}
                </span>
              </div>
              <Button variant="ghost" size="icon" className={cn(
                "h-8 w-8 rounded-lg",
                column === "Compareceu" ? "hover:bg-[#1a1500]/5 text-[#1a1500]" : "hover:bg-white/10 text-white"
              )}>
                <MoreVertical className="w-4 h-4" />
              </Button>
            </div>
            
            <div 
              className="bg-[#17171B]/30 p-3 rounded-b-[14px] border border-[#23232B] border-t-0 min-h-[600px] flex flex-col gap-3"


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
      className={cn(
        "bg-white p-5 rounded-[12px] border border-[#E3E6EB] shadow-sm cursor-grab active:cursor-grabbing hover:border-yellow/40 hover:shadow-md transition-all duration-300 group relative",
        lead.isUrgent ? 'border-danger/30' : ''
      )}
    >
      <AnimatePresence>
        {lead.isUrgent && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute inset-0 rounded-[12px] border-2 border-danger/40 pointer-events-none"
          />
        )}
      </AnimatePresence>

      {lead.isUrgent && (
        <div className="absolute -top-2 -right-2 bg-[#D64545] text-white text-[9px] font-black px-2 py-0.5 rounded-full z-10 shadow-sm shadow-[#D64545]/20">
          URGENTE
        </div>
      )}

      
      <div className="flex justify-between items-start mb-4">
        <div className="space-y-1">
          <h4 className={cn(
            "font-black text-[13px] line-clamp-1 uppercase tracking-tight font-jakarta",
            "text-ink"
          )}>{lead.name}</h4>
          <div className="flex items-center gap-1.5">
            <DollarSign className={cn(
              "w-3 h-3 opacity-60",
              "text-ink"
            )} />
            <span className={cn(
              "text-[12px] font-black",
              "text-ink"
            )}>R$ {lead.value.toLocaleString('pt-BR')}</span>
          </div>
        </div>
        <div className={cn(
          "p-2 rounded-[12px] border transition-colors",
          "bg-white border-[#E3E6EB]"
        )}>
          {sourceIcons[lead.source]}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-1">
        {[
          { icon: Calendar, title: "Agenda" },
          { icon: MessageSquare, title: "WhatsApp" },
          { icon: MapPin, title: "Localização" },
          { icon: DollarSign, title: "Venda Fechada" }
        ].map((action, i) => (
          <button 
            key={i}
            className={cn(
              "p-2.5 rounded-[12px] transition-all border",
              "bg-white text-gray-500 hover:text-ink border-[#E3E6EB] hover:border-gray-400"
            )} 

            title={action.title}
          >
            <action.icon className="w-3.5 h-3.5" />
          </button>
        ))}
      </div>

      {lead.lossReason && (
        <div className="mt-4 pt-3 border-t border-slate-100 text-[10px] text-red-500 font-bold uppercase tracking-wider flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
          Perda: {lead.lossReason}
        </div>
      )}
      {lead.scheduledAt && (
        <div className="mt-4 pt-3 border-t border-slate-100 text-[10px] text-blue-500 font-bold uppercase tracking-wider flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          Agendado: {new Date(lead.scheduledAt).toLocaleString('pt-BR')}
        </div>
      )}
    </div>
  )
}


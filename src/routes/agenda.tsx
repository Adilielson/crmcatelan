import { createFileRoute } from '@tanstack/react-router'
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  MoreVertical, 
  AlertCircle,
  Phone,
  MessageSquare,
  User,
  Search,
  Settings,
  XCircle,
  CheckCircle,
  History
} from 'lucide-react'
import { useState, useMemo } from 'react'
import { useAgenda, Appointment } from '@/hooks/use-agenda'
import { useKanban } from '@/hooks/use-kanban'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const Route = createFileRoute('/agenda')({
  component: Agenda,
})

function Agenda() {
  const { appointments, addAppointment, updateAppointment, workingHours } = useAgenda()
  const { leads } = useKanban()
  
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<'month' | 'day'>('month')
  const [selectedDay, setSelectedDay] = useState(new Date())
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  
  const [formData, setFormData] = useState({
    leadId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '09:00',
    endTime: '10:00',
    examType: 'Consulta Oftalmológica',
    unit: 'Loja Centro',
    professionalId: 'dr-claudio',
    notes: '',
    customField: ''
  })

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(monthStart)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  
  const calendarDays = useMemo(() => {
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  }, [calendarStart, calendarEnd])

  const dayAppointments = useMemo(() => {
    return appointments.filter(appt => isSameDay(new Date(appt.date + 'T00:00:00'), selectedDay))
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
  }, [appointments, selectedDay])

  const handleAddAppointment = () => {
    const lead = leads.find(l => l.id === formData.leadId)
    if (!lead) {
      toast.error('Selecione um lead válido')
      return
    }

    const success = addAppointment({
      leadId: lead.id,
      leadName: lead.name,
      date: formData.date,
      startTime: formData.startTime,
      endTime: formData.endTime,
      status: 'pendente',
      examType: formData.examType,
      medicalNotes: formData.notes,
      reminderSent: false,
      professionalId: formData.professionalId,
      unit: formData.unit,
      origin: 'manual',
      value: 150,
      propensityScore: 0.85,
      notificationChannel: 'whatsapp',
      rescheduleCount: 0,
      needsTransport: false,
      customField: formData.customField
    })

    if (success) {
      toast.success('Agendamento realizado com sucesso!')
      setIsModalOpen(false)
      // Simular disparo via API
      console.log('API WhatsApp: Disparando template de confirmação para', lead.name)
    } else {
      toast.error('Conflito de horário detectado!')
    }
  }

  const handleStatusChange = (id: string, status: Appointment['status']) => {
    updateAppointment(id, { status })
    toast.info(`Status alterado para ${status}`)
    
    if (status === 'confirmado') {
      console.log('API WhatsApp: Enviando confirmação de agendamento manual.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Agenda Mestre</h1>
          <p className="text-sm text-slate-500">Consultas Oftalmológicas e Atendimento Unificado</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button onClick={() => setIsModalOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Novo Agendamento
          </Button>
          <Button variant="outline" className="gap-2">
            <Settings className="w-4 h-4" /> Configurar Horários
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendário */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <h3 className="font-bold text-slate-800 capitalize">
                  {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
                </h3>
                <div className="flex border rounded-lg bg-white shadow-sm overflow-hidden">
                  <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 hover:bg-slate-50 border-r"><ChevronLeft className="w-4 h-4" /></button>
                  <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 hover:bg-slate-50"><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button 
                  onClick={() => setView('month')}
                  className={cn("px-3 py-1.5 text-xs font-bold rounded-md transition-all", view === 'month' ? "bg-white shadow-sm text-primary" : "text-slate-500")}
                >
                  Mês
                </button>
                <button 
                   onClick={() => setView('day')}
                  className={cn("px-3 py-1.5 text-xs font-bold rounded-md transition-all", view === 'day' ? "bg-white shadow-sm text-primary" : "text-slate-500")}
                >
                  Dia
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-7 border-b bg-slate-50/30">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                <div key={day} className="p-3 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {calendarDays.map((day, i) => {
                const isSelected = isSameDay(day, selectedDay)
                const isToday = isSameDay(day, new Date())
                const dayAppts = appointments.filter(a => isSameDay(new Date(a.date + 'T00:00:00'), day))
                const isCurrentMonth = format(day, 'MM') === format(currentDate, 'MM')

                return (
                  <div 
                    key={i} 
                    onClick={() => {
                      setSelectedDay(day)
                      setFormData(prev => ({ ...prev, date: format(day, 'yyyy-MM-dd') }))
                    }}
                    className={cn(
                      "h-28 border-r border-b p-2 transition-all cursor-pointer group relative overflow-hidden",
                      !isCurrentMonth ? "bg-slate-50/50" : "bg-white",
                      isSelected && "ring-2 ring-primary ring-inset z-10 bg-primary/5"
                    )}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={cn(
                        "text-xs font-bold h-6 w-6 flex items-center justify-center rounded-full",
                        isToday ? "bg-primary text-white" : "text-slate-500",
                        !isCurrentMonth && "opacity-30"
                      )}>
                        {format(day, 'd')}
                      </span>
                      {dayAppts.length > 0 && (
                        <Badge variant="secondary" className="text-[9px] h-4 px-1">{dayAppts.length}</Badge>
                      )}
                    </div>
                    <div className="space-y-1">
                      {dayAppts.slice(0, 2).map(appt => (
                        <div 
                          key={appt.id} 
                          className={cn(
                            "text-[9px] p-1 rounded border truncate font-bold flex items-center gap-1",
                            appt.status === 'confirmado' ? "bg-green-50 text-green-700 border-green-200" :
                            appt.status === 'pendente' ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                            "bg-slate-100 text-slate-600 border-slate-200"
                          )}
                        >
                          <Clock className="w-2.5 h-2.5" />
                          {appt.startTime} {appt.leadName}
                        </div>
                      ))}
                      {dayAppts.length > 2 && (
                        <div className="text-[8px] text-slate-400 text-center font-bold">+{dayAppts.length - 2} mais</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Detalhes do Dia Selecionado */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white border rounded-xl shadow-sm p-4 flex flex-col h-full min-h-[600px]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-800 text-sm">
                Compromissos - {format(selectedDay, "dd 'de' MMM", { locale: ptBR })}
              </h3>
              <Badge variant="outline">{dayAppointments.length}</Badge>
            </div>
            
            <div className="flex-1 space-y-4 overflow-y-auto pr-2">
              {dayAppointments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-slate-400 border border-dashed rounded-xl">
                  <CalendarIcon className="w-8 h-8 mb-2 opacity-20" />
                  <p className="text-xs">Nenhum agendamento</p>
                </div>
              ) : (
                dayAppointments.map(appt => (
                  <div key={appt.id} className="bg-white border rounded-xl p-3 shadow-sm hover:border-primary/50 transition-all group">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <div className="bg-slate-100 p-1.5 rounded-lg">
                          <User className="w-4 h-4 text-slate-500" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-800">{appt.leadName}</h4>
                          <span className="text-[10px] text-slate-500">{appt.examType}</span>
                        </div>
                      </div>
                      <div className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {appt.startTime}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <Badge className="text-[9px] h-4" variant={appt.status === 'confirmado' ? 'default' : 'secondary'}>
                        {appt.status.toUpperCase()}
                      </Badge>
                      {appt.propensityScore > 0.8 && (
                        <Badge variant="outline" className="text-[9px] h-4 bg-green-50 text-green-700 border-green-200">
                          Alta Propensão
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 text-[10px] font-bold"
                        onClick={() => handleStatusChange(appt.id, 'confirmado')}
                        disabled={appt.status === 'confirmado'}
                      >
                        <CheckCircle className="w-3 h-3 mr-1 text-green-500" /> Confirmar
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-[10px] font-bold">
                        <MessageSquare className="w-3 h-3 mr-1 text-blue-500" /> WhatsApp
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 mt-auto">
               <div className="bg-primary/5 border border-primary/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-primary" />
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Multiatendimento</h4>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed italic">
                  "Agende múltiplos profissionais para o mesmo lead se necessário. O sistema validará a disponibilidade mestre."
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Novo Agendamento */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Novo Agendamento Oftalmológico</DialogTitle>
            <DialogDescription>Preencha os dados do lead e selecione o horário disponível na agenda mestre.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Lead</Label>
                <Select value={formData.leadId} onValueChange={(v) => setFormData({...formData, leadId: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar Lead" />
                  </SelectTrigger>
                  <SelectContent>
                    {leads.map(lead => (
                      <SelectItem key={lead.id} value={lead.id}>{lead.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unidade</Label>
                <Select value={formData.unit} onValueChange={(v) => setFormData({...formData, unit: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Loja Centro">Loja Centro</SelectItem>
                    <SelectItem value="Loja Shopping">Loja Shopping</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Início</Label>
                <Input type="time" value={formData.startTime} onChange={(e) => setFormData({...formData, startTime: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Fim</Label>
                <Input type="time" value={formData.endTime} onChange={(e) => setFormData({...formData, endTime: e.target.value})} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Exame / Consulta</Label>
              <Input value={formData.examType} onChange={(e) => setFormData({...formData, examType: e.target.value})} />
            </div>

            <div className="space-y-2">
              <Label>Campo Customizável (Informações Adicionais)</Label>
              <Input placeholder="Convênio, indicações, etc." value={formData.customField} onChange={(e) => setFormData({...formData, customField: e.target.value})} />
            </div>

            <div className="space-y-2">
              <Label>Observações Médicas</Label>
              <Textarea placeholder="Histórico breve ou queixas..." value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddAppointment}>Confirmar e Enviar WhatsApp</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

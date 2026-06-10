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
import { useLeads } from '@/hooks/use-leads'
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
  const { data: leads = [] } = useLeads()

  
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

  const handleAddAppointment = async () => {
    const lead = leads.find(l => l.id === formData.leadId)
    if (!lead) {
      toast.error('Selecione um lead válido')
      return
    }

    const success = await addAppointment({
      leadId: lead.id,
      leadName: lead.full_name,
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
      console.log('API WhatsApp: Disparando template de confirmação para', lead.full_name)
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
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 bg-white p-10 rounded-[24px] border border-[#E3E6EB] shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full -mr-24 -mt-24 blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-1 rounded-full bg-primary" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Agenda Mestre Integrada</span>
          </div>
          <h1 className="text-[36px] font-black text-ink tracking-tight font-jakarta leading-none mb-3">Gestão de Consultas</h1>
          <p className="text-[15px] text-gray-500 font-medium">Controle centralizado de agendamentos com sincronização em tempo real via WhatsApp.</p>
        </div>
        <div className="flex gap-4 relative z-10">
          <Button onClick={() => setIsModalOpen(true)} className="gap-3 bg-primary hover:bg-yellow-bright text-[#1a1500] font-black text-[11px] h-14 px-8 rounded-[16px] shadow-xl shadow-primary/20 transition-all hover:scale-[1.05] uppercase tracking-widest border-none">
            <Plus className="w-5 h-5" /> NOVO AGENDAMENTO
          </Button>
          <Button variant="outline" className="gap-3 bg-white border-[#E3E6EB] text-[#A7ADB8] hover:text-ink hover:bg-[#F6F7F9] font-black text-[11px] h-14 px-8 rounded-[16px] transition-all uppercase tracking-widest">
            <Settings className="w-5 h-5" /> CONFIGURAÇÕES
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendário */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white border border-[#E3E6EB] rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden">
            <div className="p-8 border-b border-[#E3E6EB] flex items-center justify-between bg-white">
              <div className="flex items-center gap-6">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-[#A7ADB8] uppercase tracking-[0.2em] leading-none mb-1">Mês de Referência</span>
                  <h3 className="font-black text-xl text-ink capitalize tracking-tight">
                    {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
                  </h3>
                </div>
                <div className="flex border border-[#E3E6EB] rounded-[14px] bg-[#F6F7F9] p-1 shadow-inner">
                  <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2.5 hover:bg-white hover:shadow-sm rounded-[10px] text-[#A7ADB8] hover:text-ink transition-all"><ChevronLeft className="w-5 h-5" /></button>
                  <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2.5 hover:bg-white hover:shadow-sm rounded-[10px] text-[#A7ADB8] hover:text-ink transition-all"><ChevronRight className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="flex bg-[#F6F7F9] p-1.5 rounded-[18px] border border-[#E3E6EB] shadow-inner">
                <button 
                  onClick={() => setView('month')}
                  className={cn("px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-[14px] transition-all", view === 'month' ? "bg-white shadow-md text-ink" : "text-[#A7ADB8] hover:text-ink")}
                >
                  Mês
                </button>
                <button 
                   onClick={() => setView('day')}
                  className={cn("px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-[14px] transition-all", view === 'day' ? "bg-white shadow-md text-ink" : "text-[#A7ADB8] hover:text-ink")}
                >
                  Dia
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-7 border-b border-border bg-black/10">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                <div key={day} className="p-4 text-center text-[10px] font-black uppercase tracking-[0.25em] text-gray-600">
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
                      "h-32 border-r border-b border-border p-3 transition-all cursor-pointer group relative overflow-hidden",
                      !isCurrentMonth ? "bg-gray-50 opacity-40" : "bg-white hover:bg-gray-50/50",
                      isSelected && "ring-2 ring-primary ring-inset z-10 bg-primary/5"
                    )}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={cn(
                        "text-[11px] font-black h-7 w-7 flex items-center justify-center rounded-lg transition-all",
                        isToday ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" : "text-gray-400 group-hover:text-ink",
                        !isCurrentMonth && "opacity-30"
                      )}>
                        {format(day, 'd')}
                      </span>
                      {dayAppts.length > 0 && (
                        <Badge className="text-[10px] h-5 px-1.5 bg-primary/20 text-primary border-none font-black">{dayAppts.length}</Badge>
                      )}
                    </div>
                    <div className="space-y-1">
                      {dayAppts.slice(0, 2).map(appt => (
                        <div 
                          key={appt.id} 
                          className={cn(
                            "text-[9px] p-1.5 rounded-lg border truncate font-black flex items-center gap-1.5 uppercase tracking-tight",
                            appt.status === 'confirmado' ? "bg-success/10 text-success border-success/30 shadow-sm" :
                            appt.status === 'pendente' ? "bg-primary/10 text-primary border-primary/30 shadow-sm" :
                            "bg-white text-gray-500 border-border shadow-sm"
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
          <div className="bg-white border border-border rounded-[14px] shadow-card p-6 flex flex-col h-full min-h-[600px] relative overflow-hidden">
            <div className="flex justify-between items-center mb-8 border-b border-border pb-4">
              <h3 className="font-black text-xs uppercase tracking-[0.2em] text-gray-400">
                Compromissos do Dia
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
                  <div key={appt.id} className="bg-white border border-border rounded-[14px] p-5 shadow-card hover:border-primary/50 transition-all group relative overflow-hidden">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-gray-50 p-2.5 rounded-xl border border-border shadow-inner">
                          <User className="w-5 h-5 text-gray-500" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-ink uppercase tracking-tight">{appt.leadName}</h4>
                          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{appt.examType}</span>
                        </div>
                      </div>
                      <div className="bg-primary/20 text-primary text-[10px] font-black px-3 py-1 rounded-lg border border-primary/20 shadow-sm">
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

                    <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border/50">
                      <Button 
                        variant="outline" 
                        size="sm" 
                         className="h-10 text-[10px] font-black uppercase tracking-widest bg-gray-50 border-border hover:bg-gray-100 text-ink transition-all rounded-xl"
                        onClick={() => handleStatusChange(appt.id, 'confirmado')}
                        disabled={appt.status === 'confirmado'}
                      >
                        <CheckCircle className="w-4 h-4 mr-2 text-success shadow-[0_0_10px_rgba(31,164,99,0.3)]" /> CONFIRMAR
                      </Button>
                      <Button variant="outline" size="sm" className="h-10 text-[10px] font-black uppercase tracking-widest bg-gray-50 border-border hover:bg-gray-100 text-ink transition-all rounded-xl">
                        <MessageSquare className="w-4 h-4 mr-2 text-primary shadow-[0_0_10px_rgba(255,196,0,0.3)]" /> WHATSAPP
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
                      <SelectItem key={lead.id} value={lead.id}>{lead.full_name}</SelectItem>
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

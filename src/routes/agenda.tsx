import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useWhatsApp } from '@/hooks/useWhatsApp'
import { LogIn, LogOut } from 'lucide-react'
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
  History,
  UserX,
  CalendarClock,
  MoreHorizontal
} from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu'
import { useState, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
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
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { TodayFollowupsTab } from '@/components/agenda/TodayFollowupsTab'
import { useTodayFollowups } from '@/hooks/use-followups'
import { AgendaSettingsDialog } from '@/components/agenda/AgendaSettingsDialog'
import { NewAppointmentDialog } from '@/components/agenda/NewAppointmentDialog'
import { useBusinessHours, useBlockedDates, checkAvailability, isDayFullyClosed } from '@/hooks/use-agenda-settings'

export const Route = createFileRoute('/agenda')({
  component: Agenda,
})

function Agenda() {
  const { appointments, addAppointment, updateAppointment, workingHours } = useAgenda()
  const qc = useQueryClient()
  const { data: leads = [] } = useLeads()
  const { sendText, isConnected: waConnected } = useWhatsApp()
  const navigate = useNavigate()



  
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<'month' | 'day'>('month')
  const [selectedDay, setSelectedDay] = useState(new Date())
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const { data: businessHours = [] } = useBusinessHours()
  const { data: blockedDates = [] } = useBlockedDates()
  
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

    const avail = checkAvailability(formData.date, formData.startTime, formData.endTime, businessHours, blockedDates)
    if (!avail.ok) {
      toast.error(avail.reason ?? 'Horário indisponível')
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


  const handleConfirm = async (appt: Appointment) => {
    await updateAppointment(appt.id, { status: 'confirmado', reminderSent: true })
    toast.success(`${appt.leadName} confirmado!`)
    const lead = leads.find(l => l.id === appt.leadId)
    const phone = lead?.phone
    if (phone && waConnected) {
      try {
        const dateBr = format(new Date(appt.date + 'T00:00:00'), "dd/MM/yyyy")
        await sendText(
          phone,
          `Olá ${appt.leadName}! Seu agendamento de ${appt.examType} está *confirmado* para ${dateBr} às ${appt.startTime}. Aguardamos você!`
        )
        toast.info('Confirmação enviada via WhatsApp')
      } catch {
        toast.warning('Confirmado, mas falha ao enviar WhatsApp')
      }
    }
  }

  const handleCheckin = async (appt: Appointment) => {
    await updateAppointment(appt.id, { checkinAt: new Date().toISOString() })
    // Move o lead pra coluna "Check-IN OK" no Kanban
    try {
      await (supabase as any)
        .from('leads')
        .update({ status: 'checked_in', custom_column_id: null })
        .eq('id', appt.leadId)
      qc.invalidateQueries({ queryKey: ['leads'] })
    } catch (e) {
      // não bloqueia o check-in se a atualização do lead falhar
    }
    toast.success(`Check-in registrado para ${appt.leadName} — lead qualificado!`)
  }

  const handleCheckout = async (appt: Appointment) => {
    await updateAppointment(appt.id, { status: 'realizado', checkoutAt: new Date().toISOString() })
    toast.success(`Atendimento concluído`)
  }

  const handleOpenChat = (appt: Appointment) => {
    const lead = leads.find(l => l.id === appt.leadId)
    const phone = lead?.phone
    if (!phone) {
      toast.error('Lead sem telefone cadastrado')
      return
    }
    navigate({ to: '/chat', search: { phone } })
  }


  // === No-show / Reagendar (MVP manual) ===
  // Tolerância de 2h após o horário de início — antes disso, nada de "atrasado".
  const NO_SHOW_TOLERANCE_MIN = 120
  const isOverdue = (appt: Appointment) => {
    if (appt.checkinAt) return false
    if (appt.status === 'realizado' || appt.status === 'cancelado' || appt.status === 'no-show') return false
    const start = new Date(`${appt.date}T${appt.startTime}:00`).getTime()
    return Date.now() - start > NO_SHOW_TOLERANCE_MIN * 60_000
  }

  const [rescheduleAppt, setRescheduleAppt] = useState<Appointment | null>(null)
  const [rescheduleData, setRescheduleData] = useState({ date: '', startTime: '', endTime: '' })

  const openReschedule = (appt: Appointment) => {
    setRescheduleAppt(appt)
    setRescheduleData({ date: appt.date, startTime: appt.startTime, endTime: appt.endTime })
  }

  const confirmReschedule = async () => {
    if (!rescheduleAppt) return
    const { date, startTime, endTime } = rescheduleData
    if (!date || !startTime || !endTime) {
      toast.error('Preencha data, início e fim')
      return
    }
    const avail = checkAvailability(date, startTime, endTime, businessHours, blockedDates)
    if (!avail.ok) { toast.error(avail.reason ?? 'Horário indisponível'); return }
    await updateAppointment(rescheduleAppt.id, {
      date, startTime, endTime,
      status: 'pendente',
      rescheduleCount: (rescheduleAppt.rescheduleCount ?? 0) + 1,
      reminderSent: false,
    })
    toast.success('Agendamento remarcado!')
    setRescheduleAppt(null)
  }

  const handleNoShow = async (appt: Appointment) => {
    await updateAppointment(appt.id, { status: 'no-show' })
    // Move o lead pra coluna de follow-up para retomar contato
    try {
      await (supabase as any).from('leads').update({ status: 'followup' }).eq('id', appt.leadId)
      qc.invalidateQueries({ queryKey: ['leads'] })
    } catch { /* não bloqueia */ }
    toast.warning(`${appt.leadName} marcado como no-show. Lead movido para Follow-up.`)
  }

  const handleAttendedLate = async (appt: Appointment) => {
    if (appt.status === 'pendente') {
      await updateAppointment(appt.id, { status: 'confirmado', reminderSent: true })
    }
    await handleCheckin(appt)
  }

  // Mobile weekly strip: 5 dias (seg-sex) da semana de selectedDay
  const weekStartMon = startOfWeek(selectedDay, { weekStartsOn: 1 })
  const weekDaysMobile = useMemo(
    () => Array.from({ length: 5 }, (_, i) => addDays(weekStartMon, i)),
    [weekStartMon]
  )

  return (
    <div className="space-y-4 md:space-y-10 animate-in fade-in duration-700">
      {/* MOBILE HEADER */}
      <div className="md:hidden -mx-4 -mt-4 px-4 pt-5 pb-4 bg-[#0E0E11]">
        <h1 className="text-xl font-bold text-white">Agenda de exames</h1>
        <p className="text-sm text-white/60 mt-0.5">Exames de vista e retornos da semana</p>
        <button
          onClick={() => setIsModalOpen(true)}
          className="mt-3 inline-flex items-center gap-1.5 bg-[#FFC400] text-[#1a1500] rounded-full text-sm font-semibold px-4 py-2 active:scale-95 transition"
        >
          <Plus className="w-4 h-4" /> Nova consulta
        </button>
      </div>

      {/* MOBILE WEEK STRIP */}
      <div className="md:hidden mx-4 bg-[#17171B] rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => setSelectedDay(subWeeks(selectedDay, 1))}
            className="text-white/80 p-1"
            aria-label="Semana anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setSelectedDay(new Date())}
            className="text-white text-sm font-medium"
          >
            Hoje
          </button>
          <button
            onClick={() => setSelectedDay(addWeeks(selectedDay, 1))}
            className="text-white/80 p-1"
            aria-label="Próxima semana"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <span className="text-white font-bold text-sm capitalize ml-1">
            {format(selectedDay, 'MMMM yyyy', { locale: ptBR })}
          </span>
          <button
            onClick={() => { setCurrentDate(selectedDay); setView('month') }}
            className="ml-auto border border-white/20 text-white rounded-full text-xs px-3 py-1"
          >
            Ver mês
          </button>
        </div>
        <div className="flex justify-between gap-1">
          {weekDaysMobile.map((day) => {
            const isSelected = isSameDay(day, selectedDay)
            const isToday = isSameDay(day, new Date())
            return (
              <button
                key={day.toISOString()}
                onClick={() => {
                  setSelectedDay(day)
                  setFormData(prev => ({ ...prev, date: format(day, 'yyyy-MM-dd') }))
                }}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition",
                  isSelected ? "bg-[#FFC400] text-[#1a1500]" : "text-white/60"
                )}
              >
                <span className={cn("text-xs uppercase", isSelected ? "text-[#1a1500]/80" : "")}>
                  {format(day, 'EEE', { locale: ptBR }).slice(0, 3)}
                </span>
                <span className={cn("text-lg font-semibold", isSelected ? "text-[#1a1500]" : "text-white/90")}>
                  {format(day, 'd')}
                </span>
                {isToday && !isSelected && (
                  <span className="w-1 h-1 rounded-full bg-[#FFC400]" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* MOBILE DAY CARD */}
      <div className="md:hidden mx-4 bg-[#17171B] rounded-2xl p-4">
        <h3 className="text-white font-semibold text-sm capitalize mb-3">
          {format(selectedDay, "EEEE, d 'de' MMMM", { locale: ptBR })}
        </h3>
        {dayAppointments.length === 0 ? (
          <p className="text-center text-white/40 py-6 text-sm">Nenhuma consulta nesse dia.</p>
        ) : (
          <div className="space-y-2">
            {dayAppointments.map(appt => {
              const overdue = isOverdue(appt)
              return (
                <div key={appt.id} className={cn(
                  "bg-[#0E0E11] border rounded-xl p-3 flex items-center gap-3",
                  overdue ? "border-[#D64545]/40" : "border-white/5"
                )}>
                  <div className={cn(
                    "text-xs font-bold px-2.5 py-1 rounded-lg shrink-0",
                    overdue ? "bg-[#D64545]/15 text-[#FF8A8A]" : "bg-[#FFC400]/15 text-[#FFC400]"
                  )}>
                    {appt.startTime}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm font-semibold truncate">{appt.leadName}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {overdue ? (
                        <span className="text-[10px] font-bold uppercase tracking-wide text-[#FF8A8A]">Atrasado</span>
                      ) : (
                        <p className="text-white/50 text-xs truncate">{appt.examType}</p>
                      )}
                      {appt.status === 'no-show' && (
                        <span className="text-[10px] font-bold uppercase text-[#FF8A8A]">No-show</span>
                      )}
                    </div>
                  </div>

                  {overdue ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="text-white p-2 rounded-lg bg-white/5 active:bg-white/10 shrink-0" aria-label="Ações">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel className="text-xs">Lead não compareceu?</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleAttendedLate(appt)}>
                          <CheckCircle className="w-4 h-4 mr-2 text-success" />
                          Compareceu (atrasado)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openReschedule(appt)}>
                          <CalendarClock className="w-4 h-4 mr-2 text-primary" />
                          Reagendar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleNoShow(appt)} className="text-[#D64545] focus:text-[#D64545]">
                          <UserX className="w-4 h-4 mr-2" />
                          Marcar No-show
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleOpenChat(appt)}>
                          <MessageSquare className="w-4 h-4 mr-2 text-primary" />
                          WhatsApp
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <button
                      onClick={() => handleOpenChat(appt)}
                      className="text-[#FFC400] p-2 rounded-lg active:bg-white/5 shrink-0"
                      aria-label="Abrir WhatsApp"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>

        )}
      </div>

      {/* DESKTOP HERO */}
      <div className="hidden md:flex flex-col md:flex-row justify-between items-start md:items-center gap-8 bg-white p-10 rounded-[24px] border border-[#E3E6EB] shadow-sm relative overflow-hidden">
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
          <Button onClick={() => setIsSettingsOpen(true)} variant="outline" className="gap-3 bg-white border-[#E3E6EB] text-[#A7ADB8] hover:text-ink hover:bg-[#F6F7F9] font-black text-[11px] h-14 px-8 rounded-[16px] transition-all uppercase tracking-widest">
            <Settings className="w-5 h-5" /> CONFIGURAÇÕES
          </Button>
        </div>
      </div>

      <Tabs defaultValue="agenda" className="w-full">
        <TabsList className="mb-6 mx-4 md:mx-0 bg-transparent md:bg-[#F6F7F9] border-0 md:border h-auto md:h-9 p-0 md:p-1 gap-2 md:gap-0">
          <TabsTrigger
            value="agenda"
            className="rounded-full md:rounded-[6px] px-3 py-1.5 text-sm data-[state=active]:bg-[#FFC400] md:data-[state=active]:bg-white data-[state=active]:text-[#1a1500] md:data-[state=active]:text-[#1A1A1A] text-[#6C727C] md:text-inherit"
          >
            📅 Agenda do dia
          </TabsTrigger>
          <TabsTrigger
            value="followups"
            className="rounded-full md:rounded-[6px] px-3 py-1.5 text-sm data-[state=active]:bg-[#FFC400] md:data-[state=active]:bg-white data-[state=active]:text-[#1a1500] md:data-[state=active]:text-[#1A1A1A] text-[#6C727C] md:text-inherit"
          >
            🔔 Follow-ups
            <FollowupsCountBadge />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agenda">
          <div className="hidden md:grid grid-cols-1 lg:grid-cols-4 gap-6">
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
                const closed = isDayFullyClosed(day, businessHours, blockedDates)

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
                      closed && isCurrentMonth && "bg-[repeating-linear-gradient(45deg,#f3f4f6,#f3f4f6_6px,#ffffff_6px,#ffffff_12px)]",
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
                      {closed && isCurrentMonth ? (
                        <Badge className="text-[9px] h-5 px-1.5 bg-gray-200 text-gray-600 border-none font-black">FECHADO</Badge>
                      ) : dayAppts.length > 0 && (
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

                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <Badge className="text-[9px] h-4" variant={appt.status === 'confirmado' ? 'default' : 'secondary'}>
                        {appt.status.toUpperCase()}
                      </Badge>
                      {isOverdue(appt) && (
                        <Badge className="text-[9px] h-4 bg-[#FBEBEB] text-[#D64545] border border-[#D64545]/30">
                          ATRASADO &gt; 2h
                        </Badge>
                      )}
                      {appt.propensityScore > 0.8 && (
                        <Badge variant="outline" className="text-[9px] h-4 bg-green-50 text-green-700 border-green-200">
                          Alta Propensão
                        </Badge>
                      )}
                    </div>

                    {isOverdue(appt) ? (
                      <div className="grid grid-cols-2 gap-2 pt-4 border-t border-border/50">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-10 text-[10px] font-black uppercase tracking-widest bg-gray-50 border-border hover:bg-gray-100 text-ink rounded-xl"
                          onClick={() => handleAttendedLate(appt)}
                        >
                          <CheckCircle className="w-4 h-4 mr-1.5 text-success" /> COMPARECEU
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-10 text-[10px] font-black uppercase tracking-widest bg-gray-50 border-border hover:bg-gray-100 text-ink rounded-xl"
                          onClick={() => openReschedule(appt)}
                        >
                          <CalendarClock className="w-4 h-4 mr-1.5 text-primary" /> REAGENDAR
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-10 text-[10px] font-black uppercase tracking-widest bg-[#FBEBEB]/60 border-[#D64545]/30 text-[#D64545] hover:bg-[#FBEBEB] rounded-xl"
                          onClick={() => handleNoShow(appt)}
                        >
                          <UserX className="w-4 h-4 mr-1.5" /> NO-SHOW
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenChat(appt)}
                          className="h-10 text-[10px] font-black uppercase tracking-widest bg-gray-50 border-border hover:bg-gray-100 text-ink rounded-xl"
                        >
                          <MessageSquare className="w-4 h-4 mr-1.5 text-primary" /> WHATSAPP
                        </Button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border/50">
                        {appt.status === 'pendente' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-10 text-[10px] font-black uppercase tracking-widest bg-gray-50 border-border hover:bg-gray-100 text-ink transition-all rounded-xl"
                            onClick={() => handleConfirm(appt)}
                          >
                            <CheckCircle className="w-4 h-4 mr-2 text-success" /> CONFIRMAR
                          </Button>
                        )}
                        {appt.status === 'confirmado' && !appt.checkinAt && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-10 text-[10px] font-black uppercase tracking-widest bg-gray-50 border-border hover:bg-gray-100 text-ink transition-all rounded-xl"
                            onClick={() => handleCheckin(appt)}
                          >
                            <LogIn className="w-4 h-4 mr-2 text-primary" /> CHECK-IN
                          </Button>
                        )}
                        {appt.status === 'confirmado' && appt.checkinAt && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-10 text-[10px] font-black uppercase tracking-widest bg-gray-50 border-border hover:bg-gray-100 text-ink transition-all rounded-xl"
                            onClick={() => handleCheckout(appt)}
                          >
                            <LogOut className="w-4 h-4 mr-2 text-success" /> CHECK-OUT
                          </Button>
                        )}
                        {appt.status === 'realizado' && (
                          <Button variant="outline" size="sm" disabled className="h-10 text-[10px] font-black uppercase tracking-widest bg-success/10 border-success/30 text-success rounded-xl">
                            <CheckCircle className="w-4 h-4 mr-2" /> CONCLUÍDO
                          </Button>
                        )}
                        {appt.status === 'no-show' && (
                          <Button variant="outline" size="sm" disabled className="h-10 text-[10px] font-black uppercase tracking-widest bg-[#FBEBEB] border-[#D64545]/30 text-[#D64545] rounded-xl">
                            <UserX className="w-4 h-4 mr-2" /> NO-SHOW
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenChat(appt)}
                          className="h-10 text-[10px] font-black uppercase tracking-widest bg-gray-50 border-border hover:bg-gray-100 text-ink transition-all rounded-xl"
                        >
                          <MessageSquare className="w-4 h-4 mr-2 text-primary" /> WHATSAPP
                        </Button>
                      </div>
                    )}

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
        </TabsContent>

        <TabsContent value="followups">
          <TodayFollowupsTab />
        </TabsContent>
      </Tabs>



      {/* Modal Novo Agendamento — componente compartilhado */}
      <NewAppointmentDialog
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        defaultDate={selectedDay}
      />


      <AgendaSettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />

      {/* Reagendar Dialog */}
      <Dialog open={!!rescheduleAppt} onOpenChange={(o) => !o && setRescheduleAppt(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Reagendar — {rescheduleAppt?.leadName}</DialogTitle>
            <DialogDescription>
              Escolha um novo horário. O contador de no-show é zerado e o status volta para pendente.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Nova data</Label>
              <Input
                type="date"
                value={rescheduleData.date}
                onChange={(e) => setRescheduleData(p => ({ ...p, date: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Início</Label>
                <Input
                  type="time"
                  value={rescheduleData.startTime}
                  onChange={(e) => setRescheduleData(p => ({ ...p, startTime: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Fim</Label>
                <Input
                  type="time"
                  value={rescheduleData.endTime}
                  onChange={(e) => setRescheduleData(p => ({ ...p, endTime: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleAppt(null)}>Cancelar</Button>
            <Button onClick={confirmReschedule}>Confirmar reagendamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FollowupsCountBadge() {
  const { data = [] } = useTodayFollowups()
  if (data.length === 0) return null
  return (
    <Badge className="ml-2 h-5 px-1.5 bg-primary/20 text-primary border-none font-black text-[10px]">
      {data.length}
    </Badge>
  )
}


import { createFileRoute } from '@tanstack/react-router'
import { Calendar, ChevronLeft, ChevronRight, Plus, User, Clock, MapPin, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'

export const Route = createFileRoute('/agenda')({
  component: Agenda,
})

const appointments = [
  { id: 1, client: 'João Silva', time: '14:00', duration: '60 min', type: 'Consulta Inicial', status: 'confirmed', day: 15 },
  { id: 2, client: 'Maria Souza', time: '16:00', duration: '30 min', type: 'Retorno', status: 'pending', day: 15 },
]

function Agenda() {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 5, 15)) // Junho 2026

  const daysInMonth = 30
  const firstDayOfMonth = 1 // Segunda

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agenda de Atendimentos</h1>
          <p className="text-sm text-muted-foreground">Gerencie seus compromissos e agendamentos.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button className="flex-1 md:flex-none border px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> Novo Agendamento
          </button>
          <button className="flex-1 md:flex-none bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">
            Exportar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendário e Mini Filtros */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">Junho 2026</h3>
              <div className="flex border rounded-lg">
                <button className="p-2 hover:bg-gray-50 border-r"><ChevronLeft className="w-4 h-4" /></button>
                <button className="p-2 hover:bg-gray-50"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
            
            <div className="grid grid-cols-7 border-b bg-gray-50/50">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                <div key={day} className="p-3 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {Array.from({ length: 35 }).map((_, i) => {
                const dayNumber = i - firstDayOfMonth + 1
                const isCurrentMonth = dayNumber > 0 && dayNumber <= daysInMonth
                const hasAppointments = appointments.some(a => a.day === dayNumber)
                const isSelected = dayNumber === 15

                return (
                  <div 
                    key={i} 
                    className={`h-24 border-r border-b p-2 transition-colors cursor-pointer group hover:bg-gray-50/50 ${!isCurrentMonth ? 'bg-gray-50/20' : ''} ${isSelected ? 'bg-primary/5' : ''}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={`text-xs font-medium ${isSelected ? 'text-primary font-bold' : 'text-gray-500'}`}>
                        {isCurrentMonth ? dayNumber : ''}
                      </span>
                      {hasAppointments && (
                        <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                      )}
                    </div>
                    {isCurrentMonth && dayNumber === 15 && (
                      <div className="space-y-1">
                        <div className="text-[9px] bg-primary/10 text-primary p-1 rounded border border-primary/20 truncate font-medium">
                          14:00 - João S.
                        </div>
                        <div className="text-[9px] bg-yellow-100 text-yellow-700 p-1 rounded border border-yellow-200 truncate font-medium">
                          16:00 - Maria S.
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Resumo do Dia Selecionado */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white border rounded-xl shadow-sm p-4">
            <h3 className="font-semibold mb-4 text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> Compromissos de Hoje
            </h3>
            <div className="space-y-4">
              {appointments.map(appt => (
                <div key={appt.id} className="relative pl-4 border-l-2 border-primary space-y-1 py-1">
                  <div className="flex justify-between items-start">
                    <h4 className="text-sm font-semibold">{appt.client}</h4>
                    <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                      {appt.time}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{appt.type}</p>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground pt-1">
                    <MapPin className="w-3 h-3" /> Unidade Sul
                  </div>
                </div>
              ))}
              
              <button className="w-full mt-4 py-2 text-xs font-medium text-primary hover:bg-primary/5 rounded-lg border border-dashed border-primary/30 transition-colors">
                + Ver todos os horários
              </button>
            </div>
          </div>

          <div className="bg-primary/5 border border-primary/10 rounded-xl p-4">
            <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Dica da IA SDR</h4>
            <p className="text-xs text-gray-600 leading-relaxed">
              "João Silva tem alta probabilidade de fechamento hoje. Certifique-se de ter o orçamento de R$ 2.500 pronto."
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

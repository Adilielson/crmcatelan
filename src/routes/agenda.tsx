import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/agenda')({
  component: Agenda,
})

function Agenda() {
  return (
    <div className="bg-white border rounded-xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold">Calendário de Consultas</h3>
        <div className="flex gap-2">
          <button className="border px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50 transition-colors">Hoje</button>
          <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium">
            Agendar Consulta
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 border rounded-lg overflow-hidden">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
          <div key={day} className="bg-gray-50 border-b p-3 text-center text-xs font-medium text-muted-foreground">
            {day}
          </div>
        ))}
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="h-24 border-r border-b p-2 hover:bg-gray-50/50 transition-colors cursor-pointer text-xs">
            {i - 4 > 0 && i - 4 <= 31 ? i - 4 : ''}
          </div>
        ))}
      </div>
    </div>
  )
}

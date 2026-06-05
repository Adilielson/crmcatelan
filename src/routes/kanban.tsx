import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/kanban')({
  component: Kanban,
})

function Kanban() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Pipeline de Vendas</h3>
        <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium">
          Novo Lead
        </button>
      </div>
      
      <div className="flex gap-6 overflow-x-auto pb-4">
        {['Leads Prontos', 'Em Atendimento', 'Agendado', 'Perdido'].map((column) => (
          <div key={column} className="min-w-[300px] flex-1">
            <div className="bg-gray-100 p-4 rounded-t-xl border-t border-x flex justify-between items-center">
              <span className="font-medium text-sm">{column}</span>
              <span className="bg-white px-2 py-0.5 rounded text-xs text-muted-foreground border">0</span>
            </div>
            <div className="bg-gray-50/50 p-4 rounded-b-xl border min-h-[500px] space-y-3">
              <p className="text-xs text-center text-muted-foreground mt-10 italic">Arraste leads aqui</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

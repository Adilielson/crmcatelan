import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Dashboard,
})

function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total de Leads" value="128" change="+12% que ontem" />
        <StatCard title="Agendamentos" value="12" change="+3 novos" />
        <StatCard title="Conversão" value="24%" change="-2% este mês" />
        <StatCard title="No-Show" value="8%" change="Muito baixo" color="text-green-600" />
      </div>

      <div className="bg-white p-6 rounded-xl border">
        <h3 className="text-lg font-semibold mb-4">Visão Geral de Atividades</h3>
        <div className="h-64 flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
          Gráfico de performance (Em breve)
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, change, color }: { title: string; value: string; change: string; color?: string }) {
  return (
    <div className="bg-white p-6 rounded-xl border">
      <p className="text-sm text-muted-foreground mb-1">{title}</p>
      <h4 className={cn("text-2xl font-bold", color)}>{value}</h4>
      <p className="text-xs text-muted-foreground mt-2">{change}</p>
    </div>
  )
}

import { cn } from '@/lib/utils'

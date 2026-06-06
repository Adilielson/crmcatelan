import { createFileRoute } from '@tanstack/react-router'
import { MarketingMetrics } from '@/components/kanban/MarketingMetrics'

export const Route = createFileRoute('/marketing')({
  component: MarketingPage,
})

function MarketingPage() {
  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold">Métricas do Gestor de Tráfego</h2>
      <MarketingMetrics />
    </div>
  )
}

import { createFileRoute } from '@tanstack/react-router'
import { MarketingMetrics } from '@/components/kanban/MarketingMetrics'

export const Route = createFileRoute('/marketing' as any)({
  component: MarketingPage,
})

function MarketingPage() {
  return (
    <div className="space-y-6">
      <MarketingMetrics />
    </div>
  )
}

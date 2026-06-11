import { createFileRoute } from '@tanstack/react-router'
import { Bell } from 'lucide-react'
import { MobilePagePlaceholder } from '@/components/mobile/MobilePagePlaceholder'

export const Route = createFileRoute('/m/alertas')({
  component: () => (
    <MobilePagePlaceholder
      title="Alertas"
      subtitle="Conversas paradas, SLA estourado e ações urgentes."
      icon={Bell}
      hint="Central de alertas — em breve."
    />
  ),
})

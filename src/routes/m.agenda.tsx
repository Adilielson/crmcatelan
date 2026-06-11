import { createFileRoute } from '@tanstack/react-router'
import { CalendarDays } from 'lucide-react'
import { MobilePagePlaceholder } from '@/components/mobile/MobilePagePlaceholder'

export const Route = createFileRoute('/m/agenda')({
  component: () => (
    <MobilePagePlaceholder
      title="Hoje"
      subtitle="Compromissos do dia, check-ins e lembretes."
      icon={CalendarDays}
      hint="Em breve: lista priorizada com botão de check-in destacado."
    />
  ),
})

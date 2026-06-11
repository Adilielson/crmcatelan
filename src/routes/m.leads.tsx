import { createFileRoute } from '@tanstack/react-router'
import { Construction } from 'lucide-react'
import { MobilePagePlaceholder } from '@/components/mobile/MobilePagePlaceholder'

export const Route = createFileRoute('/m/leads')({
  component: () => (
    <MobilePagePlaceholder
      title="Meus Leads"
      subtitle="Kanban mobile dos leads que estão sob sua responsabilidade."
      icon={Construction}
      hint="Em construção — etapa 4 do roadmap mobile."
    />
  ),
})

import { createFileRoute } from '@tanstack/react-router'
import { GitBranch } from 'lucide-react'
import { MobilePagePlaceholder } from '@/components/mobile/MobilePagePlaceholder'

export const Route = createFileRoute('/m/funil')({
  component: () => (
    <MobilePagePlaceholder
      title="Funil"
      subtitle="Distribuição dos leads por estágio."
      icon={GitBranch}
      hint="Visão consolidada do funil — em breve."
    />
  ),
})

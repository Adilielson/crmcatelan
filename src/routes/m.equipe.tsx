import { createFileRoute } from '@tanstack/react-router'
import { UsersRound } from 'lucide-react'
import { MobilePagePlaceholder } from '@/components/mobile/MobilePagePlaceholder'

export const Route = createFileRoute('/m/equipe')({
  component: () => (
    <MobilePagePlaceholder
      title="Equipe"
      subtitle="Atendentes online, carga de trabalho e SLA."
      icon={UsersRound}
      hint="Visão de equipe em tempo real — em breve."
    />
  ),
})

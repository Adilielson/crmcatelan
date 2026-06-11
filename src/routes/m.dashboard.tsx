import { createFileRoute } from '@tanstack/react-router'
import { LayoutDashboard } from 'lucide-react'
import { MobilePagePlaceholder } from '@/components/mobile/MobilePagePlaceholder'

export const Route = createFileRoute('/m/dashboard')({
  component: () => (
    <MobilePagePlaceholder
      title="Visão Geral"
      subtitle="KPIs em tempo real para gestores."
      icon={LayoutDashboard}
      hint="Em construção — etapa 3 do roadmap mobile."
    />
  ),
})

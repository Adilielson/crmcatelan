import { createFileRoute } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { MobilePagePlaceholder } from '@/components/mobile/MobilePagePlaceholder'

export const Route = createFileRoute('/m/buscar')({
  component: () => (
    <MobilePagePlaceholder
      title="Buscar"
      subtitle="Localize leads, conversas e clientes."
      icon={Search}
      hint="Busca global mobile em breve."
    />
  ),
})

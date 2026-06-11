import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useAuthStore } from '@/hooks/use-auth'

export const Route = createFileRoute('/m/')({
  component: MobileIndex,
})

function MobileIndex() {
  const user = useAuthStore((s) => s.user)
  const isManager = user?.role === 'manager' || user?.role === 'admin' || user?.role === 'super_admin'
  return <Navigate to={isManager ? '/m/dashboard' : '/m/chat'} replace />
}

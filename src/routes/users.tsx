import { createFileRoute } from '@tanstack/react-router'
import UserManagement from '@/pages/dashboard/settings/users'

export const Route = createFileRoute('/users')({
  component: UserManagement,
})


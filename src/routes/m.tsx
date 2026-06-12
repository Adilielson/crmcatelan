import { createFileRoute, Outlet, Link, useLocation, useNavigate, redirect } from '@tanstack/react-router'
import { useEffect } from 'react'
import {
  MessageSquare,
  Users,
  CalendarDays,
  Search,
  User,
  LayoutDashboard,
  UsersRound,
  GitBranch,
  Bell,
} from 'lucide-react'
import { useAuthStore } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/m')({
  component: MobileShell,
})

type NavItem = {
  to: string
  label: string
  icon: typeof MessageSquare
  match?: (p: string) => boolean
}

const ATENDENTE_NAV: NavItem[] = [
  { to: '/m/chat', label: 'Conversas', icon: MessageSquare, match: (p) => p.startsWith('/m/chat') },
  { to: '/m/leads', label: 'Leads', icon: Users, match: (p) => p.startsWith('/m/leads') },
  { to: '/m/agenda', label: 'Hoje', icon: CalendarDays, match: (p) => p.startsWith('/m/agenda') },
  { to: '/m/buscar', label: 'Buscar', icon: Search, match: (p) => p.startsWith('/m/buscar') },
  { to: '/m/eu', label: 'Eu', icon: User, match: (p) => p.startsWith('/m/eu') },
]

const GERENTE_NAV: NavItem[] = [
  { to: '/m/dashboard', label: 'Visão', icon: LayoutDashboard, match: (p) => p.startsWith('/m/dashboard') },
  { to: '/m/equipe', label: 'Equipe', icon: UsersRound, match: (p) => p.startsWith('/m/equipe') },
  { to: '/m/chat', label: 'Conversas', icon: MessageSquare, match: (p) => p.startsWith('/m/chat') },
  { to: '/m/funil', label: 'Funil', icon: GitBranch, match: (p) => p.startsWith('/m/funil') },
  { to: '/m/alertas', label: 'Alertas', icon: Bell, match: (p) => p.startsWith('/m/alertas') },
]

function isManagerRole(role?: string | null) {
  return role === 'manager' || role === 'admin' || role === 'super_admin'
}

function MobileShell() {
  const { user, loading } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !user) navigate({ to: '/login' })
  }, [loading, user, navigate])

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#0E0E11] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#FFC400] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const nav = isManagerRole(user.role) ? GERENTE_NAV : ATENDENTE_NAV

  // Esconde a bottom nav em telas full-screen (conversa aberta)
  const hideBottomNav =
    /^\/m\/chat\/[^/]+/.test(location.pathname) ||
    /^\/m\/leads\/[^/]+/.test(location.pathname)

  return (
    <div className="min-h-screen bg-[#F6F7F9] text-ink font-jakarta flex flex-col">
      <main
        className={cn(
          'flex-1 flex flex-col min-h-0',
          !hideBottomNav && 'pb-[68px]',
        )}
      >
        <Outlet />
      </main>

      {!hideBottomNav && (
        <nav
          className="fixed bottom-0 inset-x-0 z-40 bg-[#0E0E11] border-t border-[#23232B] pb-[env(safe-area-inset-bottom)]"
          aria-label="Navegação principal"
        >
          <ul className="grid grid-cols-5">
            {nav.map((item) => {
              const active = item.match
                ? item.match(location.pathname)
                : location.pathname === item.to
              const Icon = item.icon
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={cn(
                      'flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold tracking-wide transition-colors',
                      active ? 'text-[#FFC400]' : 'text-slate-400 hover:text-white',
                    )}
                  >
                    <Icon className={cn('h-5 w-5', active && 'drop-shadow-[0_0_6px_rgba(255,196,0,0.5)]')} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      )}
    </div>
  )
}

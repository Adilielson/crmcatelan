import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { LogOut, User as UserIcon } from 'lucide-react'
import { useAuthStore } from '@/hooks/use-auth'

export const Route = createFileRoute('/m/eu')({
  component: MobileMe,
})

function MobileMe() {
  const { user, tenant, logout } = useAuthStore()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate({ to: '/login' })
  }

  return (
    <div className="flex flex-col h-full">
      <header className="bg-[#0E0E11] text-white px-5 pt-6 pb-5">
        <p className="text-[11px] uppercase tracking-widest text-[#FFC400] font-bold">Perfil</p>
        <h1 className="text-2xl font-black mt-1">Eu</h1>
      </header>

      <div className="p-5 space-y-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/70">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-[#FFC400]/15 grid place-items-center shrink-0">
              <UserIcon className="h-7 w-7 text-[#FFC400]" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-slate-900 truncate">{user?.name ?? user?.email ?? 'Usuário'}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {user?.role}
              </p>
            </div>
          </div>
          {tenant?.name && (
            <p className="mt-4 text-xs text-slate-500">
              Tenant: <span className="font-semibold text-slate-700">{tenant.name}</span>
            </p>
          )}
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 bg-[#0E0E11] text-white py-3 rounded-xl font-semibold hover:bg-black transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </div>
  )
}

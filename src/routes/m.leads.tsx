import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { Search, ChevronRight, Brain, DollarSign } from 'lucide-react'
import { useLeads, stageLabel } from '@/hooks/use-leads'
import { useAuthStore } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import { useNavigate } from '@tanstack/react-router'

export const Route = createFileRoute('/m/leads')({
  component: MobileLeadsPage,
})

const stageTone: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  scheduled: 'bg-purple-100 text-purple-700',
  checked_in: 'bg-emerald-100 text-emerald-700',
  negotiating: 'bg-cyan-100 text-cyan-700',
  showed_up: 'bg-green-100 text-green-700',
  followup: 'bg-yellow-100 text-yellow-800',
  no_show: 'bg-gray-200 text-gray-700',
  lost: 'bg-red-100 text-red-700',
}

function MobileLeadsPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { data: leads = [], isLoading } = useLeads()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'meus' | 'todos'>('meus')

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = filter === 'meus' && user?.id
      ? leads.filter((l) => l.assigned_user_id === user.id)
      : leads
    if (q) {
      list = list.filter(
        (l) =>
          l.full_name.toLowerCase().includes(q) ||
          (l.phone ?? '').toLowerCase().includes(q),
      )
    }
    return list
  }, [leads, filter, search, user?.id])

  return (
    <div className="min-h-full flex flex-col bg-[#FAFBFC]">
      <header className="px-5 pt-5 pb-3 bg-white border-b border-[#EEF0F3]">
        <h1 className="text-2xl font-black text-ink font-jakarta">Meus Leads</h1>
        <p className="text-xs text-gray-500 mt-0.5 font-medium">
          Toque em um lead para ver a ficha completa.
        </p>

        <div className="mt-4 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou telefone..."
            className="w-full bg-[#F6F7F9] rounded-2xl pl-12 pr-4 py-3 text-sm font-bold text-ink placeholder:text-gray-400 outline-none focus:bg-white focus:ring-2 focus:ring-primary/30 transition"
          />
        </div>

        <div className="mt-3 flex gap-2">
          {(['meus', 'todos'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider border transition',
                filter === f
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-white text-gray-600 border-[#E3E6EB]',
              )}
            >
              {f === 'meus' ? 'Meus' : 'Todos'}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1">
        {isLoading && (
          <p className="text-center text-xs text-gray-400 py-10 font-bold">Carregando leads...</p>
        )}
        {!isLoading && visible.length === 0 && (
          <div className="text-center text-xs text-gray-400 py-16 px-6">
            <p className="font-bold mb-1">Nenhum lead encontrado.</p>
            <p>Tente alterar o filtro ou a busca.</p>
          </div>
        )}

        <ul className="divide-y divide-[#F0F1F4] bg-white">
          {visible.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => {
                  if (l.phone) {
                    navigate({ to: '/m/chat/$phone', params: { phone: l.phone } })
                  } else {
                    navigate({ to: '/m/leads/$id', params: { id: l.id } })
                  }
                }}
                className="w-full flex items-center gap-3 px-5 py-3.5 active:bg-gray-50 transition text-left"
              >
                <div className="h-12 w-12 shrink-0 rounded-2xl bg-gradient-to-br from-[#FFF4CC] to-[#FFE07A] grid place-items-center font-black text-[#8a6900]">
                  {l.full_name
                    .split(' ')
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase() || '??'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="truncate text-[15px] font-bold text-ink">{l.full_name}</h3>
                    {l.score_ia != null && l.score_ia >= 80 && (
                      <Brain className="h-3.5 w-3.5 text-primary shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={cn(
                        'text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full',
                        stageTone[l.status] ?? 'bg-gray-100 text-gray-600',
                      )}
                    >
                      {stageLabel(l.status)}
                    </span>
                    {l.sales_value != null && l.sales_value > 0 && (
                      <span className="flex items-center gap-0.5 text-[11px] font-bold text-ink">
                        <DollarSign className="w-3 h-3 opacity-60" />
                        R$ {l.sales_value.toLocaleString('pt-BR')}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

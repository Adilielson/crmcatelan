import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { Brain, DollarSign } from 'lucide-react'
import { useLeads, type DBLead } from '@/hooks/use-leads'
import { useKanbanColumns, type KanbanColumn } from '@/hooks/use-kanban-columns'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { LeadProfilePanel } from '@/components/leads/LeadProfilePanel'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/m/funil')({
  component: MobileFunilPage,
})

function MobileFunilPage() {
  const navigate = useNavigate()
  const { data: leads = [], isLoading } = useLeads()
  const { data: columns = [] } = useKanbanColumns()
  const [selected, setSelected] = useState<DBLead | null>(null)

  const leadsForColumn = (col: KanbanColumn): DBLead[] => {
    if (col.is_system && col.system_key) {
      return leads.filter((l) => l.custom_column_id == null && l.status === col.system_key)
    }
    return leads.filter((l) => l.custom_column_id === col.id)
  }

  const total = leads.length

  const visibleColumns = useMemo(() => columns, [columns])

  return (
    <div className="min-h-full flex flex-col bg-[#FAFBFC]">
      <header className="px-5 pt-5 pb-3 bg-white border-b border-[#EEF0F3]">
        <h1 className="text-2xl font-black text-ink font-jakarta">Funil</h1>
        <p className="text-xs text-gray-500 mt-0.5 font-medium">
          {total} lead{total === 1 ? '' : 's'} no fluxo. Toque para abrir.
        </p>
      </header>

      {isLoading ? (
        <p className="text-center text-xs text-gray-400 py-10 font-bold">Carregando...</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto px-4 py-5 snap-x snap-mandatory scrollbar-hide">
          {visibleColumns.map((col) => {
            const items = leadsForColumn(col)
            return (
              <div
                key={col.id}
                className="snap-start shrink-0 w-[78vw] max-w-[320px] flex flex-col gap-3"
              >
                <div className="relative flex items-center justify-between bg-white border border-[#E3E6EB] rounded-2xl px-4 py-3 shadow-sm overflow-hidden">
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1.5"
                    style={{ backgroundColor: col.color }}
                  />
                  <span className="font-black uppercase tracking-wider text-[11px] text-[#5A626E]">
                    {col.name}
                  </span>
                  <span className="text-[10px] font-black bg-[#F6F7F9] text-ink px-2 py-0.5 rounded-full border border-[#E3E6EB]">
                    {items.length}
                  </span>
                </div>

                <div className="flex flex-col gap-2.5">
                  {items.length === 0 && (
                    <div className="text-center text-[10px] uppercase tracking-widest text-gray-300 font-bold py-6">
                      Vazio
                    </div>
                  )}
                  {items.map((lead) => (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={() => setSelected(lead)}
                      className="text-left bg-white border border-[#E3E6EB] rounded-2xl p-4 active:scale-[0.98] transition shadow-[0_2px_8px_rgba(0,0,0,0.03)]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-black text-[13px] text-ink truncate uppercase tracking-tight">
                            {lead.full_name}
                          </h4>
                          {lead.phone && (
                            <p className="text-[11px] text-gray-500 mt-0.5 truncate">{lead.phone}</p>
                          )}
                        </div>
                        {(lead.score_ia ?? 0) >= 80 && (
                          <span className="shrink-0 inline-flex items-center gap-0.5 bg-[#FFC400] text-[#1a1500] text-[9px] font-black px-1.5 py-0.5 rounded-full">
                            <Brain className="w-2.5 h-2.5" /> {lead.score_ia}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        {lead.sales_value != null && lead.sales_value > 0 && (
                          <span className="flex items-center gap-0.5 text-[11px] font-bold text-ink">
                            <DollarSign className="w-3 h-3 opacity-60" />
                            R$ {lead.sales_value.toLocaleString('pt-BR')}
                          </span>
                        )}
                        <span
                          className={cn(
                            'text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full',
                            'bg-gray-100 text-gray-700',
                          )}
                        >
                          {lead.source ?? '—'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto p-0">
          {selected && (
            <div className="px-5 pt-3 pb-8">
              <div className="mx-auto w-12 h-1 rounded-full bg-gray-300 mb-4" />
              <SheetHeader className="text-left mb-4">
                <SheetTitle className="text-xl font-black">{selected.full_name}</SheetTitle>
              </SheetHeader>
              <LeadProfilePanel
                lead={selected}
                compact
                onOpenChat={() => {
                  if (selected.phone) {
                    navigate({ to: '/m/chat/$phone', params: { phone: selected.phone } })
                    setSelected(null)
                  }
                }}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

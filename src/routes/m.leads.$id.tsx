import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { ArrowLeft, MessageCircle, Phone } from 'lucide-react'
import { useLeads } from '@/hooks/use-leads'
import { LeadProfilePanel } from '@/components/leads/LeadProfilePanel'

export const Route = createFileRoute('/m/leads/$id')({
  component: MobileLeadDetail,
})

function MobileLeadDetail() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const router = useRouter()
  const { data: leads = [], isLoading } = useLeads()
  const lead = leads.find((l) => l.id === id)

  const initials =
    lead?.full_name
      .split(' ')
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '??'

  return (
    <div className="min-h-full flex flex-col bg-[#ECE5DD]">
      {/* WhatsApp-style header */}
      <header className="sticky top-0 z-30 bg-[#075E54] text-white shadow-md pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-2 px-2 py-2.5">
          <button
            type="button"
            onClick={() => (router.history.length > 1 ? router.history.back() : navigate({ to: '/m/leads' }))}
            className="p-2 -ml-1 rounded-full active:bg-white/10 transition"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-br from-[#FFF4CC] to-[#FFE07A] grid place-items-center font-black text-[#8a6900] text-sm">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="truncate text-[15px] font-bold leading-tight">
              {lead?.full_name ?? (isLoading ? 'Carregando...' : 'Lead não encontrado')}
            </h1>
            {lead?.phone && (
              <p className="truncate text-[11px] text-white/80 font-medium">{lead.phone}</p>
            )}
          </div>
          {lead?.phone && (
            <>
              <a
                href={`tel:${lead.phone}`}
                className="p-2 rounded-full active:bg-white/10 transition"
                aria-label="Ligar"
              >
                <Phone className="w-5 h-5" />
              </a>
              <button
                type="button"
                onClick={() => navigate({ to: '/m/chat/$phone', params: { phone: lead.phone! } })}
                className="p-2 rounded-full active:bg-white/10 transition"
                aria-label="Conversar"
              >
                <MessageCircle className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 px-4 py-4 bg-[#FAFBFC]">
        {isLoading && (
          <p className="text-center text-xs text-gray-400 py-10 font-bold">Carregando ficha...</p>
        )}
        {!isLoading && !lead && (
          <div className="text-center text-xs text-gray-500 py-16">
            <p className="font-bold mb-2">Lead não encontrado.</p>
            <button
              type="button"
              onClick={() => navigate({ to: '/m/leads' })}
              className="px-4 py-2 rounded-full bg-primary text-primary-foreground font-bold text-xs"
            >
              Voltar para a lista
            </button>
          </div>
        )}
        {lead && (
          <LeadProfilePanel
            lead={lead}
            compact
            onOpenChat={() =>
              lead.phone && navigate({ to: '/m/chat/$phone', params: { phone: lead.phone } })
            }
          />
        )}
      </div>
    </div>
  )
}

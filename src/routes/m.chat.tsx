import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import {
  Search,
  Plus,
  Camera,
  MoreHorizontal,
  Archive,
  CheckCheck,
  RefreshCw,
  MessageSquare,
  Phone,
  Users,
  User,
  Brain,
  CalendarCheck,
  LogIn,
} from 'lucide-react'
import {
  useWhatsAppChat,
  formatChatTime,
  formatPhoneDisplay,
  getContactInitials,
  type WhatsAppConversation,
} from '@/hooks/use-whatsapp-chat'
import { useLeads, useUpdateLead, type DBLead as Lead } from '@/hooks/use-leads'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export const Route = createFileRoute('/m/chat')({
  component: MobileChat,
})

type FilterKey = 'all' | 'unread' | 'ia' | 'agenda'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'unread', label: 'Não lidas' },
  { key: 'ia', label: 'IA' },
  { key: 'agenda', label: 'Agenda' },
]

const onlyDigits = (s: string) => s.replace(/\D+/g, '')

function MobileChat() {
  const navigate = useNavigate()
  const { conversations, loading } = useWhatsAppChat()
  const { data: leads = [] } = useLeads()
  const updateLead = useUpdateLead()
  const [filter, setFilter] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')

  // Map: digits-only phone -> lead (last 10-11 digits compare)
  const leadByPhone = useMemo(() => {
    const m = new Map<string, Lead>()
    for (const l of leads) {
      if (!l.phone) continue
      const d = onlyDigits(l.phone)
      m.set(d.slice(-11), l)
    }
    return m
  }, [leads])

  const matchLead = (phone: string): Lead | undefined => {
    const d = onlyDigits(phone).slice(-11)
    return leadByPhone.get(d) ?? leadByPhone.get(d.slice(-10))
  }

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + c.unread, 0),
    [conversations],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = conversations
    if (filter === 'unread') list = list.filter((c) => c.unread > 0)
    if (filter === 'ia') {
      list = list.filter((c) => {
        const l = matchLead(c.phone)
        return !!l && (l.score_ia != null || !!l.ia_summary)
      })
    }
    if (filter === 'agenda') {
      list = list.filter((c) => {
        const l = matchLead(c.phone)
        return !!l && (l.status === 'scheduled' || l.status === 'checked_in')
      })
    }
    if (q) {
      list = list.filter(
        (c) =>
          c.phone.toLowerCase().includes(q) ||
          (c.name ?? '').toLowerCase().includes(q) ||
          c.lastText.toLowerCase().includes(q),
      )
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, filter, search, leadByPhone])

  const handleCheckin = async (e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation()
    try {
      await updateLead.mutateAsync({ id: lead.id, updates: { status: 'checked_in' } })
      toast.success('Check-in registrado')
    } catch (err) {
      toast.error('Não foi possível registrar o check-in')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <header className="px-5 pt-3 pb-2 bg-white">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            className="grid place-items-center h-10 w-10 rounded-full bg-[#F3F4F6] text-ink"
            aria-label="Menu"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="grid place-items-center h-10 w-10 rounded-full bg-[#F3F4F6] text-ink"
              aria-label="Câmera"
            >
              <Camera className="h-5 w-5" />
            </button>
            <Link
              to="/kanban"
              className="grid place-items-center h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-[0_4px_12px_rgba(255,196,0,0.35)]"
              aria-label="Nova conversa"
            >
              <Plus className="h-5 w-5" strokeWidth={2.5} />
            </Link>
          </div>
        </div>

        <h1 className="text-[34px] leading-tight font-black tracking-tight text-ink">
          Conversas
        </h1>

        {/* Search */}
        <div className="mt-3 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            type="text"
            placeholder="Pesquise contatos ou mensagens"
            className="w-full h-12 pl-11 pr-4 rounded-2xl bg-[#F3F4F6] text-[15px] text-ink placeholder:text-gray-400 outline-none focus:bg-white focus:ring-2 focus:ring-primary/30 transition"
          />
        </div>

        {/* Filter chips */}
        <div className="mt-3 -mx-5 px-5 flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {FILTERS.map((f) => {
            const active = filter === f.key
            const Icon =
              f.key === 'ia' ? Brain : f.key === 'agenda' ? CalendarCheck : null
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                type="button"
                className={cn(
                  'shrink-0 inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[13px] font-bold border transition-all',
                  active
                    ? 'bg-primary/15 border-primary text-ink'
                    : 'bg-white border-[#E3E6EB] text-gray-600',
                )}
              >
                {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                {f.label}
              </button>
            )
          })}
        </div>
      </header>

      {/* Archived */}
      <button
        type="button"
        className="flex items-center gap-4 px-5 py-3 border-b border-[#F0F1F4] active:bg-gray-50"
      >
        <div className="h-10 w-10 grid place-items-center rounded-full text-gray-500">
          <Archive className="h-5 w-5" />
        </div>
        <span className="flex-1 text-left text-[15px] font-semibold text-ink">
          Arquivadas
        </span>
        <span className="text-xs font-bold text-gray-400">0</span>
      </button>

      {/* List */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {loading && (
          <div className="px-5 py-10 text-center text-xs text-gray-400 font-semibold">
            Carregando conversas...
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="px-5 py-10 text-center text-xs text-gray-400 font-medium">
            Nenhuma conversa encontrada.
          </div>
        )}

        <ul className="divide-y divide-[#F0F1F4]">
          {filtered.map((conv) => (
            <ConversationRow
              key={conv.phone}
              conv={conv}
              lead={matchLead(conv.phone)}
              onOpen={() =>
                navigate({ to: '/m/chat/$phone', params: { phone: conv.phone } })
              }
              onCheckin={handleCheckin}
            />
          ))}
        </ul>
      </div>

      {/* Bottom nav é fornecida pelo MobileShell (/m) — não duplicar aqui */}

    </div>
  )
}

function ConversationRow({
  conv,
  lead,
  onOpen,
  onCheckin,
}: {
  conv: WhatsAppConversation
  lead?: Lead
  onOpen: () => void
  onCheckin: (e: React.MouseEvent, lead: Lead) => void
}) {
  const initials = getContactInitials(conv.name, conv.phone)
  const displayName = lead?.full_name || conv.name || formatPhoneDisplay(conv.phone)
  const lastMsg = conv.messages[conv.messages.length - 1]
  const isOutgoing = lastMsg?.fromMe
  const preview = previewText(conv.lastText, lastMsg?.type)
  const isScheduled = lead?.status === 'scheduled'
  const hasAi = !!(lead && (lead.score_ia != null || lead.ia_summary))

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="w-full flex items-center gap-3 px-5 py-3 active:bg-gray-50 transition-colors"
      >
        <Avatar className="h-14 w-14 shrink-0 rounded-full border border-[#E8EAEE]">
          {conv.avatarUrl && (
            <AvatarImage src={conv.avatarUrl} alt={displayName} />
          )}
          <AvatarFallback className="bg-gradient-to-br from-[#FFF4CC] to-[#FFE07A] text-[#8a6900] font-black uppercase">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <h3 className="truncate font-bold text-[16px] text-ink">
                {displayName}
              </h3>
              {hasAi && (
                <Brain className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="Atendido pela IA" />
              )}
            </div>
            <span
              className={cn(
                'shrink-0 text-[12px] tabular-nums font-semibold',
                conv.unread > 0 ? 'text-primary' : 'text-gray-400',
              )}
            >
              {formatChatTime(conv.lastAt)}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            {isOutgoing && (
              <CheckCheck className="h-4 w-4 shrink-0 text-[#1FA463]" />
            )}
            <p
              className={cn(
                'flex-1 min-w-0 truncate text-[13.5px]',
                conv.unread > 0
                  ? 'text-ink font-semibold'
                  : 'text-gray-500 font-medium',
              )}
            >
              {preview}
            </p>
            {isScheduled && lead ? (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => onCheckin(e, lead)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onCheckin(e as unknown as React.MouseEvent, lead)
                }}
                className="shrink-0 inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-[#1FA463]/10 text-[#1FA463] text-[11px] font-black border border-[#1FA463]/30 active:scale-95 transition"
              >
                <LogIn className="h-3 w-3" /> Check-in
              </span>
            ) : conv.unread > 0 ? (
              <span className="shrink-0 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-black tabular-nums shadow-[0_2px_6px_rgba(255,196,0,0.45)]">
                {conv.unread > 99 ? '99+' : conv.unread}
              </span>
            ) : null}
          </div>
        </div>
      </button>
    </li>
  )
}

function BottomItem({
  to,
  icon,
  label,
  active,
  badge,
}: {
  to: string
  icon: React.ReactNode
  label: string
  active?: boolean
  badge?: number
}) {
  return (
    <li>
      <Link
        to={to}
        className={cn(
          'w-full flex flex-col items-center gap-1 py-1.5 rounded-2xl transition-colors',
          active ? 'text-ink' : 'text-gray-400',
        )}
      >
        <span
          className={cn(
            'relative grid place-items-center h-9 w-14 rounded-full transition-colors',
            active && 'bg-primary/15',
          )}
        >
          {icon}
          {badge && badge > 0 ? (
            <span className="absolute -top-1 right-1 min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-black">
              {badge > 99 ? '99+' : badge}
            </span>
          ) : null}
        </span>
        <span className="text-[10px] font-bold tracking-wide">{label}</span>
      </Link>
    </li>
  )
}

function previewText(text: string, type?: string): string {
  if (text && text.trim()) return text
  switch (type) {
    case 'image':
      return '📷 Foto'
    case 'audio':
    case 'ptt':
      return '🎤 Áudio'
    case 'video':
      return '🎬 Vídeo'
    case 'document':
      return '📄 Documento'
    case 'sticker':
      return '💟 Figurinha'
    default:
      return 'Mensagem'
  }
}

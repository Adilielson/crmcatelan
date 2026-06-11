import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import {
  Search,
  Plus,
  Camera,
  MoreHorizontal,
  Archive,
  Pin,
  Check,
  CheckCheck,
  Image as ImageIcon,
  Mic,
  FileText,
  RefreshCw,
  MessageSquare,
  Phone,
  Users,
  Bell,
  User,
} from 'lucide-react'
import {
  useWhatsAppChat,
  formatChatTime,
  formatPhoneDisplay,
  getContactInitials,
} from '@/hooks/use-whatsapp-chat'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/m/chat')({
  component: MobileChat,
})

type FilterKey = 'all' | 'unread' | 'favorites' | 'groups'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'unread', label: 'Não lidas' },
  { key: 'favorites', label: 'Favoritos' },
  { key: 'groups', label: 'Grupos' },
]

function MobileChat() {
  const navigate = useNavigate()
  const { conversations, loading } = useWhatsAppChat()
  const [filter, setFilter] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + c.unread, 0),
    [conversations],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = conversations
    if (filter === 'unread') list = list.filter((c) => c.unread > 0)
    if (q) {
      list = list.filter(
        (c) =>
          c.phone.toLowerCase().includes(q) ||
          (c.name ?? '').toLowerCase().includes(q) ||
          c.lastText.toLowerCase().includes(q),
      )
    }
    return list
  }, [conversations, filter, search])

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
            <button
              type="button"
              className="grid place-items-center h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-[0_4px_12px_rgba(255,196,0,0.35)]"
              aria-label="Nova conversa"
            >
              <Plus className="h-5 w-5" strokeWidth={2.5} />
            </button>
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
            const count =
              f.key === 'unread'
                ? totalUnread
                : f.key === 'all'
                ? conversations.length
                : 0
            const showCount = f.key === 'unread' && count > 0
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                type="button"
                className={cn(
                  'shrink-0 h-9 px-4 rounded-full text-[13px] font-bold border transition-all',
                  active
                    ? 'bg-primary/15 border-primary text-ink'
                    : 'bg-white border-[#E3E6EB] text-gray-600',
                )}
              >
                {f.label}
                {showCount && ` ${count}`}
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
          {filtered.map((conv) => {
            const initials = getContactInitials(conv.name, conv.phone)
            const displayName = conv.name || formatPhoneDisplay(conv.phone)
            const lastMsg = conv.messages[conv.messages.length - 1]
            const isOutgoing = lastMsg?.fromMe
            const preview = previewText(conv.lastText, lastMsg?.type)
            return (
              <li key={conv.phone}>
                <button
                  type="button"
                  onClick={() =>
                    navigate({ to: '/chat', search: { phone: conv.phone } })
                  }
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
                      <h3 className="truncate font-bold text-[16px] text-ink">
                        {displayName}
                      </h3>
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
                      {conv.unread > 0 ? (
                        <span className="shrink-0 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-black tabular-nums shadow-[0_2px_6px_rgba(255,196,0,0.45)]">
                          {conv.unread > 99 ? '99+' : conv.unread}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Bottom Nav */}
      <nav className="border-t border-[#E8EAEE] bg-white/95 backdrop-blur-md pb-[max(env(safe-area-inset-bottom),12px)] pt-2">
        <ul className="grid grid-cols-5 px-2">
          <BottomItem icon={<RefreshCw className="h-5 w-5" />} label="Atualizações" />
          <BottomItem icon={<Phone className="h-5 w-5" />} label="Ligações" />
          <BottomItem icon={<Users className="h-5 w-5" />} label="Comunidades" />
          <BottomItem
            icon={<MessageSquare className="h-5 w-5" />}
            label="Conversas"
            active
            badge={totalUnread}
          />
          <BottomItem icon={<User className="h-5 w-5" />} label="Você" />
        </ul>
      </nav>
    </div>
  )
}

function BottomItem({
  icon,
  label,
  active,
  badge,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
  badge?: number
}) {
  return (
    <li>
      <button
        type="button"
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
      </button>
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

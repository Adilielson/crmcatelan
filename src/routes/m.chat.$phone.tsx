import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  Phone as PhoneIcon,
  MoreVertical,
  Send,
  Mic,
  Square,
  Paperclip,
  Zap,
  UserCog,
  Info,
  Brain,
  CheckCheck,
  Check,
  Image as ImageIcon,
  X,
  LogIn,
  Bot,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import {
  useWhatsAppChat,
  formatChatTime,
  formatPhoneDisplay,
  getContactInitials,
  type WhatsAppMessage,
} from '@/hooks/use-whatsapp-chat'
import { useLeads, useUpdateLead, STAGES, type DBLead, type LeadStage } from '@/hooks/use-leads'
import { useWhatsApp } from '@/hooks/useWhatsApp'
import { useAuthStore } from '@/hooks/use-auth'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export const Route = createFileRoute('/m/chat/$phone')({
  component: MobileConversation,
})

const onlyDigits = (s: string) => s.replace(/\D+/g, '')

const QUICK_REPLIES = [
  'Olá! 👋 Como posso te ajudar?',
  'Posso te confirmar o horário? 📅',
  'Estamos aguardando você na loja!',
  'Obrigado pelo contato! Em breve retorno.',
  'Pode me enviar uma foto da receita? 📄',
]

const STAGE_COLORS: Record<LeadStage, string> = {
  open: 'bg-blue-100 text-blue-700 border-blue-300',
  in_progress: 'bg-amber-100 text-amber-700 border-amber-300',
  scheduled: 'bg-purple-100 text-purple-700 border-purple-300',
  checked_in: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  negotiating: 'bg-cyan-100 text-cyan-700 border-cyan-300',
  showed_up: 'bg-green-100 text-green-700 border-green-300',
  followup: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  no_show: 'bg-gray-200 text-gray-700 border-gray-300',
  lost: 'bg-red-100 text-red-700 border-red-300',
}

function MobileConversation() {
  const { phone } = Route.useParams()
  const navigate = useNavigate()
  const { tenant } = useAuthStore()
  const { conversations } = useWhatsAppChat()
  const { sendText, sendImage, sendAudio, isConnected } = useWhatsApp()
  const { data: leads = [] } = useLeads()
  const updateLead = useUpdateLead()

  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recStartedAt, setRecStartedAt] = useState<number | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [sheet, setSheet] = useState<'info' | 'transfer' | 'templates' | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const conv = useMemo(
    () => conversations.find((c) => c.phone === phone),
    [conversations, phone],
  )

  const lead: DBLead | undefined = useMemo(() => {
    const d = onlyDigits(phone).slice(-11)
    return leads.find(
      (l) => l.phone && (onlyDigits(l.phone).slice(-11) === d || onlyDigits(l.phone).slice(-10) === d.slice(-10)),
    )
  }, [leads, phone])

  // Atendentes disponíveis para transferência
  const attendantsQ = useQuery({
    queryKey: ['m-attendants', tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, avatar_url')
        .eq('tenant_id', tenant!.id)
        .eq('status', 'active')
      if (error) throw error
      return (data ?? []) as { id: string; full_name: string; role: string; avatar_url: string | null }[]
    },
  })

  // Auto-scroll para o final quando mensagens mudam
  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [conv?.messages.length])

  const displayName = lead?.full_name || conv?.name || formatPhoneDisplay(phone)
  const initials = getContactInitials(conv?.name ?? null, phone)
  const hasAi = !!(lead && (lead.score_ia != null || lead.ia_summary))

  const handleSendText = async () => {
    const text = draft.trim()
    if (!text) return
    setSending(true)
    try {
      await sendText(phone, text)
      setDraft('')
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSending(false)
    }
  }

  const handlePickImage = () => fileInputRef.current?.click()

  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !tenant?.id) return
    setSending(true)
    try {
      const path = `${tenant.id}/outbound/${Date.now()}-${file.name}`
      const { error: upErr } = await supabase.storage.from('whatsapp-media').upload(path, file)
      if (upErr) throw upErr
      const { data: signed } = await supabase.storage
        .from('whatsapp-media')
        .createSignedUrl(path, 60 * 60 * 24)
      if (!signed?.signedUrl) throw new Error('Falha ao gerar URL')
      await sendImage(phone, signed.signedUrl, undefined, file.type)
    } catch (err) {
      toast.error(String(err))
    } finally {
      setSending(false)
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      audioChunksRef.current = []
      mr.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data)
      }
      mr.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/ogg' })
        stream.getTracks().forEach((t) => t.stop())
        if (!tenant?.id) return
        try {
          const path = `${tenant.id}/outbound/${Date.now()}-audio.ogg`
          const { error: upErr } = await supabase.storage.from('whatsapp-media').upload(path, blob, { contentType: 'audio/ogg' })
          if (upErr) throw upErr
          const { data: signed } = await supabase.storage
            .from('whatsapp-media')
            .createSignedUrl(path, 60 * 60 * 24)
          if (!signed?.signedUrl) throw new Error('Falha ao gerar URL')
          await sendAudio(phone, signed.signedUrl, 'audio/ogg')
        } catch (err) {
          toast.error(String(err))
        }
      }
      mr.start()
      mediaRecorderRef.current = mr
      setRecording(true)
      setRecStartedAt(Date.now())
    } catch {
      toast.error('Não foi possível acessar o microfone.')
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
    setRecording(false)
    setRecStartedAt(null)
  }

  const changeStatus = async (status: LeadStage) => {
    if (!lead) {
      toast.error('Este contato não está vinculado a um lead.')
      return
    }
    try {
      await updateLead.mutateAsync({ id: lead.id, updates: { status } })
      toast.success(`Status: ${STAGES.find((s) => s.value === status)?.label}`)
    } catch {
      toast.error('Falha ao atualizar status')
    }
  }

  const handleTransfer = async (userId: string, name: string) => {
    if (!lead) {
      toast.error('Vincule a um lead primeiro.')
      return
    }
    try {
      await updateLead.mutateAsync({ id: lead.id, updates: { assigned_user_id: userId } })
      toast.success(`Transferido para ${name}`)
      setSheet(null)
    } catch {
      toast.error('Falha ao transferir')
    }
  }

  const insertTemplate = (text: string) => {
    setDraft((prev) => (prev ? prev + ' ' + text : text))
    setSheet(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#ECE5DD]">
      {/* Header */}
      <header className="shrink-0 bg-[#0E0E11] text-white">
        <div className="flex items-center gap-2 px-2 pt-3 pb-2 pl-[max(env(safe-area-inset-left),8px)]">
          <button
            onClick={() => navigate({ to: '/m/chat' })}
            className="grid place-items-center h-10 w-10 rounded-full active:bg-white/10"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setSheet('info')}
            className="flex-1 min-w-0 flex items-center gap-3 py-1 pr-2 text-left"
          >
            <Avatar className="h-10 w-10 shrink-0">
              {conv?.avatarUrl && <AvatarImage src={conv.avatarUrl} alt={displayName} />}
              <AvatarFallback className="bg-gradient-to-br from-[#FFC400] to-[#E0A500] text-[#1a1500] font-black text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="truncate font-bold text-[15px]">{displayName}</h2>
                {hasAi && <Brain className="h-3.5 w-3.5 text-primary shrink-0" />}
              </div>
              <p className="text-[11px] text-white/60 truncate">
                {isConnected ? 'online' : formatPhoneDisplay(phone)}
              </p>
            </div>
          </button>
          <button
            onClick={() => toast.info('Ligação em breve')}
            className="grid place-items-center h-10 w-10 rounded-full active:bg-white/10"
            aria-label="Ligar"
          >
            <PhoneIcon className="h-5 w-5" />
          </button>
          <button
            onClick={() => setSheet('info')}
            className="grid place-items-center h-10 w-10 rounded-full active:bg-white/10"
            aria-label="Mais"
          >
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>

        {/* Status pills (kanban) */}
        <div className="px-3 pb-2 -mx-1 flex gap-1.5 overflow-x-auto no-scrollbar">
          {STAGES.map((s) => {
            const active = lead?.status === s.value
            return (
              <button
                key={s.value}
                onClick={() => changeStatus(s.value)}
                className={cn(
                  'shrink-0 h-7 px-3 rounded-full text-[11px] font-black uppercase tracking-wider border transition-all',
                  active
                    ? 'bg-primary text-primary-foreground border-primary shadow-[0_2px_8px_rgba(255,196,0,0.4)]'
                    : 'bg-white/5 text-white/60 border-white/10 active:bg-white/15',
                )}
              >
                {s.label}
              </button>
            )
          })}
        </div>
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 0%, rgba(255,196,0,0.05), transparent 40%), radial-gradient(circle at 80% 100%, rgba(0,0,0,0.04), transparent 50%)',
        }}
      >
        {!conv || conv.messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-xs text-gray-500 bg-white/80 px-3 py-1.5 rounded-full">
              Nenhuma mensagem ainda
            </p>
          </div>
        ) : (
          conv.messages.map((m, i) => (
            <MessageBubble key={m.id} m={m} prev={conv.messages[i - 1]} />
          ))
        )}
      </div>

      {/* IA banner */}
      {hasAi && (
        <div className="shrink-0 bg-primary/15 border-t border-primary/30 px-4 py-2 flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <span className="text-[12px] font-bold text-ink flex-1">IA atendendo este lead</span>
          <button
            onClick={() => {
              if (lead) changeStatus('in_progress')
            }}
            className="text-[11px] font-black uppercase tracking-wider text-primary active:opacity-60"
          >
            Assumir
          </button>
        </div>
      )}

      {/* Composer */}
      <footer className="shrink-0 bg-[#F0F2F5] border-t border-[#D1D7DB] pb-[max(env(safe-area-inset-bottom),8px)]">
        {/* Quick actions bar */}
        <div className="flex items-center justify-around px-1 py-1 border-b border-black/5">
          <ComposerBtn icon={<Info className="h-4 w-4" />} label="Ficha" onClick={() => setSheet('info')} />
          <ComposerBtn icon={<UserCog className="h-4 w-4" />} label="Transferir" onClick={() => setSheet('transfer')} />
          <ComposerBtn icon={<Zap className="h-4 w-4" />} label="Templates" onClick={() => setSheet('templates')} />
          {lead?.status === 'scheduled' && (
            <ComposerBtn
              icon={<LogIn className="h-4 w-4" />}
              label="Check-in"
              onClick={() => changeStatus('checked_in')}
              highlight
            />
          )}
        </div>

        <div className="flex items-end gap-2 px-2 pt-2 pb-1">
          <button
            type="button"
            onClick={handlePickImage}
            className="grid place-items-center h-10 w-10 rounded-full text-gray-600 active:bg-black/5 shrink-0"
            disabled={sending || recording}
            aria-label="Anexar imagem"
          >
            <ImageIcon className="h-5 w-5" />
          </button>

          {recording ? (
            <div className="flex-1 h-11 rounded-full bg-red-50 border border-red-200 flex items-center gap-2 px-4">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
              <span className="text-sm font-bold text-red-600 tabular-nums">
                {recStartedAt ? `${Math.floor((Date.now() - recStartedAt) / 1000)}s` : '0s'} gravando…
              </span>
            </div>
          ) : (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendText()
                }
              }}
              rows={1}
              placeholder="Mensagem"
              className="flex-1 max-h-32 min-h-[44px] resize-none rounded-3xl bg-white border border-black/5 px-4 py-2.5 text-[15px] text-ink outline-none focus:ring-2 focus:ring-primary/30"
              disabled={sending}
            />
          )}

          {draft.trim() && !recording ? (
            <button
              type="button"
              onClick={handleSendText}
              disabled={sending}
              className="grid place-items-center h-11 w-11 rounded-full bg-primary text-primary-foreground shadow-[0_4px_12px_rgba(255,196,0,0.4)] active:scale-95 shrink-0 disabled:opacity-50"
              aria-label="Enviar"
            >
              <Send className="h-5 w-5" />
            </button>
          ) : recording ? (
            <button
              type="button"
              onClick={stopRecording}
              className="grid place-items-center h-11 w-11 rounded-full bg-red-500 text-white active:scale-95 shrink-0"
              aria-label="Parar gravação"
            >
              <Square className="h-5 w-5 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              className="grid place-items-center h-11 w-11 rounded-full bg-primary text-primary-foreground active:scale-95 shrink-0"
              aria-label="Gravar áudio"
            >
              <Mic className="h-5 w-5" />
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelected}
        />
      </footer>

      {/* Sheets */}
      <Sheet open={sheet !== null} onOpenChange={(o) => !o && setSheet(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto p-0">
          {sheet === 'info' && (
            <LeadInfoSheet lead={lead} phone={phone} displayName={displayName} />
          )}
          {sheet === 'transfer' && (
            <TransferSheet
              attendants={attendantsQ.data ?? []}
              loading={attendantsQ.isLoading}
              currentId={lead?.assigned_user_id ?? null}
              onPick={handleTransfer}
            />
          )}
          {sheet === 'templates' && (
            <TemplatesSheet onPick={insertTemplate} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function ComposerBtn({
  icon,
  label,
  onClick,
  highlight,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  highlight?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl active:bg-black/5 transition',
        highlight && 'bg-emerald-100 text-emerald-700',
      )}
    >
      <span className={cn(!highlight && 'text-gray-600')}>{icon}</span>
      <span className={cn('text-[10px] font-bold tracking-wide', !highlight && 'text-gray-700')}>
        {label}
      </span>
    </button>
  )
}

function MessageBubble({ m, prev }: { m: WhatsAppMessage; prev?: WhatsAppMessage }) {
  const showDay = !prev || !sameDay(prev.at, m.at)
  return (
    <>
      {showDay && (
        <div className="flex justify-center my-2">
          <span className="text-[11px] font-bold text-gray-600 bg-white/80 px-3 py-1 rounded-full shadow-sm">
            {dayLabel(m.at)}
          </span>
        </div>
      )}
      <div className={cn('flex', m.fromMe ? 'justify-end' : 'justify-start')}>
        <div
          className={cn(
            'max-w-[78%] rounded-2xl px-3 py-2 shadow-sm relative',
            m.fromMe
              ? 'bg-[#FFF6CC] text-ink rounded-br-md'
              : 'bg-white text-ink rounded-bl-md',
          )}
        >
          {(m.type === 'image' || m.mediaMime?.startsWith('image/')) && m.mediaUrl && (
            <img
              src={m.mediaUrl}
              alt=""
              className="rounded-lg mb-1 max-w-full max-h-64 object-cover"
            />
          )}
          {(m.type === 'audio' || m.type === 'ptt' || m.mediaMime?.startsWith('audio/')) && m.mediaUrl && (
            <audio src={m.mediaUrl} controls className="max-w-[240px] h-9" />
          )}
          {m.text && <p className="text-[14.5px] whitespace-pre-wrap break-words leading-snug">{m.text}</p>}
          <div className="flex items-center gap-1 justify-end mt-0.5">
            <span className="text-[10px] text-gray-500 tabular-nums">{formatChatTime(m.at)}</span>
            {m.fromMe && (
              m.status === 'failed' ? (
                <X className="h-3 w-3 text-red-500" />
              ) : (
                <CheckCheck className="h-3 w-3 text-[#1FA463]" />
              )
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function sameDay(a: string, b: string) {
  const da = new Date(a)
  const db = new Date(b)
  return da.toDateString() === db.toDateString()
}

function dayLabel(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Hoje'
  if (d.toDateString() === yesterday.toDateString()) return 'Ontem'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function LeadInfoSheet({
  lead,
  phone,
  displayName,
}: {
  lead?: DBLead
  phone: string
  displayName: string
}) {
  return (
    <div className="px-5 pt-3 pb-8">
      <div className="mx-auto w-12 h-1 rounded-full bg-gray-300 mb-4" />
      <SheetHeader className="text-left mb-4">
        <SheetTitle className="text-xl font-black">{displayName}</SheetTitle>
        <SheetDescription>{formatPhoneDisplay(phone)}</SheetDescription>
      </SheetHeader>

      {!lead ? (
        <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4 text-sm text-gray-600">
          Este contato ainda não está vinculado a um lead no CRM.
          <Link
            to="/kanban"
            className="block mt-2 text-primary font-bold underline"
          >
            Criar lead no kanban →
          </Link>
        </div>
      ) : (
        <LeadProfilePanel lead={lead} compact hideChat />
      )}
    </div>
  )
}

function TransferSheet({
  attendants,
  loading,
  currentId,
  onPick,
}: {
  attendants: { id: string; full_name: string; role: string; avatar_url: string | null }[]
  loading: boolean
  currentId: string | null
  onPick: (id: string, name: string) => void
}) {
  return (
    <div className="px-5 pt-3 pb-8">
      <div className="mx-auto w-12 h-1 rounded-full bg-gray-300 mb-4" />
      <SheetHeader className="text-left mb-4">
        <SheetTitle className="text-xl font-black">Transferir atendimento</SheetTitle>
        <SheetDescription>Escolha um responsável para este lead</SheetDescription>
      </SheetHeader>
      {loading && <p className="text-sm text-gray-500">Carregando atendentes…</p>}
      {!loading && attendants.length === 0 && (
        <p className="text-sm text-gray-500">Nenhum atendente disponível.</p>
      )}
      <ul className="space-y-2">
        {attendants.map((a) => {
          const active = a.id === currentId
          return (
            <li key={a.id}>
              <button
                onClick={() => onPick(a.id, a.full_name)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-2xl border transition',
                  active
                    ? 'bg-primary/10 border-primary'
                    : 'bg-white border-gray-200 active:bg-gray-50',
                )}
              >
                <Avatar className="h-11 w-11">
                  {a.avatar_url && <AvatarImage src={a.avatar_url} alt={a.full_name} />}
                  <AvatarFallback className="bg-gradient-to-br from-[#FFF4CC] to-[#FFE07A] text-[#8a6900] font-black text-xs">
                    {a.full_name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <p className="font-bold text-ink">{a.full_name}</p>
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider font-bold">{a.role}</p>
                </div>
                {active && <Check className="h-5 w-5 text-primary" />}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function TemplatesSheet({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="px-5 pt-3 pb-8">
      <div className="mx-auto w-12 h-1 rounded-full bg-gray-300 mb-4" />
      <SheetHeader className="text-left mb-4">
        <SheetTitle className="text-xl font-black">Respostas rápidas</SheetTitle>
        <SheetDescription>Toque para inserir no campo de mensagem</SheetDescription>
      </SheetHeader>
      <ul className="space-y-2">
        {QUICK_REPLIES.map((t) => (
          <li key={t}>
            <button
              onClick={() => onPick(t)}
              className="w-full text-left p-3 rounded-2xl bg-gray-50 border border-gray-200 active:bg-primary/10 active:border-primary text-sm font-medium text-ink"
            >
              {t}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { CheckCircle2, User, Send, PlusCircle, MessageSquare, Brain, Zap, RefreshCw, Search, MoreVertical, Smile, Mic, Image as ImageIcon, X, ChevronLeft, PanelRight, Hand, Bot, UserPlus, Flag, XCircle, Sparkles } from 'lucide-react'
import { useState, useRef, useEffect, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useIsMobile } from '@/hooks/use-mobile'
import { useLeads } from '@/hooks/use-leads'
import { useWhatsAppChat, formatChatTime, formatPhoneDisplay, getContactInitials } from '@/hooks/use-whatsapp-chat'
import { useWhatsApp } from '@/hooks/useWhatsApp'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from 'sonner'
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LeadProfilePanel } from '@/components/leads/LeadProfilePanel'
import { ChatQuickActionsBar } from '@/components/chat/ChatQuickActionsBar'
import { StageBadge } from '@/components/leads/StageBadge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useKanbanColumns } from '@/hooks/use-kanban-columns'
import { useAuthStore } from '@/hooks/use-auth'
import { supabase } from '@/integrations/supabase/client'
import { TransferLeadDialog } from '@/components/chat/TransferLeadDialog'
import { useServerFn } from '@tanstack/react-start'
import { analyzeLeadConversation, suggestReplyForLead } from '@/lib/ai-insights.functions'


export const Route = createFileRoute('/chat')({
  validateSearch: (search: Record<string, unknown>) => ({
    phone: typeof search.phone === 'string' ? search.phone : undefined,
  }),
  component: Chat,
})

function Chat() {
  const { phone: phoneFromUrl } = Route.useSearch()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { conversations, loading } = useWhatsAppChat()
  const { sendText, sendImage, sendAudio, isConnected: waConnected } = useWhatsApp()
  const { data: leads = [] } = useLeads()
  const qc = useQueryClient()
  const tenantId = useAuthStore((s) => s.tenant?.id ?? null)
  const currentUserId = useAuthStore((s) => s.user?.id ?? null)
  const { data: kanbanColumns = [] } = useKanbanColumns()

  const [activeTab, setActiveTab] = useState('ia')
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [recording, setRecording] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Tick a cada 60s para reavaliar o alerta de "aguardando atendente há 30min"
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])


  const onlyDigits = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '')

  // Sempre que a URL mudar (?phone=...), reespelha em selectedPhone — isso garante
  // que clicar em outro lead na Fila enquanto o chat já está aberto troca a conversa.
  useEffect(() => {
    if (phoneFromUrl) {
      setSelectedPhone(phoneFromUrl)
      return
    }
    // No mobile, NUNCA auto-seleciona: precisa mostrar a lista primeiro.
    if (isMobile) return
    if (!selectedPhone && conversations.length > 0) {
      setSelectedPhone(conversations[0].phone)
    }
  }, [phoneFromUrl, conversations, selectedPhone, isMobile])

  // Quando a URL perde o param `phone` (ex: clique no "voltar"), no mobile
  // limpa a seleção para reexibir a lista.
  useEffect(() => {
    if (isMobile && !phoneFromUrl) {
      setSelectedPhone(null)
    }
  }, [isMobile, phoneFromUrl])

  const handleBackToList = () => {
    setSelectedPhone(null)
    navigate({ to: '/chat', search: {} })
  }

  // Match tolerante: o WhatsApp grava só dígitos (5511…) e o lead pode estar como
  // "+55 11 …". Normaliza ambos os lados e aceita sufixo (mínimo 8 dígitos).
  const selectedConv = useMemo(() => {
    if (!selectedPhone) return null
    const target = onlyDigits(selectedPhone)
    if (!target) return null
    return (
      conversations.find((c) => onlyDigits(c.phone) === target) ||
      conversations.find((c) => {
        const d = onlyDigits(c.phone)
        return d.length >= 8 && (target.endsWith(d) || d.endsWith(target))
      }) ||
      null
    )
  }, [conversations, selectedPhone])

  const filteredConvs = useMemo(() => {
    const q = search.trim().toLowerCase()
    const onlyD = (s: string) => s.replace(/\D/g, '')
    return conversations.filter((c) => {
      if (q) {
        const matchSearch =
          c.phone.toLowerCase().includes(q) ||
          (c.name ?? '').toLowerCase().includes(q) ||
          c.lastText.toLowerCase().includes(q)
        if (!matchSearch) return false
      }
      if (statusFilter !== 'all') {
        const convDigits = onlyD(c.phone)
        const lead = leads.find((l) => {
          const ld = onlyD(l.phone ?? '')
          return ld.length >= 8 && (ld === convDigits || convDigits.endsWith(ld) || ld.endsWith(convDigits))
        })
        if (!lead) return false
        const col = kanbanColumns.find((k) => k.id === statusFilter)
        if (!col) return false
        if (col.is_system && col.system_key) {
          if (!(lead.custom_column_id == null && lead.status === col.system_key)) return false
        } else {
          if (lead.custom_column_id !== col.id) return false
        }
      }
      return true
    })
  }, [conversations, search, statusFilter, leads, kanbanColumns])

  // Casar o lead com o telefone selecionado (normalizando dígitos).
  // Se veio pela Fila (lead novo, sem conversa ainda), ainda assim achamos o lead.
  const currentLead = useMemo(() => {
    if (!selectedPhone) return leads[0]
    const target = onlyDigits(selectedPhone)
    return (
      leads.find((l) => onlyDigits(l.phone) === target) ||
      leads.find((l) => target.endsWith(onlyDigits(l.phone)) && onlyDigits(l.phone).length >= 8) ||
      leads[0]
    )
  }, [leads, selectedPhone])
  const isAiHandling = currentLead ? !currentLead.assigned_user_id : false

  const toggleAi = useMutation({
    mutationFn: async (takeOver: boolean) => {
      if (!currentLead) throw new Error('Lead não encontrado')
      const updates: Record<string, unknown> = takeOver
        ? { assigned_user_id: currentUserId, status: 'in_progress' }
        : { assigned_user_id: null }
      const { error } = await (supabase as any)
        .from('leads')
        .update(updates)
        .eq('id', currentLead.id)
      if (error) throw error
      return takeOver
    },
    onSuccess: (takeOver) => {
      qc.invalidateQueries({ queryKey: ['leads', tenantId] })
      toast.success(takeOver ? 'Você assumiu a conversa — IA pausada' : 'Conversa devolvida para a IA')
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao alternar atendimento'),
  })

  const moveToStatus = useMutation({
    mutationFn: async (systemKey: string) => {
      if (!currentLead) throw new Error('Lead não encontrado')
      const { error } = await (supabase as any)
        .from('leads')
        .update({ status: systemKey, custom_column_id: null })
        .eq('id', currentLead.id)
      if (error) throw error
      return systemKey
    },
    onSuccess: (key) => {
      qc.invalidateQueries({ queryKey: ['leads', tenantId] })
      toast.success(key === 'closed_won' ? 'Venda fechada!' : 'Lead movido')
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao mover lead'),
  })

  const analyzeFn = useServerFn(analyzeLeadConversation)
  const analyzeConv = useMutation({
    mutationFn: async () => {
      if (!currentLead) throw new Error('Lead não encontrado')
      return analyzeFn({ data: { leadId: currentLead.id } })
    },
    onSuccess: () => toast.success('Conversa analisada pela IA Sombra ✨'),
    onError: (e: any) => toast.error(e.message ?? 'Erro ao analisar conversa'),
  })

  const suggestFn = useServerFn(suggestReplyForLead)
  const suggestReply = useMutation({
    mutationFn: async () => {
      if (!currentLead) throw new Error('Lead não encontrado')
      return suggestFn({ data: { leadId: currentLead.id, hint: draft.trim() } })
    },
    onSuccess: (res: any) => {
      if (res?.suggestion) {
        setDraft(res.suggestion)
        toast.success('Sugestão pronta — edite e envie 💡')
      }
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao gerar sugestão'),
  })


  // Conversa "virtual" para leads vindos da Fila sem histórico de WhatsApp ainda:
  // garante que o chat abre com header + composer mesmo sem mensagens.
  const displayConv = useMemo(() => {
    if (selectedConv) return selectedConv
    if (!selectedPhone) return null
    return {
      phone: selectedPhone,
      name: currentLead?.full_name ?? null,
      avatarUrl: null,
      lastText: '',
      lastAt: new Date().toISOString(),
      unread: 0,
      messages: [],
    }
  }, [selectedConv, selectedPhone, currentLead])

  // Scroll para o fim quando mudar de conversa ou chegar nova mensagem
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [displayConv?.messages.length, selectedPhone])

  // OCR real agora vive no painel do lead (aba "Lead" / Kanban).


  // Auto-análise da IA SDR quando um lead é selecionado (cooldown 10min, best-effort)
  const lastAnalyzedRef = useRef<Map<string, number>>(new Map())
  useEffect(() => {
    if (!currentLead?.id) return
    const last = lastAnalyzedRef.current.get(currentLead.id) ?? 0
    if (Date.now() - last < 10 * 60 * 1000) return
    lastAnalyzedRef.current.set(currentLead.id, Date.now())
    analyzeFn({ data: { leadId: currentLead.id } })
      .then(() => qc.invalidateQueries({ queryKey: ['leads', tenantId] }))
      .catch(() => { /* silencia: análise é best-effort */ })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLead?.id])


  const handleSend = async () => {
    if (!draft.trim() || !selectedPhone) return
    if (!waConnected) { toast.error('WhatsApp não está conectado.'); return }
    setSending(true)
    try {
      await sendText(selectedPhone, draft.trim())
      setDraft('')
      toast.success('Mensagem enviada')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar')
    } finally {
      setSending(false)
    }
  }

  // Lê arquivo como data URL, com downscale para imagens (máx 1280px)
  const fileToDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => {
      const result = String(reader.result || '')
      if (!file.type.startsWith('image/')) return resolve(result)
      const img = new Image()
      img.onload = () => {
        const MAX = 1280
        const scale = Math.min(1, MAX / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve(result)
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.onerror = () => resolve(result)
      img.src = result
    }
    reader.readAsDataURL(file)
  })

  const handlePickFile = () => fileInputRef.current?.click()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !selectedPhone) return
    if (!waConnected) { toast.error('WhatsApp não está conectado.'); return }
    if (!file.type.startsWith('image/')) { toast.error('Apenas imagens por enquanto.'); return }
    setSending(true)
    try {
      const dataUrl = await fileToDataUrl(file)
      await sendImage(selectedPhone, dataUrl, draft.trim() || undefined, 'image/jpeg')
      setDraft('')
      toast.success('Imagem enviada')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar imagem')
    } finally {
      setSending(false)
    }
  }

  const startRecording = async () => {
    if (!selectedPhone) return
    if (!waConnected) { toast.error('WhatsApp não está conectado.'); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeCandidates = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
      const mime = mimeCandidates.find((m) => (window as any).MediaRecorder?.isTypeSupported?.(m)) || ''
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      audioChunksRef.current = []
      mr.ondataavailable = (ev) => { if (ev.data.size > 0) audioChunksRef.current.push(ev.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || 'audio/webm' })
        if (blob.size === 0) return
        if (blob.size > 5_000_000) { toast.error('Áudio muito longo (máx ~1min).'); return }
        const reader = new FileReader()
        reader.onload = async () => {
          const dataUrl = String(reader.result || '')
          setSending(true)
          try {
            await sendAudio(selectedPhone, dataUrl, blob.type)
            toast.success('Áudio enviado')
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Erro ao enviar áudio')
          } finally {
            setSending(false)
          }
        }
        reader.readAsDataURL(blob)
      }
      mediaRecorderRef.current = mr
      mr.start()
      setRecording(true)
    } catch (err) {
      toast.error('Não foi possível acessar o microfone.')
      console.error(err)
    }
  }

  const stopRecording = () => {
    const mr = mediaRecorderRef.current
    if (mr && mr.state !== 'inactive') mr.stop()
    setRecording(false)
  }

  const cancelRecording = () => {
    const mr = mediaRecorderRef.current
    if (mr && mr.state !== 'inactive') {
      audioChunksRef.current = []
      mr.onstop = null as unknown as () => void
      mr.stop()
      mr.stream.getTracks().forEach((t) => t.stop())
    }
    setRecording(false)
  }

  const hasSelection = !!selectedPhone

  const insightsPanel = (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col h-full">
      <TabsList className="w-full justify-start rounded-none border-b border-gray-100 bg-white h-[73px] px-4 gap-2">
        <TabsTrigger value="ia" className="h-10 data-[state=active]:bg-primary/5 data-[state=active]:text-primary rounded-xl px-4 text-xs font-bold font-jakarta transition-all border border-transparent data-[state=active]:border-primary/10">
          <Brain className="w-4 h-4 mr-2" /> SDR Insight
        </TabsTrigger>
        <TabsTrigger value="lead" className="h-10 data-[state=active]:bg-primary/5 data-[state=active]:text-primary rounded-xl px-4 text-xs font-bold font-jakarta transition-all border border-transparent data-[state=active]:border-primary/10">
          <User className="w-4 h-4 mr-2" /> Perfil
        </TabsTrigger>
      </TabsList>

      <ScrollArea className="flex-1">
        <div className="p-6">
          <TabsContent value="ia" className="m-0 space-y-8 outline-none">
            {currentLead ? (
              <>
                <div className="bg-gray-50/50 rounded-2xl p-5 border border-gray-100 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Temperatura Lead</span>
                    <Badge className={cn(
                      "px-2.5 py-1 rounded-lg border-none text-[11px] font-bold",
                      (currentLead.score_ia ?? 0) > 70 ? "bg-success text-white" : "bg-primary text-primary-foreground"
                    )}>
                      {currentLead.score_ia ?? 0}/100
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-gray-500">Sentimento: <span className="text-ink capitalize">{currentLead.ia_sentimento || 'Aguardando análise…'}</span></span>
                      <span className="text-gray-500">Urgência: <span className="text-danger capitalize">{currentLead.ia_urgencia || '—'}</span></span>
                    </div>
                    <Progress value={currentLead.score_ia ?? 0} className="h-2 bg-gray-200" />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-primary">
                    <Brain className="w-4 h-4" />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">Resumo da IA SDR</h3>
                  </div>
                  <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm relative overflow-hidden group">
                    <p className="text-sm text-ink leading-relaxed font-medium relative z-10">
                      {currentLead.ia_summary || 'Aguardando análise da conversa…'}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 px-1">Gatilhos Detectados</h3>
                  <div className="flex flex-wrap gap-2">
                    {(currentLead.ia_interesses && currentLead.ia_interesses.length > 0) ? (
                      currentLead.ia_interesses.map((tag, i) => (
                        <Badge key={i} variant="secondary" className="bg-gray-50 text-ink border border-gray-100 font-bold px-3 py-1.5 rounded-xl text-xs">
                          {tag}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-gray-400 font-medium italic">Aguardando análise…</span>
                    )}
                  </div>
                </div>

              </>
            ) : (
              <div className="text-center py-20 opacity-20">
                <Brain className="w-12 h-12 mx-auto mb-4" />
                <p className="font-bold text-sm">Selecione um lead para ver insights</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="lead" className="m-0 outline-none">
            {currentLead ? (
              <LeadProfilePanel lead={currentLead} compact hideChat />
            ) : (
              <div className="text-center py-20 opacity-30">
                <User className="w-12 h-12 mx-auto mb-4" />
                <p className="font-bold text-sm">Nenhum lead vinculado a esta conversa</p>
              </div>
            )}
          </TabsContent>
        </div>
      </ScrollArea>
    </Tabs>
  )

  return (
    <div className="bg-white border border-[#E3E6EB] rounded-[24px] h-[calc(100vh-160px)] flex overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] animate-in fade-in duration-700">



      {/* Coluna 1: Lista de Sessões */}
      <div className={cn(
        "w-full md:w-[360px] md:flex-shrink-0 border-r border-[#E3E6EB] flex-col bg-gray-50/50",
        hasSelection ? "hidden md:flex" : "flex",
      )}>

        <div className="p-6 border-b border-[#E3E6EB] bg-white flex justify-between items-center h-20 gap-3">
          <h2 className="font-jakarta font-black text-xl text-ink tracking-tight uppercase tracking-wider">Conversas</h2>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-10 w-[150px] rounded-xl bg-gray-50 border-transparent text-xs font-bold uppercase">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {kanbanColumns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                    {c.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="p-5 bg-white">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-colors group-focus-within:text-primary" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar contatos..."
              className="w-full bg-[#F6F7F9] border border-transparent rounded-[16px] pl-12 pr-4 py-3.5 text-sm focus:bg-white focus:border-primary/30 transition-all outline-none text-ink font-bold placeholder:text-gray-400 shadow-inner"
            />
          </div>
        </div>


        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 mobile-no-scrollbar thin-scrollbar">
          <div className="flex flex-col w-full max-w-full">
            {loading && (
              <div className="p-8 text-center text-xs text-gray-400 font-bold">Carregando conversas...</div>
            )}
            {!loading && filteredConvs.length === 0 && (
              <div className="p-8 text-center text-xs text-gray-400 font-medium">
                {waConnected
                  ? 'Nenhuma mensagem recebida ainda. Aguardando WhatsApp...'
                  : 'WhatsApp desconectado. Conecte em Configurações.'}
              </div>
            )}
            {filteredConvs.map((conv) => {
              const initials = getContactInitials(conv.name, conv.phone)
              const isActive = selectedPhone === conv.phone
              const displayName = conv.name || formatPhoneDisplay(conv.phone)
              const convDigits = conv.phone.replace(/\D/g, '')
              const convLead = leads.find((l) => {
                const ld = (l.phone ?? '').replace(/\D/g, '')
                return ld.length >= 8 && (ld === convDigits || convDigits.endsWith(ld) || ld.endsWith(convDigits))
              })
              // Alerta: última mensagem é do cliente e está sem resposta há > 30min
              const lastMsg = conv.messages.length > 0 ? conv.messages[conv.messages.length - 1] : null
              const lastClientMsg = [...conv.messages].reverse().find((m) => !m.fromMe)
              const isAwaitingReply = !!lastMsg && !lastMsg.fromMe
              const waitingMinutes = lastClientMsg
                ? Math.floor((Date.now() - new Date(lastClientMsg.at).getTime()) / 60000)
                : 0
              const showStaleAlert = isAwaitingReply && waitingMinutes >= 30
              return (
                <div
                  key={conv.phone}
                  onClick={() => setSelectedPhone(conv.phone)}
                  className={cn(
                    "p-5 pr-6 md:pr-5 border-b border-[#E3E6EB]/50 cursor-pointer transition-all flex gap-4 relative hover:bg-white group",
                    isActive ? "bg-white shadow-[0_4px_20px_rgba(0,0,0,0.03)] z-10" : "opacity-80 hover:opacity-100",
                    showStaleAlert && !isActive && "bg-danger/5"
                  )}
                >
                  {isActive && (
                    <div className="absolute left-0 top-3 bottom-3 w-1.5 bg-[#FFC400] rounded-r-full shadow-[0_0_10px_rgba(255,196,0,0.3)]" />
                  )}
                  {showStaleAlert && (
                    <div
                      title={`Aguardando resposta há ${waitingMinutes >= 60 ? `${Math.floor(waitingMinutes / 60)}h` : `${waitingMinutes}min`}`}
                      className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-danger/10 border border-danger/30 animate-pulse"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-danger" />
                      <span className="text-[9px] font-bold text-danger uppercase tracking-wider">
                        {waitingMinutes >= 60 ? `${Math.floor(waitingMinutes / 60)}h` : `${waitingMinutes}min`}
                      </span>
                    </div>
                  )}
                  <div className="relative flex-shrink-0">
                    <Avatar className="h-14 w-14 rounded-full shadow-sm">
                      {conv.avatarUrl && <AvatarImage src={conv.avatarUrl} alt={displayName} />}
                      <AvatarFallback className="bg-gradient-to-br from-[#F6F7F9] to-[#E3E6EB] text-[#A7ADB8] font-black uppercase text-base rounded-full">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#1FA463] border-[3px] border-white rounded-full"></div>
                  </div>

                  <div className="flex-1 min-w-0 py-0.5">
                    <div className="flex justify-between items-center mb-0.5">
                      <h4 className="font-jakarta font-bold text-sm text-ink truncate group-hover:text-primary transition-colors">
                        {displayName}
                      </h4>
                      <span className="text-[10px] font-semibold text-gray-400 tabular-nums">
                        {formatChatTime(conv.lastAt)}
                      </span>
                    </div>
                    {conv.name && (
                      <p className="text-[10px] font-semibold text-gray-400 truncate mb-0.5">
                        {formatPhoneDisplay(conv.phone)}
                      </p>
                    )}
                    {convLead?.status && (
                      <div className="mb-1">
                        <StageBadge stage={convLead.status} size="xs" />
                      </div>
                    )}
                    <div className="flex justify-between items-center gap-2">
                      <p className={cn(
                        "text-xs truncate font-medium flex-1",
                        conv.unread > 0 ? "text-ink" : "text-gray-500"
                      )}>
                        {conv.lastText}
                      </p>
                      {conv.unread > 0 && (
                        <span className="flex-shrink-0 bg-primary text-primary-foreground text-[10px] h-5 min-w-[20px] px-1.5 flex items-center justify-center rounded-full font-bold shadow-sm shadow-primary/20">
                          {conv.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Coluna 2: Chat principal */}
      <div className={cn(
        "flex-1 flex-col bg-white relative min-w-0",
        hasSelection ? "flex" : "hidden md:flex",
      )}>
        {displayConv ? (
          <>
            <div className="p-4 sm:p-6 border-b border-[#E3E6EB] flex justify-between items-center bg-white/90 backdrop-blur-xl z-20 h-20 gap-2">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-xl md:hidden flex-shrink-0"
                  onClick={handleBackToList}
                  title="Voltar"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <Avatar className="h-12 w-12 border-2 border-[#F6F7F9] shadow-sm rounded-[16px] flex-shrink-0">
                  {displayConv.avatarUrl && <AvatarImage src={displayConv.avatarUrl} alt={displayConv.name ?? displayConv.phone} />}

                  <AvatarFallback className="bg-[#F6F7F9] text-[#A7ADB8] font-black">
                    {getContactInitials(displayConv.name, displayConv.phone)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <h3 className="font-jakarta font-black text-base text-ink tracking-tight truncate">
                    {displayConv.name || formatPhoneDisplay(displayConv.phone)}
                  </h3>
                  {displayConv.name && (
                    <p className="text-[11px] text-gray-400 font-semibold truncate">{formatPhoneDisplay(displayConv.phone)}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-[#A7ADB8] hover:text-[#FFC400] hover:bg-[#FFC400]/10 rounded-xl transition-all xl:hidden"
                  onClick={() => setDetailsOpen(true)}
                  title="Ver ficha do lead"
                >
                  <PanelRight className="w-5 h-5" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-10 w-10 text-[#A7ADB8] hover:text-ink hover:bg-gray-100 rounded-xl transition-all">
                      <MoreVertical className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem
                      onClick={() => toggleAi.mutate(isAiHandling)}
                      disabled={!currentLead || toggleAi.isPending}
                    >
                      {isAiHandling ? (
                        <>
                          <Hand className="mr-2 h-4 w-4 text-primary" />
                          <span>Assumir conversa</span>
                        </>
                      ) : (
                        <>
                          <Bot className="mr-2 h-4 w-4 text-amber-500" />
                          <span>Devolver para IA</span>
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setTransferOpen(true)}
                      disabled={!currentLead}
                    >
                      <UserPlus className="mr-2 h-4 w-4 text-primary" />
                      <span>Transferir atendimento</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => moveToStatus.mutate('closed_won')}
                      disabled={!currentLead || moveToStatus.isPending}
                    >
                      <Flag className="mr-2 h-4 w-4 text-emerald-500" />
                      <span>Marcar como Venda Fechada</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => moveToStatus.mutate('lost')}
                      disabled={!currentLead || moveToStatus.isPending}
                    >
                      <XCircle className="mr-2 h-4 w-4 text-red-500" />
                      <span>Marcar como Perdido</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => analyzeConv.mutate()}
                      disabled={!currentLead || analyzeConv.isPending}
                    >
                      <Sparkles className="mr-2 h-4 w-4 text-violet-500" />
                      <span>{analyzeConv.isPending ? 'Analisando…' : 'Analisar com IA (sombra)'}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {currentLead && (
              <ChatQuickActionsBar lead={currentLead} />
            )}


            <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden bg-gray-50/50 mobile-no-scrollbar thin-scrollbar">
              <div className="p-8 space-y-4 min-h-full">
                {displayConv.messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center text-center py-16 opacity-70">
                    <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4">
                      <MessageSquare className="w-7 h-7 text-primary/40" />
                    </div>
                    <p className="text-sm font-bold text-ink mb-1">Nenhuma mensagem ainda</p>
                    <p className="text-xs text-gray-500 max-w-xs">
                      Envie a primeira mensagem para iniciar a conversa com este lead.
                    </p>
                  </div>
                )}
                {displayConv.messages.map((m) => {
                  const isImage = m.mediaUrl && (m.mediaMime?.startsWith('image/') || m.type === 'image')
                  const isAudio = m.mediaUrl && (m.mediaMime?.startsWith('audio/') || m.type === 'audio' || m.type === 'ptt')
                  const isVideo = m.mediaUrl && (m.mediaMime?.startsWith('video/') || m.type === 'video')
                  return (
                  <div key={m.id} className={cn("flex", m.fromMe ? "justify-end" : "justify-start")}>
                    <div className="max-w-[70%]">
                      <div className={cn(
                        "p-2 rounded-2xl shadow-sm overflow-hidden",
                        m.fromMe
                          ? "bg-primary text-primary-foreground rounded-tr-none shadow-primary/10"
                          : "bg-white border border-gray-100 rounded-tl-none"
                      )}>
                        {isImage && (
                          <a href={m.mediaUrl!} target="_blank" rel="noreferrer" className="block">
                            <img src={m.mediaUrl!} alt="imagem" className="rounded-xl max-h-72 object-cover" />
                          </a>
                        )}
                        {isAudio && (
                          <audio controls src={m.mediaUrl!} className="w-64 max-w-full" />
                        )}
                        {isVideo && (
                          <video controls src={m.mediaUrl!} className="rounded-xl max-h-72" />
                        )}
                        {(m.text || (!isImage && !isAudio && !isVideo)) && (
                          <p className={cn(
                            "text-sm leading-relaxed font-medium whitespace-pre-wrap break-words pl-2.5 pr-3.5 py-1.5",
                            m.fromMe ? "text-primary-foreground font-bold" : "text-ink"
                          )}>
                            {m.text || <span className="italic opacity-60">[{m.type}]</span>}
                          </p>
                        )}
                      </div>
                      <div className={cn(
                        "mt-1.5 flex items-center gap-1.5",
                        m.fromMe ? "justify-end mr-1" : "ml-1"
                      )}>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{formatChatTime(m.at)}</span>
                        {m.fromMe && (
                          m.status === 'failed'
                            ? <span className="text-[10px] text-red-500 font-bold">FALHOU</span>
                            : <CheckCircle2 className="w-3 h-3 text-success" />
                        )}
                      </div>
                    </div>
                  </div>
                  )
                })}
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-white">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              {recording ? (
                <div className="flex gap-2 items-center bg-red-50 border border-red-200 p-3 rounded-2xl">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                    <span className="text-sm font-bold text-red-600">Gravando áudio...</span>
                  </div>
                  <Button onClick={cancelRecording} variant="ghost" size="icon" className="h-10 w-10 text-red-500 hover:bg-red-100 rounded-xl">
                    <X className="w-5 h-5" />
                  </Button>
                  <Button onClick={stopRecording} className="h-10 w-10 rounded-xl bg-red-500 hover:bg-red-600 text-white">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2 items-center">
                  <div className="flex-1 flex gap-2 bg-gray-50 p-2 rounded-2xl border border-gray-100 focus-within:bg-white focus-within:border-primary/30 focus-within:shadow-sm transition-all items-center">
                    <Button variant="ghost" size="icon" className="text-gray-400 h-9 w-9 hover:text-primary hover:bg-primary/5 rounded-xl">
                      <Smile className="w-5 h-5" />
                    </Button>
                    <Button
                      onClick={handlePickFile}
                      disabled={!waConnected || sending}
                      variant="ghost"
                      size="icon"
                      className="text-gray-400 h-9 w-9 hover:text-primary hover:bg-primary/5 rounded-xl"
                      title="Anexar imagem"
                    >
                      <ImageIcon className="w-5 h-5" />
                    </Button>
                    <Button
                      onClick={() => suggestReply.mutate()}
                      disabled={!waConnected || sending || suggestReply.isPending || !currentLead}
                      variant="ghost"
                      size="icon"
                      className="text-violet-500 h-9 w-9 hover:text-violet-600 hover:bg-violet-50 rounded-xl"
                      title={draft.trim() ? 'Refinar com IA (usa seu texto como direcionamento)' : 'Sugerir resposta com IA'}
                    >
                      {suggestReply.isPending ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                    </Button>
                    <input
                      type="text"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                      placeholder={waConnected ? (suggestReply.isPending ? 'IA está pensando uma sugestão...' : 'Digite sua mensagem...') : 'WhatsApp desconectado'}
                      disabled={!waConnected || sending}
                      className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-1.5 text-ink font-medium placeholder:text-gray-400 outline-none disabled:opacity-50"
                    />
                  </div>
                  {draft.trim() ? (
                    <Button
                      onClick={handleSend}
                      disabled={sending || !waConnected}
                      className="h-12 w-12 rounded-2xl bg-primary hover:bg-yellow-bright text-primary-foreground shadow-lg shadow-primary/20 transition-all flex-shrink-0 disabled:opacity-40"
                    >
                      {sending ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    </Button>
                  ) : (
                    <Button
                      onClick={startRecording}
                      disabled={!waConnected || sending}
                      className="h-12 w-12 rounded-2xl bg-primary hover:bg-yellow-bright text-primary-foreground shadow-lg shadow-primary/20 transition-all flex-shrink-0 disabled:opacity-40"
                      title="Gravar áudio"
                    >
                      <Mic className="w-5 h-5" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-gray-50/50 p-12 text-center">
            <div className="w-20 h-20 bg-white rounded-3xl shadow-sm flex items-center justify-center mb-6">
              <MessageSquare className="w-10 h-10 text-primary/40" />
            </div>
            <h3 className="font-jakarta font-bold text-xl text-ink mb-2">Bem-vindo ao Chat SDR</h3>
            <p className="text-gray-500 text-sm max-w-xs leading-relaxed mb-8">
              Selecione uma conversa ao lado para visualizar os detalhes e insights da IA.
            </p>
            <Button className="rounded-xl h-12 px-6 font-bold shadow-sm">
              <PlusCircle className="w-5 h-5 mr-2" /> Iniciar Novo Atendimento
            </Button>
          </div>
        )}
      </div>

      {/* Coluna 3: SDR Insights — visível só em xl+ */}
      <div className="hidden xl:flex w-[340px] flex-shrink-0 border-l border-gray-100 bg-white overflow-hidden flex-col">
        {insightsPanel}
      </div>

      {/* Sheet de detalhes em < xl */}
      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="px-6 pt-6">
            <SheetTitle>Ficha do Lead</SheetTitle>
          </SheetHeader>
          <div className="flex-1 min-h-0 flex flex-col">
            {insightsPanel}
          </div>
        </SheetContent>
      </Sheet>

      {/* Transferir atendimento */}
      <TransferLeadDialog
        lead={transferOpen && currentLead ? currentLead : null}
        open={transferOpen}
        onOpenChange={setTransferOpen}
      />
    </div>
  )
}

export default Chat;

import { createFileRoute } from '@tanstack/react-router'
import { CheckCircle2, User, Send, Phone, PlusCircle, MessageSquare, Brain, Zap, FileText, RefreshCw, Search, Paperclip, MoreVertical, Smile, Users, UserPlus, Wifi, WifiOff, Mic, Square, Image as ImageIcon, X } from 'lucide-react'
import { useState, useRef, useEffect, useMemo } from 'react'
import { useLeads, useUpdateLead } from '@/hooks/use-leads'
import { useWhatsAppChat, formatChatTime, formatPhoneDisplay, getContactInitials } from '@/hooks/use-whatsapp-chat'
import { useWhatsApp } from '@/hooks/useWhatsApp'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from 'sonner'
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { LeadProfilePanel } from '@/components/leads/LeadProfilePanel'

export const Route = createFileRoute('/chat')({
  validateSearch: (search: Record<string, unknown>) => ({
    phone: typeof search.phone === 'string' ? search.phone : undefined,
  }),
  component: Chat,
})

function Chat() {
  const { phone: phoneFromUrl } = Route.useSearch()
  const { conversations, loading } = useWhatsAppChat()
  const { sendText, sendImage, sendAudio, isConnected: waConnected } = useWhatsApp()
  const { data: leads = [] } = useLeads()
  const updateLeadMutation = useUpdateLead()
  const [activeTab, setActiveTab] = useState('ia')
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [recording, setRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-seleciona a primeira conversa ou a que vier pela URL
  useEffect(() => {
    if (selectedPhone) return
    if (phoneFromUrl) { setSelectedPhone(phoneFromUrl); return }
    if (conversations.length > 0) setSelectedPhone(conversations[0].phone)
  }, [conversations, phoneFromUrl, selectedPhone])

  const selectedConv = useMemo(
    () => conversations.find((c) => c.phone === selectedPhone) ?? null,
    [conversations, selectedPhone]
  )

  const filteredConvs = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter((c) =>
      c.phone.toLowerCase().includes(q) ||
      (c.name ?? '').toLowerCase().includes(q) ||
      c.lastText.toLowerCase().includes(q)
    )
  }, [conversations, search])

  // Casar o lead com o telefone da conversa selecionada (normalizando dígitos)
  const currentLead = useMemo(() => {
    if (!selectedPhone) return leads[0]
    const onlyDigits = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '')
    const target = onlyDigits(selectedPhone)
    return (
      leads.find((l) => onlyDigits(l.phone) === target) ||
      leads.find((l) => target.endsWith(onlyDigits(l.phone)) && onlyDigits(l.phone).length >= 8) ||
      leads[0]
    )
  }, [leads, selectedPhone])

  // Scroll para o fim quando mudar de conversa ou chegar nova mensagem
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [selectedConv?.messages.length, selectedPhone])

  const [isOcrProcessing, setIsOcrProcessing] = useState(false)

  const handleSimulateOCR = () => {
    setIsOcrProcessing(true)
    toast.loading("Processando receita via OCR...")
    setTimeout(() => {
      if (currentLead) {
        updateLeadMutation.mutate({
          id: currentLead.id,
          updates: {
            ia_receita_validade: '2027-05-20',
            ia_receita_grau: 'OD: -2.00 / OE: -1.75',
            ia_interesses: [...(currentLead.ia_interesses ?? []), 'Lentes com Filtro Azul'],
            ia_tags: [...(currentLead.ia_tags ?? []), 'Receita Digitalizada'],
          },
        })
        toast.dismiss()
        toast.success("Receita processada com sucesso!")
      }
      setIsOcrProcessing(false)
    }, 2000)
  }

  const handleRecalibrateIA = () => {
    toast.promise(new Promise(resolve => setTimeout(resolve, 1500)), {
      loading: 'Recalibrando modelo SDR para esta conversa...',
      success: 'IA Recalibrada! Interpretação ajustada.',
      error: 'Erro na recalibração.'
    })
  }

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

  const [isRoutingOpen, setIsRoutingOpen] = useState(false)

  return (
    <div className="bg-white border border-[#E3E6EB] rounded-[24px] h-[calc(100vh-160px)] flex overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] animate-in fade-in duration-700">
      <Dialog open={isRoutingOpen} onOpenChange={setIsRoutingOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Encaminhar Conversa
            </DialogTitle>
            <DialogDescription>
              Selecione o destino ou aplique uma regra de roteamento automático.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-gray-400">Regras de Roteamento</h4>
              <div className="grid grid-cols-1 gap-2">
                <Button 
                  variant="outline" 
                  className="justify-start h-auto py-3 px-4 border-gray-100 hover:border-primary/30 hover:bg-primary/5 group"
                  onClick={() => {
                    toast.success("Regra 'Fila Circular' aplicada")
                    setIsRoutingOpen(false)
                  }}
                >
                  <div className="text-left">
                    <p className="text-sm font-bold text-ink group-hover:text-primary">Próximo Disponível (Fila)</p>
                    <p className="text-[10px] text-gray-400 font-medium">Distribuição igualitária entre vendedores online.</p>
                  </div>
                </Button>
                <Button 
                  variant="outline" 
                  className="justify-start h-auto py-3 px-4 border-gray-100 hover:border-primary/30 hover:bg-primary/5 group"
                  onClick={() => {
                    toast.success("Encaminhado por Especialidade: Lentes")
                    setIsRoutingOpen(false)
                  }}
                >
                  <div className="text-left">
                    <p className="text-sm font-bold text-ink group-hover:text-primary">Especialista em Lentes</p>
                    <p className="text-[10px] text-gray-400 font-medium">Encaminhar para equipe técnica de laboratório.</p>
                  </div>
                </Button>
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-gray-400">Encaminhamento Direto</h4>
              <div className="space-y-2">
                <Select>
                  <SelectTrigger className="w-full h-12 rounded-xl border-gray-100 font-bold text-xs">
                    <SelectValue placeholder="Selecionar Atendente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vendedor-1">Carlos (Vendas Sul)</SelectItem>
                    <SelectItem value="vendedor-2">Ana (Vendas Centro)</SelectItem>
                    <SelectItem value="gerente">Roberto (Gerente)</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  className="w-full h-12 bg-primary hover:bg-yellow-bright text-primary-foreground font-black text-xs rounded-xl shadow-lg shadow-primary/20"
                  onClick={() => {
                    toast.success("Conversa encaminhada com sucesso")
                    setIsRoutingOpen(false)
                  }}
                >
                  CONFIRMAR TRANSFERÊNCIA
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Coluna 1: Lista de Sessões */}
      <div className="w-[360px] border-r border-[#E3E6EB] flex flex-col bg-gray-50/50">
        <div className="p-6 border-b border-[#E3E6EB] bg-white flex justify-between items-center h-20">
          <h2 className="font-jakarta font-black text-xl text-ink tracking-tight uppercase tracking-wider">Conversas</h2>
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl bg-gray-50 hover:bg-[#FFC400]/10 hover:text-[#FFC400] transition-all">
            <PlusCircle className="w-5 h-5" />
          </Button>
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

        <ScrollArea className="flex-1">
          <div className="flex flex-col">
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
              return (
                <div
                  key={conv.phone}
                  onClick={() => setSelectedPhone(conv.phone)}
                  className={cn(
                    "p-5 border-b border-[#E3E6EB]/50 cursor-pointer transition-all flex gap-4 relative hover:bg-white group",
                    isActive ? "bg-white shadow-[0_4px_20px_rgba(0,0,0,0.03)] z-10" : "opacity-80 hover:opacity-100"
                  )}
                >
                  {isActive && (
                    <div className="absolute left-0 top-3 bottom-3 w-1.5 bg-[#FFC400] rounded-r-full shadow-[0_0_10px_rgba(255,196,0,0.3)]" />
                  )}
                  <div className="relative flex-shrink-0">
                    <Avatar className="h-14 w-14 border-2 border-white shadow-md rounded-[18px]">
                      {conv.avatarUrl && <AvatarImage src={conv.avatarUrl} alt={displayName} />}
                      <AvatarFallback className="bg-gradient-to-br from-[#F6F7F9] to-[#E3E6EB] text-[#A7ADB8] font-black uppercase text-base">
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
        </ScrollArea>
      </div>

      {/* Coluna 2: Chat principal */}
      <div className="flex-1 flex flex-col bg-white relative">
        {selectedConv ? (
          <>
            <div className="p-6 border-b border-[#E3E6EB] flex justify-between items-center bg-white/90 backdrop-blur-xl z-20 h-20">
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12 border-2 border-[#F6F7F9] shadow-sm rounded-[16px]">
                  {selectedConv.avatarUrl && <AvatarImage src={selectedConv.avatarUrl} alt={selectedConv.name ?? selectedConv.phone} />}
                  <AvatarFallback className="bg-[#F6F7F9] text-[#A7ADB8] font-black">
                    {getContactInitials(selectedConv.name, selectedConv.phone)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-jakarta font-black text-base text-ink tracking-tight">
                    {selectedConv.name || formatPhoneDisplay(selectedConv.phone)}
                  </h3>
                  {selectedConv.name && (
                    <p className="text-[11px] text-gray-400 font-semibold">{formatPhoneDisplay(selectedConv.phone)}</p>
                  )}
                  <div className="flex items-center gap-2">
                    {waConnected ? (
                      <>
                        <div className="relative flex h-2 w-2">
                          <div className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1FA463] opacity-40"></div>
                          <div className="relative inline-flex rounded-full h-2 w-2 bg-[#1FA463]"></div>
                        </div>
                        <span className="text-[10px] text-[#1FA463] font-black uppercase tracking-[0.1em] flex items-center gap-1"><Wifi className="w-3 h-3" /> WhatsApp Conectado</span>
                      </>
                    ) : (
                      <span className="text-[10px] text-red-500 font-black uppercase tracking-[0.1em] flex items-center gap-1"><WifiOff className="w-3 h-3" /> Desconectado</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-[#A7ADB8] hover:text-[#FFC400] hover:bg-[#FFC400]/10 rounded-xl transition-all"
                  onClick={() => setIsRoutingOpen(true)}
                  title="Encaminhar para Equipe"
                >
                  <Users className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-10 w-10 text-[#A7ADB8] hover:text-[#FFC400] hover:bg-[#FFC400]/10 rounded-xl transition-all"><Phone className="w-5 h-5" /></Button>
                <div className="h-6 w-[1px] bg-[#E3E6EB] mx-1" />
                <Button variant="ghost" size="icon" className="h-10 w-10 text-[#A7ADB8] hover:text-ink hover:bg-gray-100 rounded-xl transition-all"><MoreVertical className="w-5 h-5" /></Button>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto bg-gray-50/50">
              <div className="p-8 space-y-4 min-h-full">
                {selectedConv.messages.map((m) => {
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
                            "text-sm leading-relaxed font-medium whitespace-pre-wrap break-words px-2 py-1.5",
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
                    <input
                      type="text"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                      placeholder={waConnected ? 'Digite sua mensagem...' : 'WhatsApp desconectado'}
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

      {/* Coluna 3: SDR Insights */}
      <div className="w-85 border-l border-gray-100 bg-white overflow-hidden flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
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
                          <span className="text-gray-500">Sentimento: <span className="text-ink capitalize">{currentLead.ia_sentimento || 'Neutro'}</span></span>
                          <span className="text-gray-500">Urgência: <span className="text-danger capitalize">{currentLead.ia_urgencia || 'Média'}</span></span>
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
                        <div className="absolute -right-2 -top-2 opacity-5 group-hover:opacity-10 transition-opacity">
                          <Brain className="w-16 h-16 text-primary" />
                        </div>
                        <p className="text-sm text-ink leading-relaxed font-medium relative z-10">
                          {currentLead.ia_summary || 'Analisando conversa em tempo real...'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 px-1">Gatilhos Detectados</h3>
                      <div className="flex flex-wrap gap-2">
                        {(currentLead.ia_interesses || ['Óculos de Grau', 'Exame']).map((tag, i) => (
                          <Badge key={i} variant="secondary" className="bg-gray-50 hover:bg-primary/5 text-ink hover:text-primary border border-gray-100 hover:border-primary/20 font-bold px-3 py-1.5 rounded-xl transition-all cursor-default text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 space-y-3">
                      <Button onClick={handleSimulateOCR} disabled={isOcrProcessing} className="w-full h-12 text-xs font-bold bg-white hover:bg-gray-50 text-ink border border-gray-200 rounded-xl transition-all shadow-sm">
                        {isOcrProcessing ? (
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin text-primary" />
                        ) : (
                          <FileText className="w-4 h-4 mr-2 text-primary" />
                        )}
                        {currentLead.ia_receita_grau ? "Recarregar Receita" : "Simular OCR Receita"}
                      </Button>
                      <Button onClick={handleRecalibrateIA} variant="ghost" className="w-full h-12 text-xs font-bold text-gray-400 hover:text-primary transition-colors">
                        <Zap className="w-4 h-4 mr-2" /> Recalibrar Modelo IA
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-20 opacity-20">
                    <Brain className="w-12 h-12 mx-auto mb-4" />
                    <p className="font-bold text-sm">Selecione um lead para ver insights</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="lead" className="m-0 space-y-8 outline-none">
                <div className="space-y-6">
                  <div className="flex justify-between items-center px-1">
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Dados do Exame</h3>
                    {currentLead?.ia_receita_validade && (
                      <Badge className="bg-success/10 text-success text-[10px] font-bold border-none px-2">VÁLIDA</Badge>
                    )}
                  </div>
                  <div className="bg-gray-50/50 p-5 rounded-2xl border border-gray-100 space-y-5">
                    <div className="space-y-1.5">
                       <Label className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Grau (OD/OE)</Label>
                       <p className="text-sm font-bold text-ink">{currentLead?.ia_receita_grau || 'Aguardando envio...'}</p>
                    </div>
                    <div className="space-y-1.5 pt-4 border-t border-gray-100">
                       <Label className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Validade da Receita</Label>
                       <p className="text-sm font-bold text-ink">{currentLead?.ia_receita_validade || '---'}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 px-1">Segmentação</h3>
                  <div className="flex flex-wrap gap-2">
                    {(currentLead?.ia_tags || []).length > 0 ? (
                      currentLead?.ia_tags?.map((tag, i) => (
                        <Badge key={i} className="bg-ink text-white text-[10px] font-bold border-none px-3 py-1 rounded-lg">
                          {tag}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-xs text-gray-400 italic">Nenhuma tag atribuída</p>
                    )}
                  </div>
                </div>
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
      </div>
    </div>
  )
}

export default Chat;

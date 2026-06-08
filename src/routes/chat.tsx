import { createFileRoute } from '@tanstack/react-router'
import { CheckCircle2, User, Send, Phone, Info, Layout, PlusCircle, Settings, ChevronRight, MessageSquare, Calendar, Brain, ShieldCheck, Zap, AlertCircle, FileText, RefreshCw, Upload, Search, Paperclip, MoreVertical, Smile } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useChatStore } from '@/hooks/use-chat'
import { useKanban } from '@/hooks/use-kanban'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from 'sonner'
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export const Route = createFileRoute('/chat')({
  component: Chat,
})

function Chat() {
  const { sessions, selectedSessionId, setSelectedSession } = useChatStore()
  const { leads, updateLead } = useKanban()
  const [activeTab, setActiveTab] = useState('ia')
  const scrollRef = useRef<HTMLDivElement>(null)
  
  const selectedSession = sessions.find(s => s.id === selectedSessionId)
  const currentLead = leads.find(l => l.name === selectedSession?.name)

  const [isOcrProcessing, setIsOcrProcessing] = useState(false)

  const handleSimulateOCR = () => {
    setIsOcrProcessing(true)
    toast.loading("Processando receita via OCR...")
    
    setTimeout(() => {
      if (currentLead) {
        updateLead(currentLead.id, {
          ia_receita_validade: '2027-05-20',
          ia_receita_grau: 'OD: -2.00 / OE: -1.75',
          ia_interesses: [...(currentLead.ia_interesses || []), 'Lentes com Filtro Azul'],
          ia_tags: [...(currentLead.ia_tags || []), 'Receita Digitalizada']
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

  return (
    <div className="bg-white border border-gray-200 rounded-2xl h-[calc(100vh-140px)] flex overflow-hidden shadow-sm">
      {/* Coluna 1: Lista de Sessões */}
      <div className="w-80 border-r border-gray-100 flex flex-col bg-gray-50/30">
        <div className="p-6 border-b border-gray-100 bg-white flex justify-between items-center h-[73px]">
          <h2 className="font-jakarta font-bold text-lg text-ink">Conversas</h2>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-gray-50 hover:bg-gray-100">
            <PlusCircle className="w-5 h-5 text-gray-600" />
          </Button>
        </div>
        
        <div className="p-4 bg-white/50">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-colors group-focus-within:text-primary" />
            <input 
              type="text" 
              placeholder="Pesquisar..." 
              className="w-full bg-gray-100/50 border border-transparent rounded-xl pl-10 pr-4 py-2.5 text-sm focus:bg-white focus:border-primary/30 transition-all outline-none text-ink font-medium placeholder:text-gray-400"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="flex flex-col">
            {sessions.map(session => (
              <div 
                key={session.id} 
                onClick={() => setSelectedSession(session.id)}
                className={cn(
                  "p-4 border-b border-gray-50/50 cursor-pointer transition-all flex gap-3 relative hover:bg-white group",
                  selectedSessionId === session.id ? "bg-white shadow-sm z-10" : ""
                )}
              >
                {selectedSessionId === session.id && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full" />
                )}
                
                <div className="relative flex-shrink-0">
                  <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                    <AvatarFallback className="bg-gray-100 text-gray-500 font-bold uppercase">
                      {session.name.substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  {session.status === 'online' && (
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-success border-2 border-white rounded-full"></div>
                  )}
                </div>

                <div className="flex-1 min-w-0 py-0.5">
                  <div className="flex justify-between items-center mb-0.5">
                    <h4 className="font-jakarta font-bold text-sm text-ink truncate group-hover:text-primary transition-colors">
                      {session.name}
                    </h4>
                    <span className="text-[10px] font-semibold text-gray-400 tabular-nums">
                      {session.time}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <p className={cn(
                      "text-xs truncate font-medium flex-1",
                      session.unread > 0 ? "text-ink" : "text-gray-500"
                    )}>
                      {session.lastMessage}
                    </p>
                    {session.unread > 0 && (
                      <span className="flex-shrink-0 bg-primary text-primary-foreground text-[10px] h-5 min-w-[20px] px-1.5 flex items-center justify-center rounded-full font-bold shadow-sm shadow-primary/20">
                        {session.unread}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Coluna 2: Chat principal */}
      <div className="flex-1 flex flex-col bg-white relative">
        {selectedSession ? (
          <>
            <div className="p-4 px-6 border-b border-gray-100 flex justify-between items-center bg-white/80 backdrop-blur-md z-20 h-[73px]">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border border-gray-100">
                  <AvatarFallback className="bg-gray-50 text-gray-400 font-bold">
                    {selectedSession.name.substring(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-jakarta font-bold text-sm text-ink">{selectedSession.name}</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                    </span>
                    <span className="text-[10px] text-success font-bold uppercase tracking-wider">Disponível</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-primary hover:bg-primary/5 rounded-xl"><Phone className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-primary hover:bg-primary/5 rounded-xl"><MoreVertical className="w-4 h-4" /></Button>
              </div>
            </div>
            
            <ScrollArea className="flex-1 bg-gray-50/50">
              <div className="p-8 space-y-8 min-h-full">
                {/* Wallpaper opcional discreto */}
                <div className="flex justify-start">
                  <div className="max-w-[70%]">
                    <div className="bg-white border border-gray-100 p-4 rounded-2xl rounded-tl-none shadow-sm mb-1.5">
                      <p className="text-sm text-ink leading-relaxed font-medium">
                        {selectedSession.lastMessage}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight ml-1">10:30</span>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <div className="max-w-[70%] text-right">
                    <div className="bg-primary p-4 rounded-2xl rounded-tr-none shadow-lg shadow-primary/10 inline-block text-left">
                      <p className="text-sm text-primary-foreground leading-relaxed font-bold">
                        Olá! Sou a assistente IA da Ótica Catelan. Como posso ajudar com sua consulta hoje? 😊
                      </p>
                    </div>
                    <div className="mt-1.5 flex items-center justify-end gap-1.5 mr-1">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">10:32</span>
                      <CheckCircle2 className="w-3 h-3 text-success" />
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>

            <div className="p-4 border-t border-gray-100 bg-white">
              <div className="flex gap-2 items-center">
                <div className="flex-1 flex gap-2 bg-gray-50 p-2 rounded-2xl border border-gray-100 focus-within:bg-white focus-within:border-primary/30 focus-within:shadow-sm transition-all items-center">
                  <Button variant="ghost" size="icon" className="text-gray-400 h-9 w-9 hover:text-primary hover:bg-primary/5 rounded-xl">
                    <Smile className="w-5 h-5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-gray-400 h-9 w-9 hover:text-primary hover:bg-primary/5 rounded-xl">
                    <Paperclip className="w-5 h-5" />
                  </Button>
                  <input 
                    type="text" 
                    placeholder="Digite sua mensagem..." 
                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-1.5 text-ink font-medium placeholder:text-gray-400 outline-none"
                  />
                </div>
                <Button className="h-12 w-12 rounded-2xl bg-primary hover:bg-yellow-bright text-primary-foreground shadow-lg shadow-primary/20 transition-all flex-shrink-0">
                  <Send className="w-5 h-5" />
                </Button>
              </div>
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
                          (currentLead.ia_score || 0) > 70 ? "bg-success text-white" : "bg-primary text-primary-foreground"
                        )}>
                          {currentLead.ia_score || 0}/100
                        </Badge>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-gray-500">Sentimento: <span className="text-ink capitalize">{currentLead.ia_sentimento || 'Neutro'}</span></span>
                          <span className="text-gray-500">Urgência: <span className="text-danger capitalize">{currentLead.ia_urgencia || 'Média'}</span></span>
                        </div>
                        <Progress value={currentLead.ia_score || 0} className="h-2 bg-gray-200" />
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
                          {currentLead.ia_resumo || 'Analisando conversa em tempo real...'}
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

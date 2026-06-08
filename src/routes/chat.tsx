import { createFileRoute } from '@tanstack/react-router'
import { CheckCircle2, User, Send, Phone, Info, Layout, PlusCircle, Settings, ChevronRight, MessageSquare, Calendar, Brain, ShieldCheck, Zap, AlertCircle, FileText, RefreshCw, Upload, Search } from 'lucide-react'
import { useState } from 'react'
import { useChatStore } from '@/hooks/use-chat'
import { useKanban } from '@/hooks/use-kanban'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from 'sonner'

export const Route = createFileRoute('/chat')({
  component: Chat,
})


function Chat() {
  const { sessions, selectedSessionId, setSelectedSession } = useChatStore()
  const { leads, updateLead } = useKanban()
  const [activeTab, setActiveTab] = useState('ia')
  
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
    <div className="bg-card border-border rounded-[14px] h-[calc(100vh-140px)] flex overflow-hidden shadow-2xl">
      {/* Coluna 1: Lista de Sessões (Acesso Direto) */}
      <div className="w-80 border-r border-border flex flex-col bg-black/20">
        <div className="p-5 border-b border-border bg-card flex justify-between items-center">
          <h2 className="font-black text-xs uppercase tracking-[0.15em] text-gray-400">Conversas</h2>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
            <PlusCircle className="w-4 h-4 text-primary" />
          </Button>
        </div>
        <div className="p-4 border-b border-border bg-card">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input 
              type="text" 
              placeholder="Buscar por nome..." 
              className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-2 text-xs focus:ring-1 focus:ring-primary transition-all outline-none text-white font-medium"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.map(session => (
            <div 
              key={session.id} 
              onClick={() => setSelectedSession(session.id)}
              className={cn(
                "p-4 border-b border-border cursor-pointer transition-all flex gap-3 group relative hover:bg-white/5",
                selectedSessionId === session.id ? "bg-primary/5 border-l-[4px] border-l-primary shadow-inner" : ""
              )}
            >
              <div className="w-12 h-12 rounded-full bg-black-3 border border-border flex items-center justify-center relative flex-shrink-0 shadow-sm">
                <User className="w-6 h-6 text-gray-500" />
                {session.status === 'online' && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <h4 className="font-black text-xs uppercase tracking-tight text-white group-hover:text-primary transition-colors">{session.name}</h4>
                  <span className="text-[10px] font-black text-gray-500 uppercase">{session.time}</span>
                </div>
                <p className={cn(
                  "text-[11px] truncate mt-0.5 font-medium",
                  session.unread > 0 ? "text-white" : "text-gray-500"
                )}>
                  {session.lastMessage}
                </p>
              </div>
              {session.unread > 0 && (
                <div className="absolute right-4 bottom-4 w-5 h-5 bg-primary text-white text-[10px] flex items-center justify-center rounded-full font-bold">
                  {session.unread}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Coluna 2: Chat principal & Criação (Interface de Criação/Mensagem) */}
      <div className="flex-1 flex flex-col bg-background relative">
        {selectedSession ? (
          <>
            <div className="p-5 border-b border-border flex justify-between items-center bg-card z-10 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-black-3 border border-border flex items-center justify-center shadow-inner">
                  <User className="w-6 h-6 text-gray-500" />
                </div>
                <div>
                  <span className="font-black text-xs uppercase tracking-widest block text-white">{selectedSession.name}</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                    <span className="text-[10px] text-success font-black uppercase tracking-wider">Online</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" className="text-gray-500 hover:text-primary hover:bg-primary/10 rounded-xl transition-all"><Phone className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="text-gray-500 hover:text-primary hover:bg-primary/10 rounded-xl transition-all"><Info className="w-4 h-4" /></Button>
              </div>
            </div>
            
            <div className="flex-1 p-8 overflow-y-auto space-y-6 relative">
              {/* Wallpaper Pattern Effect */}
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://wweb.dev/assets/whatsapp-chat-bg.png')] bg-repeat invert" />
              
              <div className="flex justify-start relative z-10">
                <div className="bg-card border border-border p-4 rounded-[14px] rounded-tl-none max-w-[75%] shadow-xl">
                  <p className="text-xs text-white leading-relaxed font-medium">{selectedSession.lastMessage}</p>
                  <span className="text-[9px] font-black text-gray-500 mt-2 block text-right uppercase tracking-wider">10:30</span>
                </div>
              </div>
              
              <div className="flex justify-end relative z-10">
                <div className="bg-primary shadow-[0_10px_30px_rgba(255,196,0,0.2)] p-4 rounded-[14px] rounded-tr-none max-w-[75%]">
                  <p className="text-xs text-primary-foreground leading-relaxed font-black">Olá! Sou a assistente IA da Ótica Catelan. Como posso ajudar com sua consulta hoje? 😊</p>
                  <span className="text-[9px] font-black text-primary-foreground/60 mt-2 block text-right uppercase tracking-wider">10:32</span>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-border bg-card shadow-2xl relative z-10">
              <div className="flex gap-3 bg-background p-2.5 rounded-[14px] border border-border items-center shadow-inner focus-within:border-primary/50 transition-all">
                <Button variant="ghost" size="icon" className="text-gray-500 h-10 w-10 hover:text-primary hover:bg-white/5 transition-all">
                  <PlusCircle className="w-5 h-5" />
                </Button>
                <input 
                  type="text" 
                  placeholder="Envie uma mensagem (HSM para >24h)..." 
                  className="flex-1 bg-transparent border-none focus:ring-0 text-xs py-2 text-white font-medium placeholder:text-gray-600 outline-none"
                />
                <Button className="h-10 px-6 rounded-[14px] bg-primary hover:bg-yellow-bright text-primary-foreground font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20 transition-all">
                  ENVIAR <Send className="w-3.5 h-3.5 ml-2" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50">
            <div className="bg-white p-8 rounded-full shadow-inner mb-4">
              <MessageSquare className="w-12 h-12 text-slate-200" />
            </div>
            <p className="font-medium">Selecione uma conversa ou inicie uma nova</p>
            <Button className="mt-4" variant="outline">
              <PlusCircle className="w-4 h-4 mr-2" />
              Novo Atendimento
            </Button>
          </div>
        )}
      </div>

      {/* Coluna 3: SDR Insights & Qualificação IA */}
      <div className="w-80 border-l border-border bg-black/20 overflow-y-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b border-border bg-card h-14 px-2">
            <TabsTrigger value="ia" className="text-[10px] font-black uppercase tracking-widest data-[state=active]:text-primary data-[state=active]:bg-white/5 rounded-xl h-10 flex items-center gap-2 px-4 transition-all">
              <Brain className="w-3.5 h-3.5" /> IA SDR
            </TabsTrigger>
            <TabsTrigger value="lead" className="text-[10px] font-black uppercase tracking-widest data-[state=active]:text-primary data-[state=active]:bg-white/5 rounded-xl h-10 flex items-center gap-2 px-4 transition-all">
              <User className="w-3.5 h-3.5" /> Lead
            </TabsTrigger>
            <TabsTrigger value="unit" className="text-[10px] font-black uppercase tracking-widest data-[state=active]:text-primary data-[state=active]:bg-white/5 rounded-xl h-10 flex items-center gap-2 px-4 transition-all">
              Unidade
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="ia" className="p-4 m-0 space-y-5">
            {currentLead ? (
              <>
                <div className="bg-card p-5 rounded-[14px] border border-border shadow-xl space-y-5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.15em]">Qualificação</span>
                    <Badge className={cn(
                      "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border-none shadow-sm",
                      (currentLead.ia_score || 0) > 70 ? "bg-success text-white" : "bg-primary text-primary-foreground"
                    )}>
                      {currentLead.ia_score || 0}/100
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold text-slate-500">
                      <span>Sentimento: <span className="text-slate-900 capitalize">{currentLead.ia_sentimento || 'Neutro'}</span></span>
                      <span>Urgência: <span className="text-red-600 capitalize">{currentLead.ia_urgencia || 'Média'}</span></span>
                    </div>
                    <Progress value={currentLead.ia_score || 0} className="h-1.5" />
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Resumo Estratégico</h3>
                  <div className="bg-primary/10 border border-primary/20 p-4 rounded-[14px] shadow-inner relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10">
                      <Brain className="w-8 h-8 text-primary" />
                    </div>
                    <p className="text-[11px] text-gray-200 leading-relaxed font-semibold relative z-10">
                      {currentLead.ia_resumo || 'Analisando conversa em tempo real...'}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Interesses Detectados</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {(currentLead.ia_interesses || ['Óculos de Grau', 'Exame']).map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] bg-black-3 text-primary border border-primary/20 font-black px-2 py-1 rounded-lg">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="pt-2 space-y-2">
                   <Button onClick={handleSimulateOCR} disabled={isOcrProcessing} variant="outline" className="w-full h-11 text-[10px] font-black uppercase tracking-widest border border-border bg-card hover:bg-white/5 text-white transition-all shadow-lg rounded-[14px]">
                      {isOcrProcessing ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2 text-primary shadow-[0_0_10px_rgba(255,196,0,0.3)]" />}
                      {currentLead.ia_receita_grau ? "Recarregar Receita" : "Simular OCR Receita"}
                   </Button>
                   <Button onClick={handleRecalibrateIA} variant="ghost" className="w-full h-11 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-primary transition-colors">
                      <Zap className="w-4 h-4 mr-2" /> Recalibrar IA SDR
                   </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-10 opacity-30">
                <Brain className="w-10 h-10 mx-auto mb-2" />
                <p className="text-xs font-bold">Aguardando Lead...</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="lead" className="p-4 m-0 space-y-6">
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Dados Técnicos</h3>
                {currentLead?.ia_receita_validade && <Badge className="bg-green-100 text-green-700 text-[9px] border-none">Receita Válida</Badge>}
              </div>
              <div className="bg-white p-4 rounded-xl border shadow-sm space-y-3">
                <div className="space-y-1">
                   <Label className="text-[9px] text-slate-400 uppercase">Grau Extraído</Label>
                   <p className="text-xs font-bold text-slate-800">{currentLead?.ia_receita_grau || 'Não identificado'}</p>
                </div>
                <div className="space-y-1">
                   <Label className="text-[9px] text-slate-400 uppercase">Validade</Label>
                   <p className="text-xs font-bold text-slate-800">{currentLead?.ia_receita_validade || '---'}</p>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Tags do Lead</h3>
              <div className="flex flex-wrap gap-1">
                {(currentLead?.ia_tags || []).map((tag, i) => (
                  <Badge key={i} className="bg-primary/10 text-primary text-[9px] border-none font-bold">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </TabsContent>


          <TabsContent value="unit" className="p-4 m-0 space-y-6">
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Configurações da Unidade</h3>
              <div className="bg-white p-4 rounded-xl border shadow-sm space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500">Unidade Ativa</label>
                  <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                    <span>Unidade Centro - Sul</span>
                    <Settings className="w-3 h-3 text-slate-400" />
                  </div>
                </div>
                <div className="space-y-1 pt-2 border-t">
                  <label className="text-[10px] font-bold text-slate-500">Tempo Médio Resposta</label>
                  <div className="text-xs font-medium text-green-600">4 min 12s</div>
                </div>
                <div className="space-y-1 pt-2 border-t">
                  <label className="text-[10px] font-bold text-slate-500">Limites de Envio (API)</label>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1">
                    <div className="bg-primary h-full w-[65%] rounded-full" />
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-400 mt-1">
                    <span>650 / 1000 HSM</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl">
              <h4 className="text-xs font-bold text-primary mb-2 flex items-center">
                <Info className="w-3 h-3 mr-2" /> Status da Integração
              </h4>
              <p className="text-[10px] text-slate-600 leading-relaxed">
                WhatsApp Business API conectado com sucesso. Próxima renovação de token em 14 dias.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

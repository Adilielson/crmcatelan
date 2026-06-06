import { createFileRoute } from '@tanstack/react-router'
import { CheckCircle2, User, Send, Phone, Info, Layout, PlusCircle, Settings, ChevronRight, MessageSquare, Calendar, Brain, ShieldCheck, Zap, AlertCircle, FileText, RefreshCw, Upload } from 'lucide-react'
import { useState } from 'react'
import { useChatStore } from '@/hooks/use-chat'
import { useKanban } from '@/hooks/use-kanban'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
    <div className="bg-white border rounded-xl h-[calc(100vh-140px)] flex overflow-hidden shadow-sm">
      {/* Coluna 1: Lista de Sessões (Acesso Direto) */}
      <div className="w-80 border-r flex flex-col bg-slate-50/30">
        <div className="p-4 border-b bg-white flex justify-between items-center">
          <h2 className="font-bold text-slate-800">Conversas</h2>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
            <PlusCircle className="w-4 h-4 text-primary" />
          </Button>
        </div>
        <div className="p-4 border-b bg-white">
          <input 
            type="text" 
            placeholder="Buscar leads..." 
            className="w-full bg-slate-100 border-none rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary transition-all"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.map(session => (
            <div 
              key={session.id} 
              onClick={() => setSelectedSession(session.id)}
              className={cn(
                "p-4 border-b cursor-pointer transition-colors flex gap-3 group relative",
                selectedSessionId === session.id ? "bg-white border-l-4 border-l-primary" : "hover:bg-slate-50"
              )}
            >
              <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center relative flex-shrink-0">
                <User className="w-6 h-6 text-slate-400" />
                {session.status === 'online' && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <h4 className="font-bold text-sm truncate text-slate-700">{session.name}</h4>
                  <span className="text-[10px] text-slate-400">{session.time}</span>
                </div>
                <p className={cn(
                  "text-xs truncate",
                  session.unread > 0 ? "text-slate-900 font-semibold" : "text-slate-500"
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
      <div className="flex-1 flex flex-col bg-white">
        {selectedSession ? (
          <>
            <div className="p-4 border-b flex justify-between items-center shadow-sm z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                  <User className="w-6 h-6 text-slate-400" />
                </div>
                <div>
                  <span className="font-bold text-sm block text-slate-800">{selectedSession.name}</span>
                  <span className="text-[10px] text-green-500 font-medium">Ativo agora</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-primary"><Phone className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-primary"><Info className="w-4 h-4" /></Button>
              </div>
            </div>
            
            <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-[url('https://wweb.dev/assets/whatsapp-chat-bg.png')] bg-repeat opacity-95">
              <div className="flex justify-start">
                <div className="bg-white border p-3 rounded-2xl rounded-tl-none max-w-[70%] shadow-sm">
                  <p className="text-sm text-slate-800">{selectedSession.lastMessage}</p>
                  <span className="text-[10px] text-slate-400 mt-1 block text-right">10:30</span>
                </div>
              </div>
              <div className="flex justify-end">
                <div className="bg-primary text-primary-foreground p-3 rounded-2xl rounded-tr-none max-w-[70%] shadow-sm">
                  <p className="text-sm">Olá! Sou a assistente IA da Castelar. Como posso ajudar com sua consulta hoje?</p>
                  <span className="text-[10px] text-primary-foreground/70 mt-1 block text-right">10:32</span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t bg-slate-50/50">
              <div className="flex gap-2 bg-white p-2 rounded-xl border shadow-sm items-center">
                <Button variant="ghost" size="icon" className="text-slate-400 h-10 w-10">
                  <PlusCircle className="w-6 h-6" />
                </Button>
                <input 
                  type="text" 
                  placeholder="Envie uma mensagem (HSM para >24h)..." 
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2"
                />
                <Button className="h-10 w-10 rounded-lg">
                  <Send className="w-5 h-5" />
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
      <div className="w-80 border-l bg-slate-50/20 overflow-y-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b bg-white h-12 px-2">
            <TabsTrigger value="ia" className="text-xs font-bold data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full flex items-center gap-1">
              <Brain className="w-3 h-3" /> IA SDR
            </TabsTrigger>
            <TabsTrigger value="lead" className="text-xs font-bold data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full flex items-center gap-1">
              <User className="w-3 h-3" /> Lead
            </TabsTrigger>
            <TabsTrigger value="unit" className="text-xs font-bold data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full">Unidade</TabsTrigger>
          </TabsList>
          
          <TabsContent value="ia" className="p-4 m-0 space-y-5">
            {currentLead ? (
              <>
                <div className="bg-white p-4 rounded-xl border shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Score de Qualificação</span>
                    <Badge className={cn(
                      "text-[10px] font-bold",
                      (currentLead.ia_score || 0) > 70 ? "bg-green-500" : "bg-yellow-500"
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
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Resumo da IA</h3>
                  <div className="bg-blue-50/50 border border-blue-100 p-3 rounded-xl">
                    <p className="text-[11px] text-slate-700 leading-relaxed font-medium">
                      {currentLead.ia_resumo || 'Analisando conversa em tempo real...'}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Interesses Detectados</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {(currentLead.ia_interesses || ['Óculos de Grau', 'Exame']).map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-[9px] bg-slate-100 text-slate-600 border-none font-bold">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="pt-2 space-y-2">
                   <Button onClick={handleSimulateOCR} disabled={isOcrProcessing} variant="outline" className="w-full h-8 text-[10px] font-bold border-dashed">
                      {isOcrProcessing ? <RefreshCw className="w-3 h-3 mr-2 animate-spin" /> : <FileText className="w-3 h-3 mr-2 text-primary" />}
                      {currentLead.ia_receita_grau ? "Recarregar Receita" : "Simular OCR de Receita"}
                   </Button>
                   <Button onClick={handleRecalibrateIA} variant="ghost" className="w-full h-8 text-[10px] font-bold text-slate-400 hover:text-primary">
                      <Zap className="w-3 h-3 mr-2" /> Recalibrar IA SDR
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

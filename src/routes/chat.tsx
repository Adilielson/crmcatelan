import { createFileRoute } from '@tanstack/react-router'
import { CheckCircle2, User, Send, Phone, Info, Layout, PlusCircle, Settings, ChevronRight, MessageSquare, Calendar } from 'lucide-react'
import { useState } from 'react'
import { useChatStore } from '@/hooks/use-chat'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export const Route = createFileRoute('/chat')({
  component: Chat,
})

function Chat() {
  const { sessions, selectedSessionId, setSelectedSession } = useChatStore()
  const [activeTab, setActiveTab] = useState('chat')
  const selectedSession = sessions.find(s => s.id === selectedSessionId)

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

      {/* Coluna 3: Aba separada na direita (Dados/Config/Unidade) */}
      <div className="w-80 border-l bg-slate-50/20 overflow-y-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b bg-white h-12 px-2">
            <TabsTrigger value="chat" className="text-xs font-bold data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full">Lead</TabsTrigger>
            <TabsTrigger value="unit" className="text-xs font-bold data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full">Unidade</TabsTrigger>
          </TabsList>
          
          <TabsContent value="chat" className="p-4 m-0 space-y-6">
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Qualificação IA</h3>
                <Badge variant="outline" className="text-[9px] bg-green-50 text-green-700 border-green-200">90% Score</Badge>
              </div>
              <div className="space-y-3 bg-white p-4 rounded-xl border shadow-sm">
                {[
                  { label: 'Intenção de compra', status: true },
                  { label: 'Orçamento definido', status: true },
                  { label: 'Prazo: < 7 dias', status: false },
                  { label: 'Agendamento aceito', status: true },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle2 className={cn("w-4 h-4", item.status ? "text-green-500 fill-green-50" : "text-slate-200")} />
                    <span className={cn("text-xs", item.status ? "text-slate-700 font-medium" : "text-slate-400")}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Ações do Card</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" className="text-[10px] h-8 justify-start">
                  <Calendar className="w-3 h-3 mr-2 text-primary" /> Agendar
                </Button>
                <Button variant="outline" size="sm" className="text-[10px] h-8 justify-start">
                  <Layout className="w-3 h-3 mr-2 text-blue-500" /> Ver Kanban
                </Button>
              </div>
            </div>

            <div className="pt-2">
               <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Mídias do Lead</h3>
               <div className="grid grid-cols-3 gap-2">
                  <div className="aspect-square bg-slate-200 rounded-lg border border-slate-300 flex items-center justify-center text-[10px] text-slate-500">Receita.pdf</div>
                  <div className="aspect-square bg-slate-200 rounded-lg border border-slate-300 flex items-center justify-center text-[10px] text-slate-500">Exame.jpg</div>
                  <div className="aspect-square bg-slate-100 rounded-lg border border-slate-200 border-dashed flex items-center justify-center">
                    <PlusCircle className="w-4 h-4 text-slate-300" />
                  </div>
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

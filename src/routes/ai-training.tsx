import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription,
  CardFooter
} from "@/components/ui/card"
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs"
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Switch } from '@/components/ui/switch'
import { 
  Brain, 
  MessageSquare, 
  BookOpen, 
  Target, 
  History, 
  Play, 
  Upload, 
  Save, 
  Plus, 
  X,
  AlertCircle,
  FileText,
  Clock,
  Zap,
  CheckCircle2
} from 'lucide-react'
import { toast } from "sonner"
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

export const Route = createFileRoute('/ai-training')({
  component: AITrainingSettings,
})

function AITrainingSettings() {
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('personality')
  const [trainingMode, setTrainingMode] = useState(false)
  
  // Mock State
  const [config, setConfig] = useState({
    prompt_system: "Você é um assistente virtual da Ótica Castelar. Seu tom de voz deve ser amigável, consultivo e focado em resolver as dúvidas do cliente sobre saúde visual e agendar consultas.",
    tone: "consultive",
    knowledge_base_faq: "1. Qual o valor da consulta? R: O valor é R$ 100,00.\n2. Vocês aceitam convênio? R: Sim, aceitamos Unimed e Bradesco Saúde.",
    scheduling_link: "https://calendar.google.com/booking/castelar",
    response_delay: 5,
    goal: "appointment"
  })

  const handleSave = () => {
    if (!config.prompt_system.trim()) {
      toast.error("Defina como a IA deve se comportar antes de salvar")
      return
    }
    
    setIsSaving(true)
    setTimeout(() => {
      setIsSaving(false)
      toast.success("Configurações de treinamento atualizadas com sucesso!")
    }, 1500)
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-[14px] border border-border shadow-card relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5">
           <Brain className="w-24 h-24 text-primary" />
        </div>
        <div className="flex items-center gap-6 relative z-10">
          <div className="p-4 bg-primary/10 rounded-2xl shadow-inner border border-primary/20">
            <Brain className="w-10 h-10 text-primary shadow-[0_0_15px_rgba(255,196,0,0.3)]" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-ink tracking-tight font-jakarta mb-1 uppercase tracking-tight">Treinamento IA SDR</h1>
            <p className="text-gray-500 font-medium">Personalize a inteligência de atendimento da Ótica Catelan.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-2 mr-4">
            <Label htmlFor="training-mode" className="text-sm">Modo de Aprendizado</Label>
            <Switch 
              id="training-mode" 
              checked={trainingMode} 
              onCheckedChange={setTrainingMode} 
            />
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-white border border-border mb-8 w-full justify-start h-16 p-2 rounded-[14px] shadow-inner overflow-x-auto overflow-y-hidden scrollbar-hide">
          <TabsTrigger value="personality" className="text-[10px] font-black uppercase tracking-[0.15em] data-[state=active]:text-primary data-[state=active]:bg-gray-50 rounded-xl h-full flex items-center gap-2 px-8 transition-all text-ink">
            <Zap className="w-4 h-4" /> Personalidade
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="text-[10px] font-black uppercase tracking-[0.15em] data-[state=active]:text-primary data-[state=active]:bg-gray-50 rounded-xl h-full flex items-center gap-2 px-8 transition-all text-ink">
            <BookOpen className="w-4 h-4" /> Conhecimento
          </TabsTrigger>
          <TabsTrigger value="qualification" className="text-[10px] font-black uppercase tracking-[0.15em] data-[state=active]:text-primary data-[state=active]:bg-gray-50 rounded-xl h-full flex items-center gap-2 px-8 transition-all text-ink">
            <Target className="w-4 h-4" /> Qualificação
          </TabsTrigger>
          <TabsTrigger value="simulation" className="text-[10px] font-black uppercase tracking-[0.15em] data-[state=active]:text-primary data-[state=active]:bg-gray-50 rounded-xl h-full flex items-center gap-2 px-8 transition-all text-ink">
            <Play className="w-4 h-4" /> Simulação
          </TabsTrigger>
          <TabsTrigger value="history" className="text-[10px] font-black uppercase tracking-[0.15em] data-[state=active]:text-primary data-[state=active]:bg-gray-50 rounded-xl h-full flex items-center gap-2 px-8 transition-all text-ink">
            <History className="w-4 h-4" /> Histórico
          </TabsTrigger>
        </TabsList>

        <div className="mt-6 space-y-6">
          <TabsContent value="personality" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="shadow-card border-border bg-white rounded-[14px] overflow-hidden">
                <CardHeader className="pb-6 border-b border-border/50 bg-gray-50/50">
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-gray-400">Instruções de Abordagem</CardTitle>
                  <CardDescription className="text-gray-500 font-medium">Defina o tom de voz e o comportamento base da IA.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Prompt do Sistema (Personalidade)</Label>
                    <Textarea 
                      placeholder="Ex: Você é um atendente amigável da Ótica Catelan..." 
                      className="min-h-[220px] bg-white border-border rounded-xl text-ink font-medium p-4 focus:ring-1 focus:ring-primary shadow-inner"
                      value={config.prompt_system}
                      onChange={(e) => setConfig({...config, prompt_system: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Tom de Voz</Label>
                      <Select defaultValue="consultive">
                      <SelectTrigger className="bg-white border-border h-12 rounded-xl text-ink font-black text-[10px] uppercase tracking-widest">
                          <SelectValue placeholder="Selecione o tom" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="formal">Formal</SelectItem>
                          <SelectItem value="friendly">Amigável</SelectItem>
                          <SelectItem value="consultive">Consultivo</SelectItem>
                          <SelectItem value="direct">Direto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Objetivo da Conversa</Label>
                      <Select defaultValue={config.goal}>
                      <SelectTrigger className="bg-white border-border h-12 rounded-xl text-ink font-black text-[10px] uppercase tracking-widest">
                          <SelectValue placeholder="Selecione o objetivo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="appointment">Agendamento</SelectItem>
                          <SelectItem value="qualification">Qualificação</SelectItem>
                          <SelectItem value="support">Suporte</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-card border-border bg-white rounded-[14px] overflow-hidden">
                <CardHeader className="pb-6 border-b border-border/50 bg-gray-50/50">
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-gray-400">Scripts de Exemplo</CardTitle>
                  <CardDescription className="text-gray-500 font-medium">Mimetize o estilo de atendimento real da Ótica Catelan.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea 
                    placeholder="Insira diálogos reais de exemplo aqui..." 
                    className="min-h-[320px] bg-white border-border rounded-xl text-ink font-medium p-4 focus:ring-1 focus:ring-primary shadow-inner"
                  />
                  <p className="text-[11px] text-gray-500 font-bold italic leading-relaxed">
                    Fornecer bons exemplos ajuda a IA a entender nuances de linguagem e gírias regionais.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="knowledge" className="space-y-6">
            <Card className="shadow-card border-border bg-white rounded-[14px] overflow-hidden">
              <CardHeader className="pb-6 border-b border-border/50 bg-gray-50/50">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-gray-400">Documentos {'&'} FAQ</CardTitle>
                <CardDescription className="text-gray-500 font-medium">Fontes de informação estratégica para a base de conhecimento.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Upload de Arquivos (PDF/Word)</Label>
                    <div className="border-2 border-dashed border-border rounded-xl p-10 flex flex-col items-center justify-center text-center gap-4 hover:border-primary/50 hover:bg-white/5 transition-all cursor-pointer group shadow-inner">
                      <div className="p-3 bg-primary/10 rounded-full">
                        <Upload className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-ink mb-1">Upload de Conhecimento</p>
                        <p className="text-[10px] text-gray-500 font-bold max-w-[200px] mx-auto leading-relaxed">Manuais de serviço, tabelas de preços e guias de conduta.</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Documentos Ativos</p>
                      <div className="flex items-center justify-between p-4 bg-white border border-border rounded-xl shadow-inner">
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-primary shadow-[0_0_10px_rgba(255,196,0,0.3)]" />
                          <span className="text-xs font-black text-ink uppercase tracking-tight">Manual_Servicos_Catelan.pdf</span>
                        </div>
                        <Badge variant="outline" className="bg-success/10 text-success border-success/30 font-black text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-lg shadow-sm">
                          PRONTO
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-gray-500">FAQ Estruturada (Knowledge Base)</Label>
                    <Textarea 
                      placeholder="1. Pergunta? R: Resposta..." 
                      className="min-h-[280px] font-mono text-[11px] bg-white border-border rounded-xl text-primary font-black p-4 focus:ring-1 focus:ring-primary shadow-inner leading-relaxed"
                      value={config.knowledge_base_faq}
                      onChange={(e) => setConfig({...config, knowledge_base_faq: e.target.value})}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="qualification" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Fluxo de Qualificação</CardTitle>
                <CardDescription>Perguntas obrigatórias para filtrar leads qualificados.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {[
                    "Qual o motivo da consulta (exame de rotina, troca de armação, dor)?",
                    "Você possui algum convênio médico?",
                    "Qual a sua disponibilidade de horário (Manhã ou Tarde)?"
                  ].map((q, idx) => (
                    <div key={idx} className="flex gap-3 items-center">
                      <Badge className="h-6 w-6 rounded-full flex items-center justify-center p-0">{idx + 1}</Badge>
                      <Input defaultValue={q} />
                      <Button variant="ghost" size="icon" className="text-red-500"><X className="w-4 h-4" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" className="gap-2 w-full border-dashed">
                    <Plus className="w-4 h-4" /> Adicionar Pergunta de Qualificação
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t">
                  <div className="space-y-2">
                    <Label>Tempo de Resposta (Delay Humano)</Label>
                    <div className="flex items-center gap-3">
                      <Input type="number" value={config.response_delay} className="w-24" />
                      <span className="text-sm text-muted-foreground">segundos</span>
                    </div>
                    <p className="text-xs text-muted-foreground italic">Evita que a IA pareça um robô respondendo instantaneamente.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Link de Agendamento Padrão</Label>
                    <Input value={config.scheduling_link} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="simulation" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>Configuração do Teste</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Cenário do Lead</Label>
                    <Select defaultValue="new-lead">
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um cenário" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new-lead">Novo Lead (Interessado)</SelectItem>
                        <SelectItem value="angry">Lead Insatisfeito</SelectItem>
                        <SelectItem value="existing">Cliente Antigo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
                    <p className="text-xs text-blue-800">Use a simulação para validar como a IA reage às novas instruções sem afetar clientes reais.</p>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button variant="outline" className="w-full gap-2">
                    <Zap className="w-4 h-4" /> Limpar Conversa
                  </Button>
                </CardFooter>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader className="border-b bg-slate-50/50">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Chat de Simulação</CardTitle>
                    <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">Sandbox Ativo</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[400px] p-4 space-y-4">
                    <div className="flex flex-col gap-4">
                      <div className="flex gap-3 max-w-[80%] items-start">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">L</div>
                        <div className="bg-slate-100 p-3 rounded-2xl rounded-tl-none text-sm">
                          Olá! Vi o anúncio de vocês e queria saber o preço do exame de vista.
                        </div>
                      </div>
                      <div className="flex gap-3 max-w-[80%] items-start self-end flex-row-reverse">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 text-white font-bold text-xs">AI</div>
                        <div className="bg-primary text-white p-3 rounded-2xl rounded-tr-none text-sm">
                          Olá! Que bom que você entrou em contato conosco. 😊 O nosso exame de vista custa R$ 100,00, mas temos condições especiais para quem agenda pelo WhatsApp. Você possui algum convênio ou gostaria de agendar no particular?
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                  <div className="p-4 border-t bg-slate-50/50">
                    <div className="flex gap-2">
                      <Input placeholder="Digite sua mensagem de teste..." className="bg-white" />
                      <Button size="icon"><Play className="w-4 h-4" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Revisões de Treinamento</CardTitle>
                <CardDescription>Restaure versões anteriores do conhecimento da IA.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { id: 'v2', date: 'Hoje às 14:20', author: 'João Silva', change: 'Atualização de preços de lentes' },
                    { id: 'v1', date: '01/06/2024 às 09:00', author: 'Maria Oliveira', change: 'Prompt inicial e tom consultivo' },
                  ].map((rev) => (
                    <div key={rev.id} className="flex items-center justify-between p-4 border rounded-xl hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-slate-100 rounded-lg">
                          <History className="w-5 h-5 text-slate-500" />
                        </div>
                        <div>
                          <p className="font-bold text-sm">Versão {rev.id} - {rev.change}</p>
                          <p className="text-xs text-muted-foreground">{rev.date} por {rev.author}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm">Ver Snapshot</Button>
                        <Button variant="outline" size="sm">Restaurar</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
      
      {!config.prompt_system.trim() && (
        <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 border border-red-100 rounded-xl">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm font-medium">Atenção: A IA não responderá sem um Prompt do Sistema definido.</p>
        </div>
      )}
    </div>
  )
}

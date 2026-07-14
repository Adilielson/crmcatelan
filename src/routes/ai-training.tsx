import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Brain, BookOpen, Target, History, Play, Upload, Plus, X,
  AlertCircle, FileText, Zap, Send, Loader2, RotateCcw, Wand2, Sparkles,
} from 'lucide-react'

import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  getAiConfig, updateAiConfig,
  listAiVersions, restoreAiVersion,
  generatePromptCopilot, applyPromptCopilot,
} from '@/lib/ai-training.functions'
import {
  listKnowledgeDocs, uploadKnowledgeDoc, deleteKnowledgeDoc,
} from '@/lib/ai-knowledge.functions'
import { processTrainingObservations } from '@/lib/ai-insights.functions'
import { supabase } from '@/integrations/supabase/client'
import { useAuthStore } from '@/hooks/use-auth'


export const Route = createFileRoute('/ai-training')({
  component: AITrainingSettings,
})

type FormState = {
  prompt_system: string
  sample_scripts: string
  knowledge_base_faq: string
  qualification_questions: string[]
  response_delay: number
  scheduling_link: string
  goal: string
  model_temperature: number
  training_mode: boolean
  autopilot_enabled: boolean
  rejection_instructions: string
}

function AITrainingSettings() {
  const qc = useQueryClient()
  const getCfg = useServerFn(getAiConfig)
  const saveCfg = useServerFn(updateAiConfig)

  const cfgQuery = useQuery({
    queryKey: ['ai-config'],
    queryFn: () => getCfg(),
  })

  const [form, setForm] = useState<FormState | null>(null)
  const [activeTab, setActiveTab] = useState('personality')

  useEffect(() => {
    if (cfgQuery.data && !form) {
      const c = cfgQuery.data
      setForm({
        prompt_system: c.prompt_system ?? '',
        sample_scripts: c.sample_scripts ?? '',
        knowledge_base_faq: c.knowledge_base_faq ?? '',
        qualification_questions: Array.isArray(c.qualification_questions) ? (c.qualification_questions as string[]) : [],
        response_delay: c.response_delay ?? 5,
        scheduling_link: c.scheduling_link ?? '',
        goal: c.goal ?? 'appointment',
        model_temperature: Number(c.model_temperature ?? 0.7),
        training_mode: !!c.training_mode,
        autopilot_enabled: (c as any).autopilot_enabled !== false,
        rejection_instructions: c.rejection_instructions ?? '',
      })
    }
  }, [cfgQuery.data, form])

  const saveMut = useMutation({
    mutationFn: (payload: FormState) => saveCfg({ data: payload as any }),
    onSuccess: (_d, vars) => {
      toast.success('Configurações salvas')
      qc.invalidateQueries({ queryKey: ['ai-config'] })
      qc.invalidateQueries({ queryKey: ['ai-versions'] })
      // Quando o Modo de Aprendizado acabou de ser ligado, dispara observação inicial
      const wasOn = !!cfgQuery.data?.training_mode
      if (!wasOn && vars.training_mode) {
        observeMut.mutate()
      }
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao salvar'),
  })

  const runObserve = useServerFn(processTrainingObservations)
  const observeMut = useMutation({
    mutationFn: () => runObserve(),
    onSuccess: (res: any) => {
      if (res?.ok === false) {
        toast.info(res?.reason ?? 'Modo de Aprendizado desligado')
        return
      }
      toast.success(
        `Observação concluída: ${res?.analyzed ?? 0} conversa(s) analisada(s)` +
          (res?.skipped ? `, ${res.skipped} ignorada(s)` : ''),
      )
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao analisar conversas'),
  })

  const handleSave = () => {
    if (!form) return
    if (!form.prompt_system.trim()) {
      toast.error('Defina o Prompt do Sistema antes de salvar')
      return
    }
    saveMut.mutate(form)
  }


  if (cfgQuery.isLoading || !form) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }
  if (cfgQuery.isError) {
    return (
      <div className="p-8 text-red-600">
        Erro carregando configuração: {(cfgQuery.error as any)?.message}
      </div>
    )
  }

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => f ? { ...f, [k]: v } : f)

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-8 bg-white p-5 sm:p-8 md:p-10 rounded-[18px] md:rounded-[24px] border border-[#E3E6EB] shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="relative z-10 flex items-start sm:items-center gap-4 sm:gap-6 md:gap-8 min-w-0">
          <div className="p-3 sm:p-4 md:p-5 bg-[#FFC400]/10 rounded-[18px] md:rounded-[24px] border border-[#FFC400]/20 shadow-inner shrink-0">
            <Brain className="w-7 h-7 sm:w-9 sm:h-9 md:w-12 md:h-12 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
              <div className="w-6 sm:w-10 h-1 rounded-full bg-primary" />
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.3em] text-primary truncate">Inteligência SDR Ativa</span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-[44px] font-black text-ink tracking-tight font-jakarta leading-tight md:leading-none mb-2 md:mb-4">Treinamento IA</h1>
            <p className="text-gray-500 font-medium text-sm md:text-[15px] max-w-xl">Personalize o comportamento, tom de voz e base de conhecimento da inteligência de atendimento da Ótica Catelan.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-[12px] border ${form.autopilot_enabled ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <Label htmlFor="autopilot" className="text-xs sm:text-sm font-bold cursor-pointer">
              Piloto Automático {form.autopilot_enabled ? '· ON' : '· OFF'}
            </Label>
            <Switch id="autopilot" checked={form.autopilot_enabled} onCheckedChange={(v) => setField('autopilot_enabled', v)} />
          </div>
          <div className="flex items-center gap-2 md:mr-4">
            <Label htmlFor="training-mode" className="text-xs sm:text-sm">Modo de Aprendizado</Label>
            <Switch id="training-mode" checked={form.training_mode} onCheckedChange={(v) => setField('training_mode', v)} />
          </div>
          <Button onClick={handleSave} disabled={saveMut.isPending} className="bg-primary hover:bg-yellow-bright text-[#1a1500] font-black h-12 md:h-14 px-5 md:px-10 rounded-[14px] md:rounded-[16px] shadow-xl shadow-primary/20 uppercase tracking-widest border-none text-[11px] flex-1 md:flex-none">
            {saveMut.isPending ? 'SALVANDO...' : 'SALVAR'}
          </Button>
        </div>
      </div>

      {/* Painel: Modo de Aprendizado */}
      {form.training_mode && (
        <div className="bg-gradient-to-r from-[#FFC400]/10 to-transparent border border-[#FFC400]/30 rounded-[20px] p-6 flex flex-col md:flex-row md:items-center gap-4 justify-between">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-[#FFC400]/20 rounded-xl">
              <Brain className="w-6 h-6 text-primary" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-primary mb-1">Modo de Aprendizado ativo</div>
              <h3 className="text-lg font-black text-ink mb-1">A IA está observando os atendimentos humanos</h3>
              <p className="text-sm text-gray-600 max-w-2xl">
                A cada conversa real entre atendente e cliente no WhatsApp, a IA extrai automaticamente: perguntas frequentes,
                objeções, palavras-chave e respostas que funcionam. Esse aprendizado vira sugestões e melhora as próximas respostas.
              </p>
            </div>
          </div>
          <Button
            onClick={() => observeMut.mutate()}
            disabled={observeMut.isPending}
            variant="outline"
            className="border-[#FFC400] text-ink font-bold hover:bg-[#FFC400]/10 h-11 px-6 rounded-xl whitespace-nowrap"
          >
            {observeMut.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analisando...</>
            ) : (
              <><Zap className="w-4 h-4 mr-2" /> Analisar conversas agora</>
            )}
          </Button>
        </div>
      )}



      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-white border border-border mb-8 w-full justify-start h-16 p-2 rounded-[14px] shadow-inner overflow-x-auto">
          <TabsTrigger value="personality" className="text-[10px] font-black uppercase tracking-[0.15em] data-[state=active]:text-primary data-[state=active]:bg-gray-50 rounded-xl h-full flex items-center gap-2 px-8 text-ink">
            <Zap className="w-4 h-4" /> Personalidade
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="text-[10px] font-black uppercase tracking-[0.15em] data-[state=active]:text-primary data-[state=active]:bg-gray-50 rounded-xl h-full flex items-center gap-2 px-8 text-ink">
            <BookOpen className="w-4 h-4" /> Conhecimento
          </TabsTrigger>
          <TabsTrigger value="qualification" className="text-[10px] font-black uppercase tracking-[0.15em] data-[state=active]:text-primary data-[state=active]:bg-gray-50 rounded-xl h-full flex items-center gap-2 px-8 text-ink">
            <Target className="w-4 h-4" /> Qualificação
          </TabsTrigger>
          <TabsTrigger value="simulation" className="text-[10px] font-black uppercase tracking-[0.15em] data-[state=active]:text-primary data-[state=active]:bg-gray-50 rounded-xl h-full flex items-center gap-2 px-8 text-ink">
            <Play className="w-4 h-4" /> Simulação
          </TabsTrigger>
          <TabsTrigger value="history" className="text-[10px] font-black uppercase tracking-[0.15em] data-[state=active]:text-primary data-[state=active]:bg-gray-50 rounded-xl h-full flex items-center gap-2 px-8 text-ink">
            <History className="w-4 h-4" /> Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personality" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-card border-border bg-white rounded-[14px]">
              <CardHeader className="pb-6 border-b border-border/50 bg-gray-50/50">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-gray-400">Instruções de Abordagem</CardTitle>
                <CardDescription>Defina o tom de voz e o comportamento base da IA.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Prompt do Sistema (Personalidade)</Label>
                  <Textarea
                    className="min-h-[220px] bg-white border-border rounded-xl text-ink font-medium p-4"
                    value={form.prompt_system}
                    onChange={(e) => setField('prompt_system', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Objetivo da Conversa</Label>
                    <Select value={form.goal} onValueChange={(v) => setField('goal', v)}>
                      <SelectTrigger className="bg-white border-border h-12 rounded-xl text-ink font-black text-[10px] uppercase tracking-widest">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="appointment">Agendamento</SelectItem>
                        <SelectItem value="qualification">Qualificação</SelectItem>
                        <SelectItem value="support">Suporte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Temperatura ({form.model_temperature.toFixed(2)})</Label>
                    <Input
                      type="range" min={0} max={1} step={0.05}
                      value={form.model_temperature}
                      onChange={(e) => setField('model_temperature', Number(e.target.value))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card border-border bg-white rounded-[14px]">
              <CardHeader className="pb-6 border-b border-border/50 bg-gray-50/50">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-gray-400">Scripts de Exemplo</CardTitle>
                <CardDescription>Mimetize o estilo de atendimento real.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <Textarea
                  placeholder="Insira diálogos reais de exemplo aqui..."
                  className="min-h-[260px] bg-white border-border rounded-xl text-ink font-medium p-4"
                  value={form.sample_scripts}
                  onChange={(e) => setField('sample_scripts', e.target.value)}
                />
                <p className="text-[11px] text-gray-500 font-bold italic">Bons exemplos ajudam a IA a entender nuances de linguagem.</p>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-card border-border bg-white rounded-[14px]">
            <CardHeader className="pb-4 border-b border-border/50 bg-gray-50/50">
              <CardTitle className="text-sm font-black uppercase tracking-widest text-gray-400">Instruções de Rejeição</CardTitle>
              <CardDescription>O que a IA NUNCA deve fazer.</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <Textarea
                placeholder="Ex: Nunca prometer descontos. Nunca dar diagnóstico médico..."
                className="min-h-[120px]"
                value={form.rejection_instructions}
                onChange={(e) => setField('rejection_instructions', e.target.value)}
              />
            </CardContent>
          </Card>

          
        </TabsContent>

        <TabsContent value="knowledge" className="space-y-6">
          <KnowledgeTab
            faq={form.knowledge_base_faq}
            onFaqChange={(v) => setField('knowledge_base_faq', v)}
          />
        </TabsContent>

        <TabsContent value="qualification" className="space-y-6">
          <QualificationTab
            questions={form.qualification_questions}
            onChange={(q) => setField('qualification_questions', q)}
            delay={form.response_delay}
            onDelayChange={(v) => setField('response_delay', v)}
            link={form.scheduling_link}
            onLinkChange={(v) => setField('scheduling_link', v)}
          />
        </TabsContent>

        <TabsContent value="simulation" className="space-y-6">
          <PromptCopilotCard />
          <SimulationTab />
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <HistoryTab />
        </TabsContent>
      </Tabs>

      {!form.prompt_system.trim() && (
        <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 border border-red-100 rounded-xl">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm font-medium">Atenção: A IA não responderá sem um Prompt do Sistema definido.</p>
        </div>
      )}
    </div>
  )
}

// ============= Knowledge Tab =============
function KnowledgeTab({ faq, onFaqChange }: { faq: string; onFaqChange: (v: string) => void }) {
  const qc = useQueryClient()
  const list = useServerFn(listKnowledgeDocs)
  const upload = useServerFn(uploadKnowledgeDoc)
  const remove = useServerFn(deleteKnowledgeDoc)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const docsQuery = useQuery({ queryKey: ['knowledge-docs'], queryFn: () => list() })

  const removeMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success('Documento removido')
      qc.invalidateQueries({ queryKey: ['knowledge-docs'] })
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao remover'),
  })

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo maior que 10MB')
      return
    }
    setUploading(true)
    try {
      const buf = await file.arrayBuffer()
      // Cópias independentes evitam ArrayBuffer detach pelo pdfjs.
      const bytesForStore = new Uint8Array(buf.slice(0))
      let text = ''
      let extractError: string | null = null
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      try {
        if (isPdf) {
          text = await extractPdfText(buf.slice(0))
        } else {
          text = new TextDecoder().decode(bytesForStore)
        }
      } catch (err: any) {
        extractError = err?.message ?? 'Falha ao extrair texto'
        console.error('[knowledge] extract failed', err)
      }

      const cleanText = (text || '').trim()
      // Se o PDF for scan/imagem, persistimos mesmo assim com um marcador para a IA saber que o documento existe.
      const contentForDb = cleanText.length > 0
        ? cleanText.slice(0, 200000)
        : `[DOCUMENTO ANEXADO SEM TEXTO EXTRAÍVEL]\nArquivo: ${file.name}\nTipo: ${file.type || 'desconhecido'}\nTamanho: ${(file.size / 1024).toFixed(1)} KB\nObservação: o PDF parece ser escaneado (imagem) ou protegido. Reenvie em versão com texto selecionável, ou cole o conteúdo no FAQ ao lado para a IA usar.`

      // base64 para storage
      let bin = ''
      for (let i = 0; i < bytesForStore.length; i++) bin += String.fromCharCode(bytesForStore[i])
      const b64 = btoa(bin)

      await upload({ data: {
        name: file.name,
        file_type: file.type || 'application/octet-stream',
        content: contentForDb,
        file_base64: b64,
        file_size_bytes: file.size,
      }})

      if (cleanText.length > 0) {
        toast.success(`${file.name} salvo (${cleanText.length.toLocaleString()} caracteres) — já compõe a IA`)
      } else {
        toast.warning(`${file.name} salvo, mas sem texto extraível${extractError ? ` (${extractError})` : ''}. Cole o texto no FAQ ao lado para a IA usar o conteúdo.`, { duration: 9000 })
      }
      qc.invalidateQueries({ queryKey: ['knowledge-docs'] })
    } catch (err: any) {
      console.error('[knowledge] upload failed', err)
      toast.error(err?.message ?? 'Falha no upload')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <Card className="shadow-card border-border bg-white rounded-[14px]">
      <CardHeader className="pb-6 border-b border-border/50 bg-gray-50/50">
        <CardTitle className="text-sm font-black uppercase tracking-widest text-gray-400">Documentos & FAQ</CardTitle>
        <CardDescription>Fontes de informação injetadas no prompt da IA.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <Label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Upload de Arquivos (PDF, TXT, MD)</Label>
            <input ref={fileRef} type="file" accept=".pdf,.txt,.md,application/pdf,text/plain" className="hidden" onChange={handleFile} />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-border rounded-xl p-10 flex flex-col items-center justify-center text-center gap-4 hover:border-primary/50 transition-all"
            >
              <div className="p-3 bg-primary/10 rounded-full">
                {uploading ? <Loader2 className="w-6 h-6 text-primary animate-spin" /> : <Upload className="w-6 h-6 text-primary" />}
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-ink mb-1">
                  {uploading ? 'Processando...' : 'Adicionar documento'}
                </p>
                <p className="text-[10px] text-gray-500 font-bold leading-relaxed">PDFs, manuais, tabelas de preços. Máx. 10MB.</p>
              </div>
            </button>

            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Documentos Ativos</p>
              {docsQuery.isLoading && <p className="text-sm text-gray-400">Carregando...</p>}
              {docsQuery.data && docsQuery.data.length === 0 && (
                <p className="text-xs text-gray-400 italic">Nenhum documento carregado.</p>
              )}
              {(docsQuery.data ?? []).map((d: any) => (
                <div key={d.id} className="flex items-center justify-between p-4 bg-white border border-border rounded-xl">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="w-5 h-5 text-primary shrink-0" />
                    <span className="text-xs font-bold text-ink truncate">{d.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-[9px] uppercase">{d.status}</Badge>
                    <Button size="icon" variant="ghost" onClick={() => removeMut.mutate(d.id)} disabled={removeMut.isPending}>
                      <X className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <Label className="text-[10px] font-black uppercase tracking-widest text-gray-500">FAQ Estruturada</Label>
            <Textarea
              placeholder="1. Pergunta? R: Resposta..."
              className="min-h-[400px] font-mono text-[12px] bg-white border-border rounded-xl text-ink p-4"
              value={faq}
              onChange={(e) => onFaqChange(e.target.value)}
            />
            <p className="text-[11px] text-gray-500 italic">Não esqueça de clicar em "Salvar Alterações" no topo.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

async function extractPdfText(buf: ArrayBuffer): Promise<string> {
  const pdfjsLib: any = await import('pdfjs-dist')
  const workerMod: any = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerMod.default
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  let text = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map((it: any) => it.str).join(' ') + '\n\n'
  }
  return text.trim()
}

// ============= Qualification Tab =============
function QualificationTab(props: {
  questions: string[]
  onChange: (q: string[]) => void
  delay: number
  onDelayChange: (v: number) => void
  link: string
  onLinkChange: (v: string) => void
}) {
  return (
    <Card className="bg-white border-[#E3E6EB] shadow-card rounded-[24px]">
      <CardHeader className="pb-8 border-b border-[#E3E6EB] bg-[#F6F7F9]/50">
        <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em] text-primary">Fluxo de Qualificação</CardTitle>
        <CardDescription>Perguntas que a IA fará em sequência para qualificar o lead.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="space-y-3">
          {props.questions.map((q, idx) => (
            <div key={idx} className="flex gap-3 items-center">
              <Badge className="h-6 w-6 rounded-full flex items-center justify-center p-0">{idx + 1}</Badge>
              <Input
                value={q}
                onChange={(e) => {
                  const next = [...props.questions]
                  next[idx] = e.target.value
                  props.onChange(next)
                }}
              />
              <Button variant="ghost" size="icon" className="text-red-500" onClick={() => {
                props.onChange(props.questions.filter((_, i) => i !== idx))
              }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" className="gap-2 w-full border-dashed"
            onClick={() => props.onChange([...props.questions, ''])}>
            <Plus className="w-4 h-4" /> Adicionar Pergunta
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t">
          <div className="space-y-2">
            <Label>Tempo de Resposta (Delay Humano)</Label>
            <div className="flex items-center gap-3">
              <Input type="number" value={props.delay} min={0} max={60}
                onChange={(e) => props.onDelayChange(Math.max(0, Number(e.target.value) || 0))}
                className="w-24" />
              <span className="text-sm text-muted-foreground">segundos</span>
            </div>
            <p className="text-xs text-muted-foreground italic">Evita que a IA pareça um robô respondendo instantaneamente.</p>
          </div>
          <div className="space-y-2">
            <Label>Link de Agendamento Padrão</Label>
            <Input value={props.link} onChange={(e) => props.onLinkChange(e.target.value)} placeholder="https://..." />
          </div>
        </div>
        <p className="text-[11px] text-gray-500 italic">Não esqueça de clicar em "Salvar Alterações" no topo.</p>
      </CardContent>
    </Card>
  )
}

// ============= Simulation Tab =============
function SimulationTab() {
  type Msg = { role: 'user' | 'assistant'; content: string }
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, loading])

  const runSimulation = async (nextMessages: Msg[]) => {
    const { data, error } = await supabase.auth.getSession()
    const token = data.session?.access_token

    if (error || !token) {
      throw new Error('Sua sessão expirou. Faça login novamente para testar a IA.')
    }

    const response = await fetch('/api/ai-training/simulate-chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ messages: nextMessages }),
    })

    const contentType = response.headers.get('content-type') ?? ''
    const body = contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : { error: await response.text().catch(() => '') }

    if (!response.ok) {
      throw new Error(body?.error || 'A simulação não respondeu. Tente novamente.')
    }

    if (typeof body?.reply !== 'string' || !body.reply.trim()) {
      throw new Error('A IA retornou uma resposta vazia.')
    }

    return body.reply.trim() as string
  }

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    const nextMessages: Msg[] = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)
    try {
      const reply = await runSimulation(nextMessages)
      // Quebra a resposta em mensagens menores (estilo WhatsApp): por parágrafos
      // e, se ainda assim ficar grande, por frases.
      const chunks = reply
        .split(/\n{2,}/)
        .flatMap((p: string) =>
          p.length > 220 ? p.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/) : [p]
        )
        .map((c: string) => c.trim())
        .filter(Boolean)

      let acc: Msg[] = nextMessages
      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i]
        const delay = Math.min(3500, 500 + c.length * 22)
        await new Promise((r) => setTimeout(r, delay))
        acc = [...acc, { role: 'assistant', content: c }]
        setMessages(acc)
      }
    } catch (e: any) {
      const message = e?.message ?? 'Erro na simulação'
      toast.error(message)
      setMessages([
        ...nextMessages,
        {
          role: 'assistant',
          content: `Não consegui processar a simulação agora. ${message}`,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="bg-white border-border shadow-card">
      <CardHeader className="border-b border-border bg-gray-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-gray-400">Chat de Simulação</CardTitle>
          <CardDescription>Testa a configuração SALVA — chama o mesmo modelo do atendimento real.</CardDescription>
        </div>
        <div className="flex gap-2 items-center shrink-0">
          <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">Sandbox</Badge>
          <Button variant="outline" size="sm" onClick={() => setMessages([])} disabled={!messages.length}>
            Limpar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div ref={scrollRef} className="h-[60vh] sm:h-[420px] overflow-y-auto p-4 space-y-3 flex flex-col">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 text-sm py-16">
              Comece digitando uma mensagem como se fosse um cliente.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 max-w-[85%] sm:max-w-[80%] ${m.role === 'assistant' ? 'self-start' : 'self-end flex-row-reverse'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${m.role === 'assistant' ? 'bg-primary text-white' : 'bg-slate-200'}`}>
                {m.role === 'assistant' ? 'IA' : 'L'}
              </div>
              <div className={`p-3 rounded-2xl text-sm whitespace-pre-wrap break-words ${m.role === 'assistant' ? 'bg-primary/10 text-ink rounded-tl-none' : 'bg-slate-100 text-ink rounded-tr-none'}`}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3 max-w-[80%] self-start">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-white">IA</div>
              <div className="p-3 bg-primary/10 rounded-2xl rounded-tl-none flex items-center gap-1">
                <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" />
                <span className="ml-2 text-xs text-gray-500">digitando…</span>
              </div>
            </div>
          )}
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); send() }}
          className="p-4 border-t bg-slate-50/50"
        >
          <div className="flex gap-2">
            <Input
              type="text"
              enterKeyHint="send"
              autoComplete="off"
              placeholder="Digite uma mensagem de teste..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              className="flex-1 h-12"
            />
            <Button
              type="submit"
              disabled={loading || !input.trim()}
              className="h-12 px-4 shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// ============= History Tab =============
function HistoryTab() {
  const qc = useQueryClient()
  const list = useServerFn(listAiVersions)
  const restore = useServerFn(restoreAiVersion)
  const q = useQuery({ queryKey: ['ai-versions'], queryFn: () => list() })

  const restoreMut = useMutation({
    mutationFn: (id: string) => restore({ data: { version_id: id } }),
    onSuccess: () => {
      toast.success('Versão restaurada')
      qc.invalidateQueries({ queryKey: ['ai-config'] })
      qc.invalidateQueries({ queryKey: ['ai-versions'] })
      // force refresh of form state
      window.location.reload()
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao restaurar'),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revisões de Treinamento</CardTitle>
        <CardDescription>Cada salvamento gera uma versão. Restaure qualquer uma.</CardDescription>
      </CardHeader>
      <CardContent>
        {q.isLoading && <p className="text-sm text-gray-400">Carregando...</p>}
        {q.data && q.data.length === 0 && (
          <p className="text-sm text-gray-400 italic">Nenhuma versão salva ainda. Edite e clique em "Salvar Alterações" para gerar a primeira.</p>
        )}
        <div className="space-y-3">
          {(q.data ?? []).map((rev: any, idx: number) => {
            const snap = rev.config_snapshot ?? {}
            const date = new Date(rev.created_at).toLocaleString('pt-BR')
            const preview = (snap.prompt_system ?? '').slice(0, 80)
            return (
              <div key={rev.id} className="flex items-center justify-between p-4 border rounded-xl hover:bg-slate-50">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <History className="w-5 h-5 text-slate-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm">Versão {q.data!.length - idx} <span className="text-gray-400 font-normal">— {date}</span></p>
                    <p className="text-xs text-muted-foreground truncate">{preview || '(sem prompt)'}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="gap-2 shrink-0"
                  disabled={restoreMut.isPending}
                  onClick={() => {
                    if (confirm('Restaurar esta versão? A configuração atual será sobrescrita.')) restoreMut.mutate(rev.id)
                  }}>
                  <RotateCcw className="w-3 h-3" /> Restaurar
                </Button>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

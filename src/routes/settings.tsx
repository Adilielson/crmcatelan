import { createFileRoute } from '@tanstack/react-router'
import { Settings as SettingsIcon, Store, Shield, MessageSquare, Zap, Globe, Clock, Bell, Trash2, Plus } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { useAutomations } from '@/hooks/use-automations'
import { toast } from 'sonner'



export const Route = createFileRoute('/settings')({
  component: Settings,
})

function Settings() {
  return (
    <div className="max-w-6xl text-ink">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-card p-8 rounded-[14px] border border-border shadow-card mb-8">
        <div>
          <h1 className="text-4xl font-black text-ink tracking-tight font-jakarta mb-2 uppercase tracking-[0.05em]">Painel de Controle</h1>
          <p className="text-gray-500 font-medium">Gestão estratégica de unidades, IA e automações.</p>
        </div>
      </div>

      <Tabs defaultValue="unit" className="w-full">
        <TabsList className="bg-white border border-border mb-8 w-full justify-start h-14 p-1.5 rounded-[14px] shadow-inner overflow-x-auto overflow-y-hidden scrollbar-hide">
          <TabsTrigger value="unit" className="text-[10px] font-black uppercase tracking-widest data-[state=active]:text-primary data-[state=active]:bg-gray-50 rounded-xl h-full flex items-center gap-2 px-6 transition-all text-ink"><Store className="w-4 h-4" /> Unidade</TabsTrigger>
          <TabsTrigger value="ia" className="text-[10px] font-black uppercase tracking-widest data-[state=active]:text-primary data-[state=active]:bg-gray-50 rounded-xl h-full flex items-center gap-2 px-6 transition-all text-ink"><Shield className="w-4 h-4" /> IA SDR</TabsTrigger>
          <TabsTrigger value="automations" className="text-[10px] font-black uppercase tracking-widest data-[state=active]:text-primary data-[state=active]:bg-gray-50 rounded-xl h-full flex items-center gap-2 px-6 transition-all text-ink"><Zap className="w-4 h-4" /> Automações</TabsTrigger>
          <TabsTrigger value="notifications" className="text-[10px] font-black uppercase tracking-widest data-[state=active]:text-primary data-[state=active]:bg-gray-50 rounded-xl h-full flex items-center gap-2 px-6 transition-all text-ink"><Bell className="w-4 h-4" /> Notificações</TabsTrigger>
          <TabsTrigger value="chat" className="text-[10px] font-black uppercase tracking-widest data-[state=active]:text-primary data-[state=active]:bg-gray-50 rounded-xl h-full flex items-center gap-2 px-6 transition-all text-ink"><MessageSquare className="w-4 h-4" /> WhatsApp</TabsTrigger>
        </TabsList>


        <TabsContent value="unit">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <section className="bg-white border border-border rounded-[14px] p-8 shadow-card relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                  <Store className="w-24 h-24 text-primary" />
                </div>
                <h3 className="text-sm font-black text-ink mb-6 flex items-center gap-3 uppercase tracking-widest">
                  <div className="p-2 bg-primary/10 rounded-xl">
                    <Store className="w-5 h-5 text-primary" />
                  </div>
                  Informações Gerais
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 relative z-10">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Nome da Unidade</Label>
                    <Input defaultValue="Ótica Catelan Matriz" className="bg-white border-border h-12 rounded-xl text-ink font-medium focus:ring-1 focus:ring-primary shadow-inner" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-gray-500">CNPJ</Label>
                    <Input defaultValue="12.345.678/0001-90" className="bg-white border-border h-12 rounded-xl text-ink font-medium focus:ring-1 focus:ring-primary shadow-inner" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-gray-500">WhatsApp Principal</Label>
                    <Input placeholder="+55..." defaultValue="+55 11 98888-7777" className="bg-white border-border h-12 rounded-xl text-ink font-medium focus:ring-1 focus:ring-primary shadow-inner" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Email de Contato</Label>
                    <Input type="email" defaultValue="contato@oticacatelan.com" className="bg-white border-border h-12 rounded-xl text-ink font-medium focus:ring-1 focus:ring-primary shadow-inner" />
                  </div>
                </div>
              </section>

              <section className="bg-white border border-border rounded-[14px] p-8 shadow-card">
                <h3 className="text-sm font-black text-ink mb-6 flex items-center gap-3 uppercase tracking-widest">
                  <div className="p-2 bg-primary/10 rounded-xl">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  Horário de Funcionamento
                </h3>
                <div className="space-y-3">
                  {['Segunda a Sexta', 'Sábado'].map((day) => (
                    <div key={day} className="flex items-center justify-between p-4 bg-white border border-border rounded-[14px] shadow-inner mb-3">
                      <span className="text-xs font-black uppercase tracking-widest text-ink">{day}</span>
                      <div className="flex gap-3 items-center">
                        <Input className="w-24 h-10 text-xs bg-white border-border text-center font-black rounded-lg text-ink" defaultValue="09:00" />
                        <span className="text-gray-600 font-black text-[10px]">ÀS</span>
                        <Input className="w-24 h-10 text-xs bg-white border-border text-center font-black rounded-lg text-ink" defaultValue="18:00" />
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between p-4 bg-gray-50 border border-border rounded-[14px] shadow-inner opacity-60">
                    <span className="text-xs font-black uppercase tracking-widest text-ink">Domingo</span>
                    <Badge variant="outline" className="text-gray-500 font-black text-[10px] uppercase border-border">Fechado</Badge>
                  </div>
                </div>
              </section>
            </div>

            <div className="space-y-6">
              <div className="bg-primary shadow-[0_15px_40px_rgba(255,196,0,0.15)] border border-primary/20 rounded-[14px] p-8">
                <h4 className="font-black text-xs uppercase tracking-[0.15em] text-primary-foreground mb-3">Visibilidade da Unidade</h4>
                <p className="text-[11px] text-primary-foreground/70 mb-6 leading-relaxed font-bold">
                  Esta unidade está ativa e recebendo leads via Google Ads e Instagram.
                </p>
                <Button className="w-full h-11 bg-[#1a1500] hover:bg-black text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all" size="sm">PAUSAR ATENDIMENTO</Button>
              </div>

              <div className="bg-white shadow-card border border-border rounded-[14px] p-8 overflow-hidden relative">
                <div className="absolute -bottom-4 -right-4 opacity-5 rotate-12">
                  <Zap className="w-32 h-32 text-primary" />
                </div>
                <h4 className="font-black text-xs uppercase tracking-[0.15em] text-gray-500 mb-4 relative z-10">Plano Atual</h4>
                <div className="flex items-baseline gap-2 mb-6 relative z-10">
                  <span className="text-4xl font-black text-ink tracking-tighter">PREMIUM</span>
                  <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">/unidade</span>
                </div>
                <Button variant="outline" className="w-full h-11 text-ink border-border hover:bg-gray-50 font-black text-[10px] uppercase tracking-widest rounded-xl relative z-10" size="sm">VER FATURAMENTO</Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="ia">
          <section className="bg-white border rounded-xl p-6 shadow-sm max-w-4xl">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Configuração IA SDR</h3>
            <div className="space-y-6">
              <div className="space-y-1">
                <Label>Tom de Voz da Assistente</Label>
                <select className="w-full bg-white border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary">
                  <option>Consultivo e Amigável (Recomendado)</option>
                  <option>Formal e Profissional</option>
                  <option>Persuasivo e Direto</option>
                </select>
              </div>
              
              <div className="space-y-1">
                <Label>Instruções de Comportamento (System Prompt)</Label>
                <textarea 
                  className="w-full bg-white border rounded-lg px-3 py-2 text-sm h-40 outline-none focus:ring-1 focus:ring-primary leading-relaxed"
                  defaultValue="Você é a assistente virtual da Ótica Catelan. Seu objetivo é realizar o pré-atendimento de forma cordial, identificar a necessidade do cliente (óculos de grau, sol, lentes) e encaminhar para agendamento presencial na unidade..."
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-100">
                <div className="space-y-0.5">
                  <p className="text-sm font-bold text-blue-900">Modo Auto-Agendamento</p>
                  <p className="text-xs text-blue-700">Permite que a IA agende horários diretamente na agenda.</p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button className="bg-primary hover:bg-yellow-bright text-primary-foreground font-black text-xs h-12 px-10 rounded-[14px] shadow-lg shadow-primary/20 transition-all active:scale-95">SALVAR CONFIGURAÇÕES IA</Button>
              </div>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="automations" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="bg-white border rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" /> SLAs e Tempos de Estagnação
              </h3>
              <p className="text-xs text-slate-500 mb-6">Defina por quanto tempo um lead pode ficar parado em cada etapa antes de gerar um alerta.</p>
              
              <div className="space-y-4">
                {useAutomations.getState().rules.map((rule) => (
                  <div key={rule.id} className="p-4 bg-slate-50 rounded-lg border space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-slate-700">{rule.columnName}</span>
                      <div className="flex items-center gap-2">
                        <Input 
                          type="number" 
                          className="w-16 h-8 text-xs text-center" 
                          defaultValue={rule.slaHours} 
                          onChange={(e) => useAutomations.getState().updateRule(rule.id, { slaHours: parseInt(e.target.value) })}
                        />
                        <span className="text-[10px] font-bold text-slate-400">HORAS</span>
                      </div>
                    </div>
                    <div className="flex gap-4 pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <Switch defaultChecked={rule.notifyAgent} onCheckedChange={(val) => useAutomations.getState().updateRule(rule.id, { notifyAgent: val })} />
                        <span className="text-[10px] font-medium text-slate-600">Avisar Atendente</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch defaultChecked={rule.notifyManager} onCheckedChange={(val) => useAutomations.getState().updateRule(rule.id, { notifyManager: val })} />
                        <span className="text-[10px] font-medium text-slate-600">Avisar Gerente</span>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-primary">Abandono Crítico (Leads VIP)</p>
                      <p className="text-[10px] text-slate-500">Alerta máximo para leads de fundo de funil sem interação.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input 
                        type="number" 
                        className="w-16 h-8 text-xs text-center bg-white" 
                        defaultValue={useAutomations.getState().abandonmentThreshold} 
                        onChange={(e) => useAutomations.getState().setAbandonmentThreshold(parseInt(e.target.value))}
                      />
                      <span className="text-[10px] font-bold text-slate-400">HORAS</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-white border rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-primary" /> Webhooks (Marketing)
                </h3>
                <Button size="sm" variant="outline" className="h-8 gap-1">
                  <Plus className="w-3 h-3" /> Novo
                </Button>
              </div>
              <p className="text-xs text-slate-500 mb-6">Envie eventos em tempo real para o Facebook Conversion API ou sua agência.</p>

              <div className="space-y-4">
                {useAutomations.getState().webhooks.map((webhook) => (
                  <div key={webhook.id} className="p-4 border rounded-lg space-y-3 relative group">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{webhook.name}</p>
                        <p className="text-[10px] text-slate-400 truncate max-w-[200px]">{webhook.url}</p>
                      </div>
                      <Switch defaultChecked={webhook.active} onCheckedChange={(val) => useAutomations.getState().updateWebhook(webhook.id, { active: val })} />
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <Badge variant="secondary" className="text-[9px] uppercase tracking-wider">{webhook.event.replace('_', ' ')}</Badge>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-300 hover:text-red-500">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="chat">

          <section className="bg-white border rounded-xl p-6 shadow-sm max-w-4xl">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Configurações de Chat</h3>
            <div className="space-y-6">
              <div className="p-4 border rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold">Templates HSM (WhatsApp)</p>
                    <p className="text-xs text-slate-500">Gerencie mensagens aprovadas pela Meta para iniciar conversas.</p>
                  </div>
                  <Button variant="outline" size="sm">Gerenciar</Button>
                </div>
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold">Arquivo Automático</p>
                    <p className="text-xs text-slate-500">Arquivar conversas de leads marcados como 'Perdido' no Kanban.</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  )
}


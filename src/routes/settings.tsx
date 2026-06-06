import { createFileRoute } from '@tanstack/react-router'
import { Settings as SettingsIcon, Store, Shield, Bell, MessageSquare, Clock } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { useAutomations } from '@/hooks/use-automations'
import { Zap, Globe, Clock, Bell, Trash2, Plus } from 'lucide-react'
import { toast } from 'sonner'


export const Route = createFileRoute('/settings')({
  component: Settings,
})

function Settings() {
  return (
    <div className="max-w-6xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Configurações</h2>
          <p className="text-sm text-slate-500">Gerencie sua unidade e preferências do sistema.</p>
        </div>
      </div>

      <Tabs defaultValue="unit" className="w-full">
        <TabsList className="bg-white border mb-6 w-full justify-start h-12 p-1">
          <TabsTrigger value="unit" className="flex items-center gap-2 px-4"><Store className="w-4 h-4" /> Unidade</TabsTrigger>
          <TabsTrigger value="ia" className="flex items-center gap-2 px-4"><Shield className="w-4 h-4" /> IA SDR</TabsTrigger>
          <TabsTrigger value="automations" className="flex items-center gap-2 px-4"><Zap className="w-4 h-4" /> Automações & SLAs</TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2 px-4"><Bell className="w-4 h-4" /> Notificações</TabsTrigger>
          <TabsTrigger value="chat" className="flex items-center gap-2 px-4"><MessageSquare className="w-4 h-4" /> Chat & WhatsApp</TabsTrigger>
        </TabsList>


        <TabsContent value="unit">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <section className="bg-white border rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Store className="w-5 h-5 text-primary" /> Informações Gerais
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Nome da Unidade</Label>
                    <Input defaultValue="Ótica Castelar Matriz" />
                  </div>
                  <div className="space-y-1">
                    <Label>CNPJ</Label>
                    <Input defaultValue="12.345.678/0001-90" />
                  </div>
                  <div className="space-y-1">
                    <Label>WhatsApp Principal</Label>
                    <Input placeholder="+55..." defaultValue="+55 11 98888-7777" />
                  </div>
                  <div className="space-y-1">
                    <Label>Email de Contato</Label>
                    <Input type="email" defaultValue="contato@oticacastelar.com" />
                  </div>
                </div>
              </section>

              <section className="bg-white border rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" /> Horário de Funcionamento
                </h3>
                <div className="space-y-3">
                  {['Segunda a Sexta', 'Sábado'].map((day) => (
                    <div key={day} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="text-sm font-medium">{day}</span>
                      <div className="flex gap-2">
                        <Input className="w-24 h-8 text-xs" defaultValue="09:00" />
                        <span className="text-slate-400">às</span>
                        <Input className="w-24 h-8 text-xs" defaultValue="18:00" />
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <span className="text-sm font-medium">Domingo</span>
                    <Badge variant="outline" className="text-slate-400">Fechado</Badge>
                  </div>
                </div>
              </section>
            </div>

            <div className="space-y-6">
              <div className="bg-primary/5 border border-primary/10 rounded-xl p-6">
                <h4 className="font-bold text-primary mb-2">Visibilidade da Unidade</h4>
                <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                  Esta unidade está ativa e recebendo leads via Google Ads e Instagram.
                </p>
                <Button className="w-full" size="sm">Pausar Atendimento</Button>
              </div>

              <div className="bg-slate-900 text-white rounded-xl p-6">
                <h4 className="font-bold mb-2">Plano Atual</h4>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-2xl font-bold">Premium</span>
                  <span className="text-xs text-slate-400">/unidade</span>
                </div>
                <Button variant="outline" className="w-full text-white border-white/20 hover:bg-white/10" size="sm">Ver Faturas</Button>
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
                  defaultValue="Você é a assistente virtual da Ótica Castelar. Seu objetivo é realizar o pré-atendimento de forma cordial, identificar a necessidade do cliente (óculos de grau, sol, lentes) e encaminhar para agendamento presencial na unidade..."
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
                <Button>Salvar Configurações IA</Button>
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


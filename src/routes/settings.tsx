import { createFileRoute } from '@tanstack/react-router'
import { Settings as SettingsIcon, Store, MessageSquare, Zap, Globe, Clock, Bell, Trash2, Plus, Loader2, KeyRound, Target, ShieldAlert, Instagram, Facebook, Link as LinkIcon } from 'lucide-react'
import { GoalsSettings } from '@/components/settings/GoalsSettings'
import { NoShowSettingsSection } from '@/components/settings/NoShowSettingsSection'
import { WhatsAppConfig } from '@/pages/WhatsAppConfig'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from '@/components/ui/button'
import { supabase } from '@/integrations/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { useAutomations } from '@/hooks/use-automations'
import { toast } from 'sonner'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { getBusinessHours, updateBusinessHours, resolveTimezoneFromAddress, type BusinessHours, type DayKey } from '@/lib/business-hours.functions'




export const Route = createFileRoute('/settings')({
  component: Settings,
})

const DAY_LIST: { key: DayKey; label: string }[] = [
  { key: 'mon', label: 'Segunda' },
  { key: 'tue', label: 'Terça' },
  { key: 'wed', label: 'Quarta' },
  { key: 'thu', label: 'Quinta' },
  { key: 'fri', label: 'Sexta' },
  { key: 'sat', label: 'Sábado' },
  { key: 'sun', label: 'Domingo' },
]

const DEFAULT_HOURS: BusinessHours = {
  mon: ['09:00', '18:00'], tue: ['09:00', '18:00'], wed: ['09:00', '18:00'],
  thu: ['09:00', '18:00'], fri: ['09:00', '18:00'], sat: ['09:00', '13:00'], sun: null,
}

// ============================================================
// Shared state for Unidade tab: hours + address + timezone
// ============================================================
type UnitCtx = {
  hours: BusinessHours
  setHours: React.Dispatch<React.SetStateAction<BusinessHours>>
  address: string
  setAddress: (v: string) => void
  tz: string
  tzLocation: string | null
  loading: boolean
  saving: boolean
  detectingTz: boolean
  detectTimezone: () => Promise<void>
  save: () => Promise<void>
}
const UnitContext = createContext<UnitCtx | null>(null)
const useUnit = () => {
  const ctx = useContext(UnitContext)
  if (!ctx) throw new Error('useUnit must be used within UnitProvider')
  return ctx
}

function UnitProvider({ children }: { children: ReactNode }) {
  const fetchHours = useServerFn(getBusinessHours)
  const saveHours = useServerFn(updateBusinessHours)
  const resolveTz = useServerFn(resolveTimezoneFromAddress)
  const [hours, setHours] = useState<BusinessHours>(DEFAULT_HOURS)
  const [tz, setTz] = useState('America/Sao_Paulo')
  const [address, setAddress] = useState('')
  const [tzLocation, setTzLocation] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [detectingTz, setDetectingTz] = useState(false)

  useEffect(() => {
    fetchHours()
      .then((r) => {
        if (r.business_hours) setHours(r.business_hours)
        if (r.timezone) setTz(r.timezone)
        if (r.address) setAddress(r.address)
      })
      .catch((e) => toast.error('Erro ao carregar dados da loja: ' + (e instanceof Error ? e.message : String(e))))
      .finally(() => setLoading(false))
  }, [])

  const detectTimezone = async () => {
    const addr = address.trim()
    if (addr.length < 5) {
      toast.error('Informe um endereço válido (rua, cidade, UF).')
      return
    }
    setDetectingTz(true)
    try {
      const r = await resolveTz({ data: { address: addr } })
      setTz(r.timezone)
      setTzLocation(r.display_name)
      toast.success(`Fuso detectado: ${r.timezone}`)
    } catch (e) {
      toast.error('Não foi possível detectar o fuso: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setDetectingTz(false)
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      await saveHours({ data: { business_hours: hours, timezone: tz, address } })
      toast.success('Loja atualizada. A IA SDR vai respeitar a partir de agora.')
    } catch (e) {
      toast.error('Erro ao salvar: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setSaving(false)
    }
  }

  return (
    <UnitContext.Provider
      value={{ hours, setHours, address, setAddress, tz, tzLocation, loading, saving, detectingTz, detectTimezone, save }}
    >
      {children}
    </UnitContext.Provider>
  )
}

// ============================================================
// Store address + auto-detected timezone (shown in Informações Gerais)
// ============================================================
function StoreAddressField() {
  const { address, setAddress, tz, tzLocation, detectTimezone, detectingTz, loading } = useUnit()
  return (
    <>
      <div className="space-y-2 sm:col-span-2">
        <Label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Endereço da Loja</Label>
        <div className="flex gap-2">
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onBlur={detectTimezone}
            placeholder="Rua, número, bairro, cidade - UF"
            disabled={loading}
            className="bg-white border-border h-12 rounded-xl text-ink font-medium focus:ring-1 focus:ring-primary shadow-inner flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={detectTimezone}
            disabled={detectingTz || loading || address.trim().length < 5}
            className="h-12 text-[10px] font-black uppercase tracking-widest rounded-xl"
          >
            {detectingTz ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Detectar fuso'}
          </Button>
        </div>
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Fuso Horário (detectado do endereço)</Label>
        <div className="flex items-center gap-2 h-12 px-3 rounded-xl bg-gray-50 border border-border">
          <Globe className="w-4 h-4 text-primary" />
          <span className="text-xs font-black text-ink">{tz}</span>
          {tzLocation && (
            <span className="text-[10px] text-gray-500 truncate ml-2" title={tzLocation}>
              · {tzLocation}
            </span>
          )}
        </div>
        <p className="text-[10px] text-gray-400">
          O fuso é resolvido automaticamente pelo endereço acima e persistido junto com o horário de funcionamento.
        </p>
      </div>
    </>
  )
}

// ============================================================
// Weekly business hours
// ============================================================
function BusinessHoursSection() {
  const { hours, setHours, save, saving, loading } = useUnit()

  const toggleDay = (k: DayKey) => {
    setHours((h) => ({ ...h, [k]: h[k] ? null : ['09:00', '18:00'] }))
  }
  const setTime = (k: DayKey, idx: 0 | 1, val: string) => {
    setHours((h) => {
      const cur = h[k] ?? ['09:00', '18:00']
      const next: [string, string] = idx === 0 ? [val, cur[1]] : [cur[0], val]
      return { ...h, [k]: next }
    })
  }

  return (
    <section className="bg-white border border-border rounded-[14px] p-8 shadow-card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-black text-ink flex items-center gap-3 uppercase tracking-widest">
          <div className="p-2 bg-primary/10 rounded-xl">
            <Clock className="w-5 h-5 text-primary" />
          </div>
          Horário de Funcionamento
        </h3>
        <Button onClick={save} disabled={saving || loading} size="sm" className="h-10 text-[10px] font-black uppercase tracking-widest">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Salvar loja'}
        </Button>
      </div>
      <p className="text-[11px] text-gray-500 mb-4">
        Fora deste horário, a IA SDR <strong>não oferece atendente humano</strong> — apenas agendamento de consulta.
      </p>
      <div className="space-y-2">
        {DAY_LIST.map(({ key, label }) => {
          const slot = hours[key]
          return (
            <div key={key} className="flex items-center justify-between p-3 bg-white border border-border rounded-[14px] shadow-inner">
              <div className="flex items-center gap-3 min-w-[140px]">
                <Switch checked={!!slot} onCheckedChange={() => toggleDay(key)} disabled={loading} />
                <span className="text-xs font-black uppercase tracking-widest text-ink">{label}</span>
              </div>
              {slot ? (
                <div className="flex gap-3 items-center">
                  <Input type="time" value={slot[0]} onChange={(e) => setTime(key, 0, e.target.value)} className="w-28 h-10 text-xs bg-white border-border text-center font-black rounded-lg text-ink" />
                  <span className="text-gray-600 font-black text-[10px]">ÀS</span>
                  <Input type="time" value={slot[1]} onChange={(e) => setTime(key, 1, e.target.value)} className="w-28 h-10 text-xs bg-white border-border text-center font-black rounded-lg text-ink" />
                </div>
              ) : (
                <Badge variant="outline" className="text-gray-500 font-black text-[10px] uppercase border-border">Fechado</Badge>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}



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
          
          <TabsTrigger value="automations" className="text-[10px] font-black uppercase tracking-widest data-[state=active]:text-primary data-[state=active]:bg-gray-50 rounded-xl h-full flex items-center gap-2 px-6 transition-all text-ink"><Zap className="w-4 h-4" /> Automações</TabsTrigger>
          <TabsTrigger value="notifications" className="text-[10px] font-black uppercase tracking-widest data-[state=active]:text-primary data-[state=active]:bg-gray-50 rounded-xl h-full flex items-center gap-2 px-6 transition-all text-ink"><Bell className="w-4 h-4" /> Notificações</TabsTrigger>
          <TabsTrigger value="chat" className="text-[10px] font-black uppercase tracking-widest data-[state=active]:text-primary data-[state=active]:bg-gray-50 rounded-xl h-full flex items-center gap-2 px-6 transition-all text-ink"><MessageSquare className="w-4 h-4" /> WhatsApp</TabsTrigger>
          <TabsTrigger value="noshow" className="text-[10px] font-black uppercase tracking-widest data-[state=active]:text-primary data-[state=active]:bg-gray-50 rounded-xl h-full flex items-center gap-2 px-6 transition-all text-ink"><ShieldAlert className="w-4 h-4" /> No-Show</TabsTrigger>
          <TabsTrigger value="goals" className="text-[10px] font-black uppercase tracking-widest data-[state=active]:text-primary data-[state=active]:bg-gray-50 rounded-xl h-full flex items-center gap-2 px-6 transition-all text-ink"><Target className="w-4 h-4" /> Metas & Consultas</TabsTrigger>
          <TabsTrigger value="account" className="text-[10px] font-black uppercase tracking-widest data-[state=active]:text-primary data-[state=active]:bg-gray-50 rounded-xl h-full flex items-center gap-2 px-6 transition-all text-ink"><KeyRound className="w-4 h-4" /> Conta</TabsTrigger>
        </TabsList>


        <TabsContent value="unit">
          <UnitProvider>
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
                  <StoreAddressField />
                </div>
              </section>

              <BusinessHoursSection />

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
          </UnitProvider>
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
          <WhatsAppConfig />
        </TabsContent>

        <TabsContent value="noshow">
          <NoShowSettingsSection />
        </TabsContent>

        <TabsContent value="goals">
          <GoalsSettings />
        </TabsContent>

        <TabsContent value="account">
          <ChangePasswordSection />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 8) {
      toast.error('A nova senha deve ter pelo menos 8 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('A confirmação não confere com a nova senha.')
      return
    }
    setSaving(true)
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser()
      if (userErr || !userData.user?.email) {
        throw new Error('Sessão inválida. Faça login novamente.')
      }
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: userData.user.email,
        password: currentPassword,
      })
      if (signInErr) {
        throw new Error('Senha atual incorreta.')
      }
      const { error: updErr } = await supabase.auth.updateUser({ password: newPassword })
      if (updErr) throw updErr
      toast.success('Senha alterada com sucesso!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao alterar senha.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="bg-white border border-border rounded-[14px] p-8 shadow-card max-w-xl">
      <h3 className="text-sm font-black text-ink flex items-center gap-3 uppercase tracking-widest mb-2">
        <div className="p-2 bg-primary/10 rounded-xl">
          <KeyRound className="w-5 h-5 text-primary" />
        </div>
        Alterar Senha
      </h3>
      <p className="text-[11px] text-gray-500 mb-6">
        Mínimo de 8 caracteres. Você precisará informar a senha atual para confirmar.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="current-password" className="text-xs font-black uppercase tracking-widest text-gray-600">Senha atual</Label>
          <Input id="current-password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoComplete="current-password" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-password" className="text-xs font-black uppercase tracking-widest text-gray-600">Nova senha</Label>
          <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password" className="text-xs font-black uppercase tracking-widest text-gray-600">Confirmar nova senha</Label>
          <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
        </div>
        <Button type="submit" disabled={saving} className="h-10 text-[10px] font-black uppercase tracking-widest">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Alterar senha'}
        </Button>
      </form>
    </section>
  )
}


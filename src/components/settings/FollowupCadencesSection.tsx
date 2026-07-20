import { useEffect, useMemo, useState } from 'react'
import {
  Loader2, Plus, Save, Trash2, GripVertical, MessageCircle, PhoneCall,
  Sparkles, TrendingUp, Users, ChevronDown, ChevronRight, AlertCircle,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { supabase } from '@/integrations/supabase/client'
import { useAuthStore } from '@/hooks/use-auth'
import { toast } from 'sonner'

type Cadence = {
  id: string
  tenant_id: string
  name: string
  description: string | null
  trigger_type: 'lead_silent' | 'post_exam' | 'custom'
  enabled: boolean
  silence_minutes: number
  cold_after_step: number | null
}

type Step = {
  id: string
  cadence_id: string
  tenant_id: string
  position: number
  offset_minutes: number
  channel: 'whatsapp' | 'call'
  message_template: string
  label: string | null
  enabled: boolean
  _dirty?: boolean
  _new?: boolean
}

const VARIABLES = ['{primeiro_nome}', '{nome}', '{telefone}']

function humanizeOffset(mins: number) {
  if (mins < 60) return `${mins} min`
  if (mins < 1440) return `${Math.round(mins / 60)}h`
  return `${Math.round(mins / 1440)}d`
}

function offsetToParts(mins: number): { value: number; unit: 'min' | 'h' | 'd' } {
  if (mins % 1440 === 0) return { value: mins / 1440, unit: 'd' }
  if (mins % 60 === 0) return { value: mins / 60, unit: 'h' }
  return { value: mins, unit: 'min' }
}
function partsToOffset(value: number, unit: 'min' | 'h' | 'd'): number {
  const v = Math.max(0, value || 0)
  if (unit === 'd') return v * 1440
  if (unit === 'h') return v * 60
  return v
}

export function FollowupCadencesSection() {
  const tenantId = useAuthStore((s) => s.tenant?.id ?? null)
  const [loading, setLoading] = useState(true)
  const [cadences, setCadences] = useState<Cadence[]>([])
  const [stepsMap, setStepsMap] = useState<Record<string, Step[]>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [kpis, setKpis] = useState({ silent: 0, cold: 0, recovered30: 0, sent7: 0 })

  useEffect(() => {
    if (!tenantId) return
    ;(async () => {
      setLoading(true)
      const [{ data: cads }, { data: stps }] = await Promise.all([
        (supabase as any).from('followup_cadences').select('*').eq('tenant_id', tenantId).order('created_at'),
        (supabase as any).from('followup_cadence_steps').select('*').eq('tenant_id', tenantId).order('position'),
      ])
      setCadences((cads ?? []) as Cadence[])
      const map: Record<string, Step[]> = {}
      for (const s of (stps ?? []) as Step[]) {
        map[s.cadence_id] ??= []
        map[s.cadence_id].push(s)
      }
      setStepsMap(map)
      if (cads && cads[0]) setExpanded({ [cads[0].id]: true })

      // KPIs
      const since7 = new Date(Date.now() - 7 * 86400_000).toISOString()
      const since30 = new Date(Date.now() - 30 * 86400_000).toISOString()
      const [silent, cold, recovered30, sent7] = await Promise.all([
        (supabase as any).from('leads').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('engagement_status', 'silent'),
        (supabase as any).from('leads').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('engagement_status', 'cold'),
        (supabase as any).from('leads').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('engagement_status', 'recovered').gte('updated_at', since30),
        (supabase as any).from('lead_followups').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'sent').not('cadence_id', 'is', null).gte('sent_at', since7),
      ])
      setKpis({
        silent: silent.count ?? 0,
        cold: cold.count ?? 0,
        recovered30: recovered30.count ?? 0,
        sent7: sent7.count ?? 0,
      })
      setLoading(false)
    })()
  }, [tenantId])

  function patchCadence(id: string, changes: Partial<Cadence>) {
    setCadences((prev) => prev.map((c) => (c.id === id ? { ...c, ...changes } : c)))
  }
  function patchStep(cadId: string, stepId: string, changes: Partial<Step>) {
    setStepsMap((prev) => ({
      ...prev,
      [cadId]: (prev[cadId] ?? []).map((s) => (s.id === stepId ? { ...s, ...changes, _dirty: true } : s)),
    }))
  }

  async function saveCadence(c: Cadence) {
    setSaving(c.id)
    const { error } = await (supabase as any)
      .from('followup_cadences')
      .update({
        name: c.name,
        description: c.description,
        enabled: c.enabled,
        silence_minutes: c.silence_minutes,
        cold_after_step: c.cold_after_step,
      })
      .eq('id', c.id)
    if (error) toast.error('Erro: ' + error.message)
    else toast.success('Cadência salva')
    setSaving(null)
  }

  async function saveStep(cadId: string, s: Step) {
    setSaving(s.id)
    if (s._new) {
      const { data, error } = await (supabase as any)
        .from('followup_cadence_steps')
        .insert({
          cadence_id: cadId,
          tenant_id: tenantId,
          position: s.position,
          offset_minutes: s.offset_minutes,
          channel: s.channel,
          message_template: s.message_template,
          label: s.label,
          enabled: s.enabled,
        })
        .select('*')
        .single()
      if (error) toast.error('Erro: ' + error.message)
      else {
        setStepsMap((prev) => ({
          ...prev,
          [cadId]: (prev[cadId] ?? []).map((x) => (x.id === s.id ? { ...(data as Step), _dirty: false } : x)),
        }))
        toast.success('Passo adicionado')
      }
    } else {
      const { error } = await (supabase as any)
        .from('followup_cadence_steps')
        .update({
          offset_minutes: s.offset_minutes,
          channel: s.channel,
          message_template: s.message_template,
          label: s.label,
          enabled: s.enabled,
        })
        .eq('id', s.id)
      if (error) toast.error('Erro: ' + error.message)
      else {
        patchStep(cadId, s.id, { _dirty: false })
        toast.success('Passo atualizado')
      }
    }
    setSaving(null)
  }

  async function removeStep(cadId: string, s: Step) {
    if (!confirm('Remover este passo?')) return
    if (!s._new) {
      const { error } = await (supabase as any).from('followup_cadence_steps').delete().eq('id', s.id)
      if (error) { toast.error(error.message); return }
    }
    setStepsMap((prev) => ({ ...prev, [cadId]: (prev[cadId] ?? []).filter((x) => x.id !== s.id) }))
  }

  function addStep(cadId: string) {
    const list = stepsMap[cadId] ?? []
    const nextPos = (list[list.length - 1]?.position ?? 0) + 1
    const newStep: Step = {
      id: `new-${Date.now()}`,
      cadence_id: cadId,
      tenant_id: tenantId!,
      position: nextPos,
      offset_minutes: 1440,
      channel: 'whatsapp',
      message_template: 'Oi {primeiro_nome}, ',
      label: `Passo ${nextPos}`,
      enabled: true,
      _new: true,
      _dirty: true,
    }
    setStepsMap((prev) => ({ ...prev, [cadId]: [...list, newStep] }))
  }

  async function toggleCadence(c: Cadence, enabled: boolean) {
    patchCadence(c.id, { enabled })
    await (supabase as any).from('followup_cadences').update({ enabled }).eq('id', c.id)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando cadências...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={<Users className="w-4 h-4" />} label="Em cadência agora" value={kpis.silent} tone="warn" />
        <KpiCard icon={<AlertCircle className="w-4 h-4" />} label="Marcados como frio" value={kpis.cold} tone="muted" />
        <KpiCard icon={<TrendingUp className="w-4 h-4" />} label="Recuperados (30d)" value={kpis.recovered30} tone="good" />
        <KpiCard icon={<MessageCircle className="w-4 h-4" />} label="Mensagens enviadas (7d)" value={kpis.sent7} tone="brand" />
      </div>

      <div>
        <h3 className="text-lg font-bold text-ink">Cadências de Follow-up</h3>
        <p className="text-sm text-muted-foreground">
          Réguas automáticas de reengajamento. Quando o lead responde, a cadência para sozinha.
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {VARIABLES.map((v) => (
            <code key={v} className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded border font-mono">{v}</code>
          ))}
        </div>
      </div>

      {cadences.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">
          Nenhuma cadência configurada.
        </Card>
      )}

      {cadences.map((c) => {
        const steps = stepsMap[c.id] ?? []
        const isOpen = expanded[c.id] ?? false
        return (
          <Card key={c.id} className="p-0 overflow-hidden border-2">
            <div className="p-4 bg-gray-50 flex items-start gap-3">
              <button
                onClick={() => setExpanded((p) => ({ ...p, [c.id]: !isOpen }))}
                className="mt-1 text-muted-foreground hover:text-ink"
                aria-label="Expandir"
              >
                {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Input
                    value={c.name}
                    onChange={(e) => patchCadence(c.id, { name: e.target.value })}
                    className="h-8 max-w-md font-bold text-sm"
                  />
                  <Badge variant={c.enabled ? 'default' : 'secondary'}>
                    {c.enabled ? 'Ativa' : 'Pausada'}
                  </Badge>
                  {c.trigger_type === 'lead_silent' && (
                    <Badge variant="outline" className="gap-1"><Sparkles className="w-3 h-3" /> Lead silencioso</Badge>
                  )}
                  <Badge variant="outline">{steps.length} passos</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{c.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={c.enabled} onCheckedChange={(v) => toggleCadence(c, v)} />
                <Button size="sm" variant="outline" onClick={() => saveCadence(c)} disabled={saving === c.id}>
                  {saving === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                </Button>
              </div>
            </div>

            {isOpen && (
              <div className="p-4 space-y-4">
                {c.trigger_type === 'lead_silent' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">Aciona depois de quanto tempo sem resposta (min)</Label>
                      <Input
                        type="number"
                        value={c.silence_minutes}
                        onChange={(e) => patchCadence(c.id, { silence_minutes: parseInt(e.target.value || '0', 10) })}
                        className="h-9"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">{humanizeOffset(c.silence_minutes)} de silêncio</p>
                    </div>
                    <div>
                      <Label className="text-xs">Marcar como frio a partir do passo Nº</Label>
                      <Input
                        type="number"
                        value={c.cold_after_step ?? ''}
                        onChange={(e) => patchCadence(c.id, { cold_after_step: e.target.value ? parseInt(e.target.value, 10) : null })}
                        className="h-9"
                        placeholder="Ex: 4"
                      />
                    </div>
                  </div>
                )}

                <Separator />

                <div className="space-y-3">
                  {steps.map((s) => (
                    <StepRow
                      key={s.id}
                      step={s}
                      onChange={(changes) => patchStep(c.id, s.id, changes)}
                      onSave={() => saveStep(c.id, s)}
                      onRemove={() => removeStep(c.id, s)}
                      saving={saving === s.id}
                    />
                  ))}
                  <Button size="sm" variant="outline" onClick={() => addStep(c.id)} className="gap-1">
                    <Plus className="w-3 h-3" /> Adicionar passo
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

function KpiCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: 'brand' | 'good' | 'warn' | 'muted' }) {
  const toneCls = {
    brand: 'text-primary bg-primary/10',
    good: 'text-green-600 bg-green-50',
    warn: 'text-amber-600 bg-amber-50',
    muted: 'text-gray-600 bg-gray-100',
  }[tone]
  return (
    <Card className="p-3 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${toneCls}`}>{icon}</div>
      <div>
        <div className="text-xl font-black text-ink leading-none">{value}</div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-bold">{label}</div>
      </div>
    </Card>
  )
}

function StepRow({
  step, onChange, onSave, onRemove, saving,
}: {
  step: Step
  onChange: (c: Partial<Step>) => void
  onSave: () => void
  onRemove: () => void
  saving: boolean
}) {
  const parts = useMemo(() => offsetToParts(step.offset_minutes), [step.offset_minutes])
  return (
    <div className="border border-border rounded-xl p-3 bg-white space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <GripVertical className="w-4 h-4 text-muted-foreground" />
        <Badge variant="outline" className="font-mono">#{step.position}</Badge>
        <Input
          value={step.label ?? ''}
          onChange={(e) => onChange({ label: e.target.value })}
          className="h-8 max-w-xs text-sm font-bold"
          placeholder="Rótulo interno"
        />
        <div className="flex-1" />
        <Switch checked={step.enabled} onCheckedChange={(v) => onChange({ enabled: v })} />
        {step._dirty && <Badge variant="secondary" className="text-[10px]">não salvo</Badge>}
        <Button size="sm" variant="ghost" onClick={onSave} disabled={saving} className="h-8">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
        </Button>
        <Button size="sm" variant="ghost" onClick={onRemove} className="h-8 text-red-600">
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Disparar após</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              value={parts.value}
              onChange={(e) => onChange({ offset_minutes: partsToOffset(parseInt(e.target.value || '0', 10), parts.unit) })}
              className="h-9"
            />
            <select
              value={parts.unit}
              onChange={(e) => onChange({ offset_minutes: partsToOffset(parts.value, e.target.value as any) })}
              className="h-9 px-2 rounded-md border bg-white text-sm"
            >
              <option value="min">min</option>
              <option value="h">horas</option>
              <option value="d">dias</option>
            </select>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">= {humanizeOffset(step.offset_minutes)} do início</p>
        </div>
        <div>
          <Label className="text-xs">Canal</Label>
          <select
            value={step.channel}
            onChange={(e) => onChange({ channel: e.target.value as any })}
            className="w-full h-9 rounded-md border px-2 text-sm bg-white"
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="call">Ligação (manual)</option>
          </select>
        </div>
        <div className="flex items-end text-[10px] text-muted-foreground">
          {step.channel === 'whatsapp' ? <MessageCircle className="w-3 h-3 mr-1" /> : <PhoneCall className="w-3 h-3 mr-1" />}
          {step.channel === 'whatsapp' ? 'Enviado automaticamente' : 'Cria tarefa pro atendente'}
        </div>
      </div>

      <div>
        <Label className="text-xs">Mensagem</Label>
        <Textarea
          value={step.message_template}
          onChange={(e) => onChange({ message_template: e.target.value })}
          rows={3}
          className="text-sm font-mono"
          placeholder="Deixe em branco se este passo só serve para marcar o lead como frio."
        />
      </div>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Bell, Repeat, ShieldAlert, Save } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase } from '@/integrations/supabase/client'
import { useAuthStore } from '@/hooks/use-auth'
import { toast } from 'sonner'

type Kind = 'appointment' | 'followup' | 'noshow'

interface Template {
  id: string
  tenant_id: string
  kind: Kind
  step_key: string
  label: string
  message_template: string
  channel: 'whatsapp' | 'call'
  offset_minutes: number
  enabled: boolean
  position: number
}

const KIND_META: Record<Kind, { title: string; icon: React.ReactNode; hint: string; unit: 'before' | 'after' }> = {
  appointment: {
    title: 'Confirmação de Agendamento',
    icon: <Bell className="w-4 h-4" />,
    hint: 'Disparados ANTES do horário do exame. Use valores negativos (ex: -1440 = 24h antes).',
    unit: 'before',
  },
  followup: {
    title: 'Follow-up Pós-Exame',
    icon: <Repeat className="w-4 h-4" />,
    hint: 'Disparados DEPOIS que o lead entrou em follow-up. Valores em minutos (1440 = 1 dia).',
    unit: 'after',
  },
  noshow: {
    title: 'Alertas de No-Show',
    icon: <ShieldAlert className="w-4 h-4" />,
    hint: 'Disparados APÓS o horário quando o cliente não fez check-in. Interno para atendentes.',
    unit: 'after',
  },
}

const VARIABLE_HINTS = ['{nome}', '{data}', '{hora}', '{telefone}', '{endereco_opt}']

function formatOffset(mins: number): string {
  const abs = Math.abs(mins)
  if (abs === 0) return 'no horário'
  if (abs % 1440 === 0) return `${abs / 1440} dia(s)`
  if (abs % 60 === 0) return `${abs / 60} hora(s)`
  return `${abs} min`
}

export function ReminderTemplatesSection() {
  const tenantId = useAuthStore((s) => s.tenant?.id ?? null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])

  useEffect(() => {
    if (!tenantId) return
    setLoading(true)
    ;(async () => {
      const { data, error } = await (supabase as any)
        .from('reminder_templates')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('kind')
        .order('position')
      if (error) {
        toast.error('Erro ao carregar lembretes: ' + error.message)
      } else {
        setTemplates((data ?? []) as Template[])
      }
      setLoading(false)
    })()
  }, [tenantId])

  const grouped = useMemo(() => {
    const g: Record<Kind, Template[]> = { appointment: [], followup: [], noshow: [] }
    for (const t of templates) g[t.kind].push(t)
    return g
  }, [templates])

  function patch(id: string, changes: Partial<Template>) {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, ...changes } : t)))
  }

  async function save(t: Template) {
    setSaving(t.id)
    const { error } = await (supabase as any)
      .from('reminder_templates')
      .update({
        label: t.label,
        message_template: t.message_template,
        offset_minutes: t.offset_minutes,
        channel: t.channel,
        enabled: t.enabled,
      })
      .eq('id', t.id)
    setSaving(null)
    if (error) toast.error('Erro ao salvar: ' + error.message)
    else toast.success('Lembrete atualizado')
  }

  async function toggle(t: Template, enabled: boolean) {
    patch(t.id, { enabled })
    const { error } = await (supabase as any)
      .from('reminder_templates')
      .update({ enabled })
      .eq('id', t.id)
    if (error) {
      toast.error('Erro ao alterar: ' + error.message)
      patch(t.id, { enabled: !enabled })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando lembretes...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-ink">Central de Lembretes</h3>
        <p className="text-sm text-muted-foreground">
          Edite mensagens e prazos que a IA e o sistema disparam automaticamente.
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {VARIABLE_HINTS.map((v) => (
            <code key={v} className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded border font-mono">
              {v}
            </code>
          ))}
        </div>
      </div>

      <Tabs defaultValue="appointment" className="w-full">
        <TabsList className="grid grid-cols-3 w-full">
          {(Object.keys(KIND_META) as Kind[]).map((k) => (
            <TabsTrigger key={k} value={k} className="gap-2 text-xs">
              {KIND_META[k].icon} {KIND_META[k].title}
            </TabsTrigger>
          ))}
        </TabsList>

        {(Object.keys(KIND_META) as Kind[]).map((k) => (
          <TabsContent key={k} value={k} className="space-y-3 mt-4">
            <p className="text-xs text-muted-foreground">{KIND_META[k].hint}</p>
            {grouped[k].length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Nenhum template configurado.
              </p>
            )}
            {grouped[k].map((t) => (
              <Card key={t.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Input
                        value={t.label}
                        onChange={(e) => patch(t.id, { label: e.target.value })}
                        className="h-8 text-sm font-bold max-w-xs"
                      />
                      <Badge variant="outline" className="text-[10px]">{t.step_key}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Ativo</Label>
                    <Switch checked={t.enabled} onCheckedChange={(v) => toggle(t, v)} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Quando disparar (minutos)</Label>
                    <Input
                      type="number"
                      value={t.offset_minutes}
                      onChange={(e) => patch(t.id, { offset_minutes: parseInt(e.target.value || '0', 10) })}
                      className="h-8"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {t.offset_minutes < 0 ? `${formatOffset(t.offset_minutes)} antes` : `${formatOffset(t.offset_minutes)} depois`}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs">Canal</Label>
                    <select
                      className="w-full h-8 rounded-md border px-2 text-sm bg-white"
                      value={t.channel}
                      onChange={(e) => patch(t.id, { channel: e.target.value as any })}
                    >
                      <option value="whatsapp">WhatsApp</option>
                      <option value="call">Ligação (manual)</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      size="sm"
                      onClick={() => save(t)}
                      disabled={saving === t.id}
                      className="w-full gap-1"
                    >
                      {saving === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      Salvar
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Mensagem</Label>
                  <Textarea
                    value={t.message_template}
                    onChange={(e) => patch(t.id, { message_template: e.target.value })}
                    rows={3}
                    className="text-sm font-mono"
                  />
                </div>
              </Card>
            ))}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

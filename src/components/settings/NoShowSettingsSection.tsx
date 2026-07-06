import { useEffect, useState } from 'react';
import { Loader2, ShieldAlert, MessageCircle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNoShowSettings, useUpdateNoShowSettings, type NoShowSettings } from '@/hooks/use-noshow-settings';

export function NoShowSettingsSection() {
  const { data, isLoading } = useNoShowSettings();
  const update = useUpdateNoShowSettings();
  const [form, setForm] = useState<Partial<NoShowSettings>>({});

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  if (isLoading) {
    return <div className="p-10 text-center text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Carregando…</div>;
  }

  const v = { ...data, ...form } as NoShowSettings;

  const save = () => update.mutate(form);

  return (
    <div className="space-y-6 max-w-3xl">
      <section className="bg-white border border-border rounded-[14px] p-8 shadow-card">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-orange-50 rounded-xl"><ShieldAlert className="w-5 h-5 text-orange-500" /></div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-ink">Alertas de No-Show</h3>
            <p className="text-[11px] text-gray-500">O sistema nunca marca no-show sozinho — só alerta você para confirmar.</p>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl border border-[#E3E6EB] bg-gray-50/50 mt-4">
          <div>
            <p className="text-sm font-black text-ink">Ativar alertas de no-show</p>
            <p className="text-[11px] text-gray-500">Envia lembretes escalonados após o horário do agendamento sem check-in.</p>
          </div>
          <Switch checked={!!v.enabled} onCheckedChange={(x) => setForm((f) => ({ ...f, enabled: x }))} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <Label className="text-[10px] uppercase tracking-widest text-gray-500">Intervalos dos alertas</Label>
            <Select
              value={v.interval_preset ?? 'standard'}
              onValueChange={(x) => setForm((f) => ({ ...f, interval_preset: x as 'standard' | 'light' }))}
            >
              <SelectTrigger className="h-11 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Padrão — T+15 / T+30 / T+45 minutos</SelectItem>
                <SelectItem value="light">Menos ruído — T+30 / T+60 minutos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-widest text-gray-500">Horário do resumo diário</Label>
            <Input
              type="time"
              value={(v.daily_summary_time ?? '19:00:00').slice(0, 5)}
              onChange={(e) => setForm((f) => ({ ...f, daily_summary_time: e.target.value + ':00' }))}
              className="h-11 mt-1"
              disabled={!v.daily_summary_enabled}
            />
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <ToggleRow
            title="Enviar WhatsApp para o atendente que agendou"
            desc="A cada alerta, envia mensagem para o número cadastrado no perfil do atendente."
            checked={!!v.notify_attendant_whatsapp}
            onChange={(x) => setForm((f) => ({ ...f, notify_attendant_whatsapp: x }))}
          />
          <ToggleRow
            title="Enviar também para o gerente"
            desc="Cópia dos alertas para um número extra."
            checked={!!v.notify_manager_whatsapp}
            onChange={(x) => setForm((f) => ({ ...f, notify_manager_whatsapp: x }))}
          />
          {v.notify_manager_whatsapp && (
            <div className="pl-4">
              <Label className="text-[10px] uppercase tracking-widest text-gray-500">Telefone do gerente</Label>
              <Input
                placeholder="55 67 99999-9999"
                value={v.manager_phone ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, manager_phone: e.target.value }))}
                className="h-11 mt-1 max-w-xs"
              />
            </div>
          )}
          <ToggleRow
            title="Resumo diário no fim do expediente"
            desc="Lista todos os agendamentos do dia ainda sem resolução (nem check-in, nem no-show)."
            checked={!!v.daily_summary_enabled}
            onChange={(x) => setForm((f) => ({ ...f, daily_summary_enabled: x }))}
          />
        </div>
      </section>

      <section className="bg-white border border-border rounded-[14px] p-8 shadow-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary/10 rounded-xl"><MessageCircle className="w-5 h-5 text-primary" /></div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-ink">Cadência de recuperação</h3>
            <p className="text-[11px] text-gray-500">
              Mensagens enviadas ao lead que não compareceu. Use <code className="text-[10px] bg-gray-100 px-1 rounded">{'{nome}'}</code> para o primeiro nome.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <MsgField label="T+0 — no mesmo dia" value={v.recovery_msg_t0 ?? ''}
            onChange={(x) => setForm((f) => ({ ...f, recovery_msg_t0: x }))} />
          <MsgField label="T+48h — dois dias depois" value={v.recovery_msg_t48h ?? ''}
            onChange={(x) => setForm((f) => ({ ...f, recovery_msg_t48h: x }))} />
          <MsgField label="T+7d — última chance" value={v.recovery_msg_t7d ?? ''}
            onChange={(x) => setForm((f) => ({ ...f, recovery_msg_t7d: x }))} />
        </div>
      </section>

      <div className="flex justify-end">
        <Button onClick={save} disabled={update.isPending} className="h-11 px-8 font-black text-[11px] uppercase tracking-widest">
          {update.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar configurações'}
        </Button>
      </div>
    </div>
  );
}

function ToggleRow({ title, desc, checked, onChange }: { title: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl border border-[#E3E6EB]">
      <div>
        <p className="text-sm font-black text-ink">{title}</p>
        <p className="text-[11px] text-gray-500">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function MsgField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-[10px] uppercase tracking-widest text-gray-500">{label}</Label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 min-h-[70px]" />
    </div>
  );
}

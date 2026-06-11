import { useState } from 'react';
import { format } from 'date-fns';
import { Trash2, Plus, Clock, Ban } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  useBusinessHours,
  useBlockedDates,
  useUpsertBusinessHour,
  useAddBlockedDate,
  useDeleteBlockedDate,
  WEEKDAY_LABELS,
  trimSec,
  BusinessHour,
} from '@/hooks/use-agenda-settings';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function AgendaSettingsDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-black">Programação da Agenda</DialogTitle>
          <DialogDescription>Defina horários de funcionamento por dia da semana e bloqueie datas específicas.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="hours" className="mt-2">
          <TabsList className="mb-4">
            <TabsTrigger value="hours"><Clock className="w-3.5 h-3.5 mr-2" /> Horários da semana</TabsTrigger>
            <TabsTrigger value="blocks"><Ban className="w-3.5 h-3.5 mr-2" /> Dias bloqueados</TabsTrigger>
          </TabsList>

          <TabsContent value="hours">
            <BusinessHoursTab />
          </TabsContent>
          <TabsContent value="blocks">
            <BlockedDatesTab />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BusinessHoursTab() {
  const { data: hours = [], isLoading } = useBusinessHours();
  const upsert = useUpsertBusinessHour();

  if (isLoading) return <div className="p-8 text-center text-sm text-gray-500">Carregando…</div>;

  return (
    <div className="space-y-2">
      {Array.from({ length: 7 }).map((_, weekday) => {
        const row = hours.find((h) => h.weekday === weekday) ?? {
          weekday,
          is_open: false,
          open_time: null,
          close_time: null,
          lunch_start: null,
          lunch_end: null,
        } as Partial<BusinessHour>;
        return <WeekdayRow key={weekday} row={row} onSave={(patch) => upsert.mutate({ weekday, ...row, ...patch })} />;
      })}
    </div>
  );
}

function WeekdayRow({ row, onSave }: { row: Partial<BusinessHour>; onSave: (patch: Partial<BusinessHour>) => void }) {
  return (
    <div className="grid grid-cols-12 gap-3 items-center p-3 rounded-xl border border-[#E3E6EB] hover:bg-gray-50/50 transition">
      <div className="col-span-3 flex items-center gap-3">
        <Switch
          checked={!!row.is_open}
          onCheckedChange={(v) => onSave({ is_open: v })}
        />
        <span className={`text-sm font-black ${row.is_open ? 'text-ink' : 'text-gray-400'}`}>
          {WEEKDAY_LABELS[row.weekday!]}
        </span>
      </div>
      {row.is_open ? (
        <>
          <TimeField label="Abre" value={trimSec(row.open_time)} onChange={(v) => onSave({ open_time: v })} />
          <TimeField label="Fecha" value={trimSec(row.close_time)} onChange={(v) => onSave({ close_time: v })} />
          <TimeField label="Almoço início" value={trimSec(row.lunch_start)} onChange={(v) => onSave({ lunch_start: v || null })} />
          <TimeField label="Almoço fim" value={trimSec(row.lunch_end)} onChange={(v) => onSave({ lunch_end: v || null })} />
        </>
      ) : (
        <div className="col-span-9 text-xs text-gray-400 italic">Fechado</div>
      )}
    </div>
  );
}

function TimeField({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string) => void }) {
  return (
    <div className="col-span-2 space-y-1">
      <Label className="text-[10px] uppercase tracking-wider text-gray-500">{label}</Label>
      <Input
        type="time"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 text-sm"
      />
    </div>
  );
}

function BlockedDatesTab() {
  const { data: blocks = [], isLoading } = useBlockedDates();
  const add = useAddBlockedDate();
  const del = useDeleteBlockedDate();

  const [form, setForm] = useState({
    blocked_date: format(new Date(), 'yyyy-MM-dd'),
    all_day: true,
    block_start: '09:00',
    block_end: '12:00',
    reason: '',
  });

  const submit = () => {
    if (!form.blocked_date) return;
    add.mutate(
      {
        blocked_date: form.blocked_date,
        all_day: form.all_day,
        block_start: form.all_day ? undefined : form.block_start,
        block_end: form.all_day ? undefined : form.block_end,
        reason: form.reason || undefined,
      },
      {
        onSuccess: () => setForm((f) => ({ ...f, reason: '' })),
      },
    );
  };

  return (
    <div className="space-y-5">
      {/* Form de novo bloqueio */}
      <div className="p-4 rounded-xl border border-dashed border-[#E3E6EB] bg-gray-50/50 space-y-3">
        <div className="text-xs font-black text-ink uppercase tracking-widest">Adicionar bloqueio</div>
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-3 space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-gray-500">Data</Label>
            <Input type="date" value={form.blocked_date} onChange={(e) => setForm({ ...form, blocked_date: e.target.value })} className="h-9" />
          </div>
          <div className="col-span-3 flex items-end gap-2 pb-1">
            <Checkbox
              id="all-day"
              checked={form.all_day}
              onCheckedChange={(v) => setForm({ ...form, all_day: !!v })}
            />
            <Label htmlFor="all-day" className="text-xs font-medium">Dia inteiro</Label>
          </div>
          {!form.all_day && (
            <>
              <div className="col-span-2 space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-gray-500">Início</Label>
                <Input type="time" value={form.block_start} onChange={(e) => setForm({ ...form, block_start: e.target.value })} className="h-9" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-gray-500">Fim</Label>
                <Input type="time" value={form.block_end} onChange={(e) => setForm({ ...form, block_end: e.target.value })} className="h-9" />
              </div>
            </>
          )}
          <div className={`${form.all_day ? 'col-span-6' : 'col-span-12'} space-y-1`}>
            <Label className="text-[10px] uppercase tracking-wider text-gray-500">Motivo (opcional)</Label>
            <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Feriado, treinamento, etc." className="h-9" />
          </div>
        </div>
        <Button onClick={submit} disabled={add.isPending} className="gap-2">
          <Plus className="w-4 h-4" /> Adicionar bloqueio
        </Button>
      </div>

      {/* Lista de bloqueios */}
      <div className="space-y-2">
        <div className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Bloqueios cadastrados</div>
        {isLoading ? (
          <div className="p-6 text-center text-sm text-gray-500">Carregando…</div>
        ) : blocks.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-400 border border-dashed rounded-xl">Nenhum dia bloqueado.</div>
        ) : (
          blocks.map((b) => (
            <div key={b.id} className="flex items-center justify-between p-3 rounded-xl border border-[#E3E6EB] hover:bg-gray-50/50 transition">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-50 rounded-lg">
                  <Ban className="w-4 h-4 text-red-500" />
                </div>
                <div>
                  <div className="text-sm font-black text-ink">
                    {format(new Date(b.blocked_date + 'T00:00:00'), 'dd/MM/yyyy')}
                  </div>
                  <div className="text-xs text-gray-500">
                    {b.all_day ? (
                      <Badge variant="outline" className="text-[9px]">Dia inteiro</Badge>
                    ) : (
                      <span>{trimSec(b.block_start)} – {trimSec(b.block_end)}</span>
                    )}
                    {b.reason && <span className="ml-2">• {b.reason}</span>}
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => del.mutate(b.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { format } from 'date-fns';
import { Stethoscope, Trash2, Plus, CalendarX } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  useConsultationTypes,
  useConsultationTypeHours,
  useUpsertConsultationTypeHour,
  useConsultationTypeDateOverrides,
  useAddConsultationTypeOverride,
  useDeleteConsultationTypeOverride,
  WEEKDAY_LABELS,
  trimSec,
  ConsultationType,
  ConsultationTypeHour,
} from '@/hooks/use-agenda-settings';

const WK_SHORT = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

export function ExamHoursTab() {
  const { data: types = [], isLoading: loadingTypes } = useConsultationTypes();
  const { data: hours = [], isLoading: loadingHours } = useConsultationTypeHours();

  if (loadingTypes || loadingHours) {
    return <div className="p-8 text-center text-sm text-gray-500">Carregando…</div>;
  }
  if (types.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-gray-400 border border-dashed rounded-xl">
        Nenhum tipo de exame cadastrado. Cadastre em Ajustes → Tipos de Consulta.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/60 text-[11px] text-amber-800 leading-relaxed">
        Estas janelas são cruzadas com o <b>Horário da Loja</b> e os <b>Dias Bloqueados</b>. A IA
        só oferecerá horários que respeitem <b>todas</b> as regras.
      </div>

      {types.map((t) => (
        <ExamCard key={t.id} type={t} hours={hours.filter((h) => h.consultation_type_id === t.id)} />
      ))}
    </div>
  );
}

function ExamCard({ type, hours }: { type: ConsultationType; hours: ConsultationTypeHour[] }) {
  const upsert = useUpsertConsultationTypeHour();

  const rowFor = (weekday: number): Partial<ConsultationTypeHour> =>
    hours.find((h) => h.weekday === weekday) ?? {
      consultation_type_id: type.id,
      weekday,
      is_active: false,
      start_time: null,
      end_time: null,
      slot_minutes: 30,
      saturday_recurrence: 'all',
    };

  const anySlot = hours.find((h) => h.slot_minutes) ?? { slot_minutes: 30 };
  const [slotMin, setSlotMin] = useState<number>(anySlot.slot_minutes ?? 30);

  const applySlot = (v: number) => {
    setSlotMin(v);
    // aplica a todos os dias ativos
    hours
      .filter((h) => h.is_active)
      .forEach((h) => upsert.mutate({ ...h, slot_minutes: v }));
  };

  return (
    <div className="rounded-2xl border border-[#E3E6EB] overflow-hidden">
      <div className="flex items-center justify-between gap-3 p-3 bg-gradient-to-r from-amber-50 to-transparent">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-2 bg-white rounded-lg shrink-0">
            <Stethoscope className="w-4 h-4 text-amber-600" />
          </div>
          <div className="font-black text-sm uppercase tracking-wide truncate">{type.name}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Label className="text-[10px] uppercase text-gray-500">Slot</Label>
          <Input
            type="number"
            value={slotMin}
            min={5}
            max={240}
            step={5}
            onChange={(e) => setSlotMin(Number(e.target.value))}
            onBlur={() => applySlot(slotMin)}
            className="h-8 w-16 text-sm"
          />
          <span className="text-[10px] text-gray-500">min</span>
        </div>
      </div>

      <div className="divide-y divide-[#E3E6EB]">
        {Array.from({ length: 7 }).map((_, weekday) => {
          const row = rowFor(weekday);
          return (
            <ExamDayRow
              key={weekday}
              row={row}
              typeId={type.id}
              onSave={(patch) => upsert.mutate({ ...row, ...patch, slot_minutes: slotMin } as any)}
            />
          );
        })}
      </div>

      <ExamOverridesInline typeId={type.id} typeName={type.name} />
    </div>
  );
}

function ExamDayRow({
  row,
  onSave,
}: {
  row: Partial<ConsultationTypeHour>;
  typeId: string;
  onSave: (patch: Partial<ConsultationTypeHour>) => void;
}) {
  const isSat = row.weekday === 6;
  return (
    <div className="grid grid-cols-[auto_1fr] sm:grid-cols-[auto_auto_1fr_auto] items-center gap-2 sm:gap-3 p-2.5">
      <div className="flex items-center gap-2">
        <Switch
          checked={!!row.is_active}
          onCheckedChange={(v) => onSave({ is_active: v })}
        />
        <span className={`text-xs font-black w-9 ${row.is_active ? 'text-ink' : 'text-gray-400'}`}>
          {WK_SHORT[row.weekday!]}
        </span>
      </div>
      {row.is_active ? (
        <>
          <div className="flex items-center gap-1 col-start-2 sm:col-start-auto">
            <Input
              type="time"
              value={trimSec(row.start_time) ?? ''}
              onChange={(e) => onSave({ start_time: e.target.value })}
              className="h-8 w-24 text-sm"
            />
            <span className="text-xs text-gray-400">–</span>
            <Input
              type="time"
              value={trimSec(row.end_time) ?? ''}
              onChange={(e) => onSave({ end_time: e.target.value })}
              className="h-8 w-24 text-sm"
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            {isSat ? (
              <Select
                value={row.saturday_recurrence ?? 'all'}
                onValueChange={(v) => onSave({ saturday_recurrence: v as any })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os sábados</SelectItem>
                  <SelectItem value="even">Semanas pares</SelectItem>
                  <SelectItem value="odd">Semanas ímpares</SelectItem>
                  <SelectItem value="none">Nenhum (use datas específicas)</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <span className="text-[11px] text-gray-400">—</span>
            )}
          </div>
          <div className="hidden sm:block" />
        </>
      ) : (
        <div className="col-start-2 text-[11px] text-gray-400 italic">Não atende</div>
      )}
    </div>
  );
}

function ExamOverridesInline({ typeId, typeName }: { typeId: string; typeName: string }) {
  const { data: overrides = [] } = useConsultationTypeDateOverrides();
  const add = useAddConsultationTypeOverride();
  const del = useDeleteConsultationTypeOverride();
  const mine = overrides.filter((o) => o.consultation_type_id === typeId);

  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [mode, setMode] = useState<'on' | 'off'>('on');

  return (
    <div className="p-3 bg-gray-50/50 border-t border-[#E3E6EB] space-y-2">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black text-gray-500">
        <CalendarX className="w-3.5 h-3.5" /> Exceções por Data
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-8 text-sm w-40"
        />
        <Select value={mode} onValueChange={(v) => setMode(v as 'on' | 'off')}>
          <SelectTrigger className="h-8 text-xs w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="on">Atende neste dia</SelectItem>
            <SelectItem value="off">NÃO atende neste dia</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          onClick={() =>
            add.mutate({
              consultation_type_id: typeId,
              override_date: date,
              is_available: mode === 'on',
            })
          }
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
        </Button>
      </div>

      {mine.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {mine.map((o) => (
            <Badge
              key={o.id}
              variant="outline"
              className={`text-[10px] gap-1 pr-1 ${o.is_available ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-red-300 bg-red-50 text-red-700'}`}
            >
              {format(new Date(o.override_date + 'T00:00:00'), 'dd/MM')} · {o.is_available ? typeName : 'sem ' + typeName}
              <button
                onClick={() => del.mutate(o.id)}
                className="ml-0.5 rounded hover:bg-black/5 p-0.5"
                aria-label="Remover"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

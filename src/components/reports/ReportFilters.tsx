import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

function startOfMonthISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export interface ReportFiltersValue {
  from: string;
  to: string;
}

export function ReportFilters({
  value,
  onChange,
  rightSlot,
}: {
  value: ReportFiltersValue;
  onChange: (v: ReportFiltersValue) => void;
  rightSlot?: React.ReactNode;
}) {
  const [local, setLocal] = useState(value);
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
      <div>
        <Label className="text-xs">De</Label>
        <Input type="date" value={local.from} onChange={(e) => setLocal({ ...local, from: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs">Até</Label>
        <Input type="date" value={local.to} onChange={(e) => setLocal({ ...local, to: e.target.value })} />
      </div>
      <Button onClick={() => onChange(local)}>Aplicar</Button>
      <Button
        variant="outline"
        onClick={() => {
          const v = { from: startOfMonthISO(), to: todayISO() };
          setLocal(v);
          onChange(v);
        }}
      >
        Este mês
      </Button>
      <div className="ml-auto flex gap-2">{rightSlot}</div>
    </div>
  );
}

export const defaultRange: ReportFiltersValue = { from: startOfMonthISO(), to: todayISO() };

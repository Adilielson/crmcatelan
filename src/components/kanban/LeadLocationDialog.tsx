import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DBLead, useUnits, useUpdateLead } from '@/hooks/use-leads';
import { MapPin } from 'lucide-react';

export function LeadLocationDialog({ lead, open, onOpenChange }: { lead: DBLead | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const update = useUpdateLead();
  const { data: units } = useUnits();
  const [unitId, setUnitId] = useState<string>('');

  useEffect(() => { if (lead) setUnitId(lead.unit_id ?? ''); }, [lead]);

  if (!lead) return null;
  const current = units?.find((u) => u.id === lead.unit_id);

  const save = async () => {
    await update.mutateAsync({ id: lead.id, updates: { unit_id: unitId || null } as any });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Unidade — {lead.full_name}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-3">
          {current && (
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-start gap-3">
              <MapPin className="w-4 h-4 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-bold text-ink">{current.name}</p>
                {current.address && <p className="text-xs text-gray-500">{current.address}</p>}
              </div>
            </div>
          )}
          <div className="grid gap-2">
            <Label>Associar a unidade</Label>
            <Select value={unitId} onValueChange={setUnitId}>
              <SelectTrigger><SelectValue placeholder="Selecione uma unidade..." /></SelectTrigger>
              <SelectContent>
                {(units ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={update.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

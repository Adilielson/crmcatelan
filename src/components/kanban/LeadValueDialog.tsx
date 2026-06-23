import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { DBLead, useUpdateLead } from '@/hooks/use-leads';

export function LeadValueDialog({ lead, open, onOpenChange }: { lead: DBLead | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const update = useUpdateLead();
  const [value, setValue] = useState(0);

  useEffect(() => { if (lead) setValue(lead.sales_value ?? 0); }, [lead]);

  if (!lead) return null;

  const save = async () => {
    await update.mutateAsync({ id: lead.id, updates: { sales_value: Number(value) } });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>Valor estimado — {lead.full_name}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2 py-3">
          <Label>Valor (R$)</Label>
          <CurrencyInput autoFocus value={value} onChange={setValue} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={update.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

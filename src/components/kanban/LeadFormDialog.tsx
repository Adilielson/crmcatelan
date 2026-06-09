import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateLead } from '@/hooks/use-leads';

export function LeadFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const create = useCreateLead();
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    sales_value: '',
    source: 'whatsapp',
    notes: '',
  });

  const reset = () => setForm({ full_name: '', phone: '', email: '', sales_value: '', source: 'whatsapp', notes: '' });

  const submit = async () => {
    if (!form.full_name.trim()) return;
    await create.mutateAsync({
      full_name: form.full_name.trim(),
      phone: form.phone || undefined,
      email: form.email || undefined,
      sales_value: form.sales_value ? Number(form.sales_value) : 0,
      source: form.source,
      notes: form.notes || undefined,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Novo Lead</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Nome completo *</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Ex: João Silva" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="5527999..." />
            </div>
            <div className="grid gap-2">
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Valor estimado (R$)</Label>
              <Input type="number" value={form.sales_value} onChange={(e) => setForm({ ...form, sales_value: e.target.value })} placeholder="0" />
            </div>
            <div className="grid gap-2">
              <Label>Origem</Label>
              <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
                  <SelectItem value="direct">Direto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Notas</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!form.full_name.trim() || create.isPending}>
            {create.isPending ? 'Salvando...' : 'Criar Lead'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

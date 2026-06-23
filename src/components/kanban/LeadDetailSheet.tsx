import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { DBLead, STAGES, useDeleteLead, useUpdateLead } from '@/hooks/use-leads';
import { Trash2, ClipboardList } from 'lucide-react';
import { ConsultationSummaryDialog } from './ConsultationSummaryDialog';
import { LeadProfilePanel } from '@/components/leads/LeadProfilePanel';

export function LeadDetailSheet({
  lead,
  open,
  onOpenChange,
}: {
  lead: DBLead | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const update = useUpdateLead();
  const del = useDeleteLead();
  const [showConsultationDialog, setShowConsultationDialog] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    sales_value: 0,
    status: 'open',
    source: 'whatsapp',
    notes: '',
  });

  useEffect(() => {
    if (lead) {
      setForm({
        full_name: lead.full_name ?? '',
        phone: lead.phone ?? '',
        email: lead.email ?? '',
        sales_value: lead.sales_value ?? 0,
        status: lead.status,
        source: lead.source ?? 'whatsapp',
        notes: lead.notes ?? '',
      });
    }
  }, [lead]);

  if (!lead) return null;

  const save = async () => {
    await update.mutateAsync({
      id: lead.id,
      updates: {
        full_name: form.full_name,
        phone: form.phone || null,
        email: form.email || null,
        sales_value: form.sales_value,
        status: form.status as any,
        source: form.source,
        notes: form.notes || null,
      },
    });
    onOpenChange(false);
  };

  const remove = async () => {
    if (!confirm(`Excluir lead "${lead.full_name}"?`)) return;
    await del.mutateAsync(lead.id);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-jakarta uppercase tracking-tight text-base">{lead.full_name}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <LeadProfilePanel lead={lead} />

          <div className="space-y-4 pt-4 border-t border-gray-100">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500">Editar dados</h4>

            <div className="grid gap-2">
              <Label>Nome</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>E-mail</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Valor (R$)</Label>
                <CurrencyInput value={form.sales_value} onChange={(v) => setForm({ ...form, sales_value: v })} />
              </div>
              <div className="grid gap-2">
                <Label>Estágio</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
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

            <div className="grid gap-2">
              <Label>Notas</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={4} />
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => setShowConsultationDialog(true)}
            className="w-full h-10 text-[10px] font-black uppercase tracking-wider rounded-xl border-amber-300 text-amber-700 hover:bg-amber-100"
          >
            <ClipboardList className="w-4 h-4 mr-2" />
            {lead.status === 'followup' ? 'Editar resumo da consulta' : 'Adicionar resumo da consulta'}
          </Button>

          <ConsultationSummaryDialog
            lead={lead}
            open={showConsultationDialog}
            onOpenChange={setShowConsultationDialog}
          />

          <div className="flex gap-2 pt-4 border-t border-gray-100">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={save} disabled={update.isPending}>
              {update.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
            <Button variant="ghost" size="icon" onClick={remove} className="text-red-500 hover:bg-red-50">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

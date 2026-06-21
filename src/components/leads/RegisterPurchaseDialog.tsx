import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateLeadPurchase } from '@/hooks/use-lead-purchases';
import { useUpdateLead } from '@/hooks/use-leads';
import type { DBLead } from '@/hooks/use-leads';

const PAYMENT_OPTIONS = [
  { value: 'PIX', label: 'PIX / À vista' },
  { value: 'Dinheiro', label: 'Dinheiro' },
  { value: 'Cartão débito', label: 'Cartão de débito' },
  { value: 'Cartão crédito', label: 'Cartão de crédito' },
  { value: 'Crediário', label: 'Crediário / Parcelado' },
  { value: 'Boleto', label: 'Boleto' },
];

const PRODUCT_OPTIONS = [
  'Armação + Lente',
  'Somente Lente',
  'Somente Armação',
  'Lente de Contato',
  'Óculos de Sol',
  'Acessórios',
  'Outros',
];

interface Props {
  lead: DBLead | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Quando true, ao salvar marca o lead como 'showed_up' (fechado). */
  closeLead?: boolean;
}

export function RegisterPurchaseDialog({ lead, open, onOpenChange, closeLead = false }: Props) {
  const create = useCreateLeadPurchase();
  const updateLead = useUpdateLead();

  const [amount, setAmount] = useState<number>(0);
  const [product, setProduct] = useState('Armação + Lente');
  const [payment, setPayment] = useState('PIX');
  const [installments, setInstallments] = useState<number>(1);
  const [purchaseDate, setPurchaseDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open && lead) {
      setAmount(lead.sales_value ?? 0);
      setProduct('Armação + Lente');
      setPayment('PIX');
      setInstallments(1);
      setPurchaseDate(new Date().toISOString().slice(0, 10));
      setNotes('');
    }
  }, [open, lead]);

  if (!lead) return null;

  const canSave = amount > 0 && product && payment && purchaseDate;

  const save = async () => {
    if (!canSave) {
      toast.error('Preencha valor, data, produto e pagamento.');
      return;
    }
    try {
      await create.mutateAsync({
        lead_id: lead.id,
        amount: Number(amount),
        purchase_date: purchaseDate,
        product_description: product,
        payment_method: payment,
        installments: installments > 1 ? installments : null,
        unit_id: lead.unit_id ?? null,
        attendant_id: lead.assigned_user_id ?? null,
        notes: notes || null,
      });
      if (closeLead) {
        await updateLead.mutateAsync({
          id: lead.id,
          updates: {
            status: 'showed_up',
            custom_column_id: null,
            sales_value: Number(amount),
            payment_method: payment,
            products_sold: product,
          },
        });
      }
      onOpenChange(false);
    } catch {
      /* toast já é exibido pelo hook */
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-500" />
            Registrar compra — {lead.full_name}
          </DialogTitle>
          <DialogDescription>
            {closeLead
              ? 'O lead será movido para Fechado e a compra entrará no histórico.'
              : 'Acrescenta uma compra ao histórico do cliente (soma no LTV).'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="p-amount">Valor (R$) *</Label>
              <Input id="p-amount" type="number" min={0} step={0.01} autoFocus value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="p-date">Data da compra *</Label>
              <Input id="p-date" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Produto *</Label>
            <Select value={product} onValueChange={setProduct}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRODUCT_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Pagamento *</Label>
              <Select value={payment} onValueChange={setPayment}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="p-inst">Parcelas</Label>
              <Input id="p-inst" type="number" min={1} max={24} value={installments} onChange={(e) => setInstallments(Number(e.target.value))} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="p-notes">Observações</Label>
            <Textarea id="p-notes" rows={2} maxLength={400} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Detalhes da venda (opcional)" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={!canSave || create.isPending || updateLead.isPending} className="bg-emerald-600 hover:bg-emerald-700">
            {create.isPending || updateLead.isPending ? 'Salvando...' : (closeLead ? 'Confirmar venda' : 'Registrar compra')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DBLead, useUpdateLead } from '@/hooks/use-leads';
import { CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const PAYMENT_OPTIONS = [
  { value: 'pix', label: 'PIX / À vista' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cartao_debito', label: 'Cartão de débito' },
  { value: 'cartao_credito', label: 'Cartão de crédito' },
  { value: 'parcelado', label: 'Parcelado / Crediário' },
  { value: 'boleto', label: 'Boleto' },
];

const PRODUCT_OPTIONS = [
  { value: 'armacao_lente', label: 'Armação + Lente' },
  { value: 'so_lente', label: 'Somente Lente' },
  { value: 'so_armacao', label: 'Somente Armação' },
  { value: 'lente_contato', label: 'Lente de Contato' },
  { value: 'oculos_sol', label: 'Óculos de Sol' },
  { value: 'outros', label: 'Outros' },
];

interface Props {
  lead: DBLead | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function CloseLeadDialog({ lead, open, onOpenChange }: Props) {
  const update = useUpdateLead();
  const [value, setValue] = useState<number>(0);
  const [payment, setPayment] = useState<string>('');
  const [products, setProducts] = useState<string>('');

  useEffect(() => {
    if (lead && open) {
      setValue(lead.sales_value ?? 0);
      setPayment(lead.payment_method ?? '');
      setProducts(lead.products_sold ?? '');
    }
  }, [lead, open]);

  if (!lead) return null;

  const canSave = value > 0 && payment && products;

  const save = async () => {
    if (!canSave) {
      toast.error('Preencha valor, forma de pagamento e produto');
      return;
    }
    await update.mutateAsync({
      id: lead.id,
      updates: {
        status: 'showed_up',
        custom_column_id: null,
        sales_value: Number(value),
        payment_method: payment,
        products_sold: products,
      },
    });
    toast.success(`Venda registrada: R$ ${Number(value).toLocaleString('pt-BR')}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            Fechar venda — {lead.full_name}
          </DialogTitle>
          <DialogDescription>
            O agendamento será finalizado automaticamente e o lead movido para Fechado.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-3">
          <div className="grid gap-2">
            <Label htmlFor="sale-value">Valor da venda (R$) *</Label>
            <Input
              id="sale-value"
              type="number"
              min={0}
              step={0.01}
              autoFocus
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
            />
          </div>
          <div className="grid gap-2">
            <Label>Produtos vendidos *</Label>
            <Select value={products} onValueChange={setProducts}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {PRODUCT_OPTIONS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Forma de pagamento *</Label>
            <Select value={payment} onValueChange={setPayment}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {PAYMENT_OPTIONS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={!canSave || update.isPending} className="bg-emerald-600 hover:bg-emerald-700">
            {update.isPending ? 'Salvando...' : 'Confirmar venda'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

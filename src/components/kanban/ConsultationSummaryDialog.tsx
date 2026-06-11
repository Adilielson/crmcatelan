import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { DBLead, useUpdateLead } from '@/hooks/use-leads';
import {
  useConsultationSummary,
  useUpsertConsultationSummary,
  ConsultationSummaryInput,
} from '@/hooks/use-consultation-summary';

const NEEDS_GLASSES = [
  { value: 'yes', label: 'Sim — uso constante' },
  { value: 'no', label: 'Não precisa' },
  { value: 'reading', label: 'Só para leitura' },
  { value: 'distance', label: 'Só para longe' },
  { value: 'both', label: 'Longe e perto (multifocal)' },
];

const LENS_TYPES = ['Monofocal', 'Multifocal', 'Bifocal', 'Ocupacional', 'Lentes de contato', 'Óculos de sol c/ grau'];

const TREATMENTS = ['Antirreflexo', 'Filtro Blue', 'Fotossensível', 'Antiembaçante', 'Endurecida', 'Polarizada'];

const NO_CLOSE_REASONS = [
  'Vai pensar / consultar cônjuge',
  'Preço acima do esperado',
  'Quer comparar com concorrente',
  'Aguardando pagamento / 13º / férias',
  'Só veio fazer o exame',
  'Não gostou das opções',
  'Outro',
];

interface Props {
  lead: DBLead | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Quando true, ao salvar move o lead para Follow-up. */
  moveToFollowupOnSave?: boolean;
}

export function ConsultationSummaryDialog({ lead, open, onOpenChange, moveToFollowupOnSave }: Props) {
  const { data: existing } = useConsultationSummary(lead?.id);
  const upsert = useUpsertConsultationSummary();
  const updateLead = useUpdateLead();

  const [form, setForm] = useState<ConsultationSummaryInput>({});
  const [treatments, setTreatments] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      if (existing) {
        setForm({
          needs_glasses: existing.needs_glasses,
          lens_type: existing.lens_type,
          od_spherical: existing.od_spherical,
          od_cylindrical: existing.od_cylindrical,
          od_axis: existing.od_axis,
          od_addition: existing.od_addition,
          oe_spherical: existing.oe_spherical,
          oe_cylindrical: existing.oe_cylindrical,
          oe_axis: existing.oe_axis,
          oe_addition: existing.oe_addition,
          prescription_valid_until: existing.prescription_valid_until,
          frame_recommendation: existing.frame_recommendation,
          price_range_presented: existing.price_range_presented,
          products_shown: existing.products_shown,
          no_close_reason: existing.no_close_reason,
          no_close_reason_detail: existing.no_close_reason_detail,
          professional_notes: existing.professional_notes,
        });
        setTreatments(existing.treatments ?? []);
      } else {
        setForm({});
        setTreatments([]);
      }
    }
  }, [open, existing]);

  if (!lead) return null;

  const set = <K extends keyof ConsultationSummaryInput>(key: K, value: ConsultationSummaryInput[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  const num = (v: string): number | null => (v === '' ? null : Number(v));

  const toggleTreatment = (t: string) =>
    setTreatments((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));

  const canSave = !!form.no_close_reason; // mínimo: motivo de não fechar

  const handleSave = async (alsoMove: boolean) => {
    if (alsoMove && !canSave) {
      toast.error('Selecione ao menos o motivo de não fechar no dia');
      return;
    }
    await upsert.mutateAsync({
      leadId: lead.id,
      data: { ...form, treatments },
    });
    if (alsoMove) {
      await updateLead.mutateAsync({
        id: lead.id,
        updates: { status: 'followup', custom_column_id: null },
      });
      toast.success('Lead movido para Follow-up com contexto da consulta');
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-amber-500" />
            Resumo da consulta — {lead.full_name}
          </DialogTitle>
          <DialogDescription>
            Esses dados aparecem nos próximos follow-ups e ajudam o atendente (ou IA) a reabordar o lead com contexto.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-3">
          {/* Diagnóstico */}
          <section className="grid gap-3">
            <h4 className="text-xs font-black uppercase tracking-widest text-gray-500">Diagnóstico</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Precisa de óculos?</Label>
                <Select
                  value={form.needs_glasses ?? ''}
                  onValueChange={(v) => set('needs_glasses', v as any)}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {NEEDS_GLASSES.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Tipo de lente recomendada</Label>
                <Select value={form.lens_type ?? ''} onValueChange={(v) => set('lens_type', v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {LENS_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* Receita */}
          <section className="grid gap-3">
            <h4 className="text-xs font-black uppercase tracking-widest text-gray-500">Receita (opcional)</h4>
            <div className="grid grid-cols-5 gap-2 text-xs">
              <div></div>
              <Label className="text-center">Esférico</Label>
              <Label className="text-center">Cilíndrico</Label>
              <Label className="text-center">Eixo</Label>
              <Label className="text-center">Adição</Label>

              <Label className="self-center font-bold">OD</Label>
              <Input type="number" step="0.25" value={form.od_spherical ?? ''} onChange={(e) => set('od_spherical', num(e.target.value))} />
              <Input type="number" step="0.25" value={form.od_cylindrical ?? ''} onChange={(e) => set('od_cylindrical', num(e.target.value))} />
              <Input type="number" value={form.od_axis ?? ''} onChange={(e) => set('od_axis', num(e.target.value))} />
              <Input type="number" step="0.25" value={form.od_addition ?? ''} onChange={(e) => set('od_addition', num(e.target.value))} />

              <Label className="self-center font-bold">OE</Label>
              <Input type="number" step="0.25" value={form.oe_spherical ?? ''} onChange={(e) => set('oe_spherical', num(e.target.value))} />
              <Input type="number" step="0.25" value={form.oe_cylindrical ?? ''} onChange={(e) => set('oe_cylindrical', num(e.target.value))} />
              <Input type="number" value={form.oe_axis ?? ''} onChange={(e) => set('oe_axis', num(e.target.value))} />
              <Input type="number" step="0.25" value={form.oe_addition ?? ''} onChange={(e) => set('oe_addition', num(e.target.value))} />
            </div>
            <div className="grid gap-2">
              <Label>Validade da receita</Label>
              <Input
                type="date"
                value={form.prescription_valid_until ?? ''}
                onChange={(e) => set('prescription_valid_until', e.target.value || null)}
              />
            </div>
          </section>

          {/* Recomendações */}
          <section className="grid gap-3">
            <h4 className="text-xs font-black uppercase tracking-widest text-gray-500">Recomendações dadas</h4>
            <div className="grid gap-2">
              <Label>Armação recomendada</Label>
              <Input
                placeholder="Ex.: titanium leve, estilo clássico"
                value={form.frame_recommendation ?? ''}
                onChange={(e) => set('frame_recommendation', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Tratamentos sugeridos</Label>
              <div className="flex flex-wrap gap-3">
                {TREATMENTS.map((t) => (
                  <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={treatments.includes(t)} onCheckedChange={() => toggleTreatment(t)} />
                    <span>{t}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Faixa de valor apresentada</Label>
                <Input
                  placeholder="Ex.: R$ 1.800 – R$ 2.400"
                  value={form.price_range_presented ?? ''}
                  onChange={(e) => set('price_range_presented', e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Produtos mostrados</Label>
                <Input
                  placeholder="Ex.: 3 armações Ray-Ban + multifocal"
                  value={form.products_shown ?? ''}
                  onChange={(e) => set('products_shown', e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Motivo de não fechar */}
          <section className="grid gap-3">
            <h4 className="text-xs font-black uppercase tracking-widest text-gray-500">Por que não fechou no dia</h4>
            <div className="grid gap-2">
              <Label>Motivo principal {moveToFollowupOnSave && <span className="text-red-500">*</span>}</Label>
              <Select value={form.no_close_reason ?? ''} onValueChange={(v) => set('no_close_reason', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {NO_CLOSE_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Detalhe / contexto</Label>
              <Textarea
                rows={2}
                placeholder='Ex.: "Vai conversar com a esposa no fim de semana"'
                value={form.no_close_reason_detail ?? ''}
                onChange={(e) => set('no_close_reason_detail', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Observações do profissional</Label>
              <Textarea
                rows={2}
                placeholder="Notas livres sobre o atendimento"
                value={form.professional_notes ?? ''}
                onChange={(e) => set('professional_notes', e.target.value)}
              />
            </div>
          </section>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {moveToFollowupOnSave && (
            <Button variant="ghost" onClick={() => handleSave(false)} disabled={upsert.isPending}>
              Salvar rascunho
            </Button>
          )}
          <Button
            onClick={() => handleSave(!!moveToFollowupOnSave)}
            disabled={upsert.isPending || (moveToFollowupOnSave && !canSave)}
            className="bg-amber-500 hover:bg-amber-600 text-white"
          >
            {upsert.isPending
              ? 'Salvando...'
              : moveToFollowupOnSave
                ? 'Salvar e mover para Follow-up'
                : 'Salvar resumo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

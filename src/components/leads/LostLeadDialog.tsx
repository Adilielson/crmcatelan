import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { XCircle } from 'lucide-react';

export const LOST_REASONS = [
  'Preço',
  'Sem interesse',
  'Não responde',
  'Comprou concorrente',
  'Endereço / Distância',
  'Horário',
  'Outro',
] as const;

export type LostReason = (typeof LOST_REASONS)[number];

interface Props {
  open: boolean;
  leadName?: string | null;
  isSubmitting?: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (data: { reason: LostReason; note: string }) => void | Promise<void>;
}

export function LostLeadDialog({
  open,
  leadName,
  isSubmitting,
  onOpenChange,
  onConfirm,
}: Props) {
  const [reason, setReason] = useState<string>('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) {
      setReason('');
      setNote('');
    }
  }, [open]);

  const canSubmit = !!reason && !isSubmitting;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        // Bloqueia fechar sem selecionar motivo — apenas o botão Cancelar fecha.
        if (!v && isSubmitting) return;
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500" />
            Marcar como perdido{leadName ? ` — ${leadName}` : ''}
          </DialogTitle>
          <DialogDescription>
            O motivo é obrigatório e fica registrado no relatório de Leads Perdidos.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>
              Motivo da perda <span className="text-red-500">*</span>
            </Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motivo..." />
              </SelectTrigger>
              <SelectContent>
                {LOST_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Observação (opcional)</Label>
            <Textarea
              placeholder="Detalhe o que aconteceu — útil para análise futura."
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              rows={3}
            />
            <p className="text-[11px] text-muted-foreground text-right">
              {note.length}/500
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={!canSubmit}
            onClick={() => onConfirm({ reason: reason as LostReason, note: note.trim() })}
          >
            {isSubmitting ? 'Salvando...' : 'Confirmar perda'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

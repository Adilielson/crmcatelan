import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export type NoShowReasonKey =
  | 'doente'
  | 'esqueceu'
  | 'sem_tempo'
  | 'desistiu'
  | 'comprou_fora'
  | 'nao_respondeu';

export const NOSHOW_REASONS: Array<{
  key: NoShowReasonKey;
  label: string;
  description: string;
  outcome: 'recovery' | 'lost';
}> = [
  { key: 'doente',        label: 'Doente / imprevisto',        description: 'Retomar em 15 dias', outcome: 'recovery' },
  { key: 'esqueceu',      label: 'Esqueceu',                   description: 'Cadência suave, retomada em 7 dias', outcome: 'recovery' },
  { key: 'sem_tempo',     label: 'Sem tempo agora',            description: 'Retomar em 30 dias', outcome: 'recovery' },
  { key: 'nao_respondeu', label: 'Não respondeu',              description: 'Cadência automática T+0/T+48h/T+7d', outcome: 'recovery' },
  { key: 'desistiu',      label: 'Desistiu do exame',          description: 'Vai para Perdido (nutrição em 60 dias)', outcome: 'lost' },
  { key: 'comprou_fora',  label: 'Comprou em outra loja',      description: 'Vai para Perdido (sem reengajamento)', outcome: 'lost' },
];

interface Props {
  open: boolean;
  leadName: string | null;
  isSubmitting?: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (reason: NoShowReasonKey, outcome: 'recovery' | 'lost') => void;
}

export function NoShowReasonDialog({ open, leadName, isSubmitting, onOpenChange, onConfirm }: Props) {
  const [reason, setReason] = useState<NoShowReasonKey | ''>('');

  const submit = () => {
    if (!reason) return;
    const cfg = NOSHOW_REASONS.find((r) => r.key === reason)!;
    onConfirm(reason, cfg.outcome);
    setReason('');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setReason(''); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Não compareceu — {leadName ?? 'Lead'}</DialogTitle>
          <DialogDescription>
            Escolha o motivo. Isso define a cadência de recuperação do lead.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={reason} onValueChange={(v) => setReason(v as NoShowReasonKey)} className="space-y-2 py-2">
          {NOSHOW_REASONS.map((r) => (
            <label
              key={r.key}
              htmlFor={`ns-${r.key}`}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                reason === r.key ? 'border-primary bg-primary/5' : 'border-[#E3E6EB] hover:bg-gray-50'
              }`}
            >
              <RadioGroupItem id={`ns-${r.key}`} value={r.key} className="mt-1" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-ink">{r.label}</span>
                  <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                    r.outcome === 'lost' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                  }`}>
                    {r.outcome === 'lost' ? 'Perdido' : 'Recuperação'}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">{r.description}</p>
              </div>
            </label>
          ))}
        </RadioGroup>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!reason || isSubmitting}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

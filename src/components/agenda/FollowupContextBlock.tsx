import { ClipboardList } from 'lucide-react';
import { format } from 'date-fns';
import { useConsultationSummary } from '@/hooks/use-consultation-summary';

const NEEDS_LABEL: Record<string, string> = {
  yes: 'Usa óculos',
  no: 'Não precisa',
  reading: 'Só leitura',
  distance: 'Só longe',
  both: 'Multifocal',
};

function formatPrescription(s: ReturnType<typeof useConsultationSummary>['data']): string | null {
  if (!s) return null;
  const parts: string[] = [];
  const eye = (label: string, sph: number | null, cyl: number | null, add: number | null) => {
    const bits: string[] = [];
    if (sph != null) bits.push(`${sph > 0 ? '+' : ''}${sph}`);
    if (cyl != null) bits.push(`${cyl > 0 ? '+' : ''}${cyl}`);
    if (add != null) bits.push(`Ad ${add > 0 ? '+' : ''}${add}`);
    if (bits.length) parts.push(`${label} ${bits.join(' / ')}`);
  };
  eye('OD', s.od_spherical, s.od_cylindrical, s.od_addition);
  eye('OE', s.oe_spherical, s.oe_cylindrical, s.oe_addition);
  return parts.length ? parts.join(' • ') : null;
}

export function FollowupContextBlock({ leadId }: { leadId: string }) {
  const { data: summary, isLoading } = useConsultationSummary(leadId);
  if (isLoading || !summary) return null;

  const prescription = formatPrescription(summary);

  return (
    <div className="mt-3 ml-11 rounded-xl bg-amber-50 border border-amber-200 p-3 text-[11px] text-amber-900 space-y-1">
      <div className="flex items-center gap-1.5 font-black uppercase tracking-wider text-[10px] text-amber-700">
        <ClipboardList className="w-3 h-3" />
        Contexto da consulta
      </div>
      {summary.needs_glasses && (
        <div>
          <span className="font-bold">{NEEDS_LABEL[summary.needs_glasses]}</span>
          {summary.lens_type && <span> • {summary.lens_type}</span>}
        </div>
      )}
      {prescription && <div className="font-mono text-[10px]">{prescription}</div>}
      {summary.prescription_valid_until && (
        <div className="text-[10px] text-amber-700">
          Receita até {format(new Date(summary.prescription_valid_until), 'MM/yy')}
        </div>
      )}
      {summary.treatments && summary.treatments.length > 0 && (
        <div>Tratamentos: {summary.treatments.join(', ')}</div>
      )}
      {summary.price_range_presented && (
        <div>Valor apresentado: <span className="font-bold">{summary.price_range_presented}</span></div>
      )}
      {summary.no_close_reason && (
        <div className="pt-1 border-t border-amber-200">
          <span className="font-bold">Não fechou:</span> {summary.no_close_reason}
          {summary.no_close_reason_detail && (
            <span className="italic"> — "{summary.no_close_reason_detail}"</span>
          )}
        </div>
      )}
    </div>
  );
}

import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STAGES, stageLabel, type LeadStage } from '@/hooks/use-leads';
import { getStageColors } from './StageBadge';
import { useLeadHistory } from '@/hooks/use-lead-history';


/**
 * Trilha visual do funil do lead — mostra estágios concluídos, atual, pulados e futuros.
 * Estágios terminais (lost / no_show) são exibidos como "saída" do funil.
 * Quando um leadId é informado, consulta o histórico para diferenciar etapas
 * efetivamente percorridas de etapas que foram puladas.
 */

// Ordem linear do funil "positivo" (sem perdas)
const FUNNEL: LeadStage[] = [
  'open',
  'in_progress',
  'scheduled',
  'checked_in',
  'negotiating',
  'showed_up',
];

const TERMINAL_LABELS: Record<string, string> = {
  followup: 'Em follow-up',
  no_show: 'Não compareceu',
  lost: 'Perdido',
};

export function StageStepper({
  stage,
  leadId,
  className,
}: {
  stage: string | null | undefined;
  leadId?: string | null;
  className?: string;
}) {
  const { data: history } = useLeadHistory(leadId ?? null);

  // Etapas que aparecem no histórico (como destino de uma transição) ou origem inicial.
  const visitedStages = new Set<string>();
  if (history) {
    for (const ev of history) {
      if (ev.event_type !== 'stage_change') continue;
      if (ev.stage_to) visitedStages.add(ev.stage_to);
      if (ev.stage_from) visitedStages.add(ev.stage_from);
    }
  }
  // 'open' é o estágio inicial automático — sempre considerado visitado.
  visitedStages.add('open');
  if (stage) visitedStages.add(stage);

  const isTerminal = stage && !FUNNEL.includes(stage as LeadStage);
  const currentIdx = stage ? FUNNEL.indexOf(stage as LeadStage) : -1;
  const hasHistoryData = !!leadId && Array.isArray(history);

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between px-1">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500">
          Etapa do funil
        </h4>
        {stage && (
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            {isTerminal ? TERMINAL_LABELS[stage] : `Passo ${currentIdx + 1} de ${FUNNEL.length}`}
          </span>
        )}
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-3 sm:p-4">
        {/* Vertical timeline — sempre cabe em qualquer largura */}
        <ol className="space-y-2.5">
          {FUNNEL.map((s, i) => {
            const colors = getStageColors(s);
            const isPast = !isTerminal && i < currentIdx;
            const wasVisited = visitedStages.has(s);
            const isSkipped = hasHistoryData && isPast && !wasVisited;
            const isDone = isPast && !isSkipped;
            const isCurrent = !isTerminal && i === currentIdx;
            const isFuture = isTerminal || i > currentIdx;
            const isLast = i === FUNNEL.length - 1;

            return (
              <li key={s} className="relative flex items-center gap-3">
                {/* Linha conectora vertical */}
                {!isLast && (
                  <span
                    className={cn(
                      'absolute left-[13px] top-7 w-0.5 h-[calc(100%+0.25rem)]',
                      isDone ? 'bg-emerald-400' : isSkipped ? 'bg-amber-200' : 'bg-gray-200',
                    )}
                  />
                )}

                {/* Marcador */}
                <div
                  className={cn(
                    'relative z-10 shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black transition-all',
                    isDone && 'bg-emerald-500 text-white shadow-sm shadow-emerald-200',
                    isSkipped && 'bg-white text-amber-500 border-2 border-dashed border-amber-300',
                    isCurrent && cn(colors.bg, colors.text, 'ring-2 ring-offset-1', colors.ring),
                    isFuture && 'bg-gray-100 text-gray-400',
                  )}
                  title={isSkipped ? 'Etapa pulada' : stageLabel(s)}
                >
                  {isDone ? (
                    <Check className="w-3.5 h-3.5" strokeWidth={3} />
                  ) : isSkipped ? (
                    <Minus className="w-3.5 h-3.5" strokeWidth={3} />
                  ) : (
                    i + 1
                  )}
                  {isCurrent && (
                    <span className={cn('absolute inset-0 rounded-full animate-ping opacity-40', colors.dot)} />
                  )}
                </div>

                {/* Rótulo */}
                <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      'text-xs font-bold truncate',
                      isCurrent && 'text-ink',
                      isDone && 'text-gray-600',
                      isSkipped && 'text-amber-600 line-through decoration-amber-300',
                      isFuture && 'text-gray-400',
                    )}
                  >
                    {stageLabel(s)}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider shrink-0">
                    {isCurrent && <span className={cn(colors.text)}>Atual</span>}
                    {isDone && <span className="text-emerald-600">Concluído</span>}
                    {isSkipped && <span className="text-amber-600">Pulada</span>}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>

        {hasHistoryData && FUNNEL.some((s, i) => !isTerminal && i < currentIdx && !visitedStages.has(s)) && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-start gap-2 text-[10px] text-amber-600 font-bold uppercase tracking-wider leading-snug">
            <Minus className="w-3 h-3 mt-0.5 shrink-0" strokeWidth={3} />
            <span>Etapas puladas sem registro de transição</span>
          </div>
        )}



        {isTerminal && (
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-center gap-2 text-xs">
            <span className="text-gray-500 font-medium">Saída do funil:</span>
            <span className={cn(
              'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-bold ring-1 ring-inset text-[10px] uppercase tracking-wide',
              getStageColors(stage).bg,
              getStageColors(stage).text,
              getStageColors(stage).ring,
            )}>
              <span className={cn('w-1.5 h-1.5 rounded-full', getStageColors(stage).dot)} />
              {TERMINAL_LABELS[stage as string] ?? stageLabel(stage as string)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}


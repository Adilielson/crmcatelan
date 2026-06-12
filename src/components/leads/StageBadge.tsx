import { cn } from '@/lib/utils';
import { stageLabel } from '@/hooks/use-leads';

/**
 * Mapeamento de cores por estágio do funil.
 * Mantém consistência visual em Kanban, Chat, Dashboard e Detalhes.
 */
export const STAGE_COLORS: Record<string, { bg: string; text: string; ring: string; dot: string }> = {
  open:         { bg: 'bg-blue-50',    text: 'text-blue-700',    ring: 'ring-blue-200',    dot: 'bg-blue-500' },
  in_progress:  { bg: 'bg-indigo-50',  text: 'text-indigo-700',  ring: 'ring-indigo-200',  dot: 'bg-indigo-500' },
  scheduled:    { bg: 'bg-violet-50',  text: 'text-violet-700',  ring: 'ring-violet-200',  dot: 'bg-violet-500' },
  checked_in:   { bg: 'bg-cyan-50',    text: 'text-cyan-700',    ring: 'ring-cyan-200',    dot: 'bg-cyan-500' },
  negotiating:  { bg: 'bg-amber-50',   text: 'text-amber-800',   ring: 'ring-amber-200',   dot: 'bg-amber-500' },
  showed_up:    { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', dot: 'bg-emerald-500' },
  followup:     { bg: 'bg-orange-50',  text: 'text-orange-700',  ring: 'ring-orange-200',  dot: 'bg-orange-500' },
  no_show:      { bg: 'bg-rose-50',    text: 'text-rose-700',    ring: 'ring-rose-200',    dot: 'bg-rose-500' },
  lost:         { bg: 'bg-gray-100',   text: 'text-gray-600',    ring: 'ring-gray-200',    dot: 'bg-gray-400' },
};

const FALLBACK = { bg: 'bg-gray-100', text: 'text-gray-600', ring: 'ring-gray-200', dot: 'bg-gray-400' };

export function getStageColors(stage: string | null | undefined) {
  if (!stage) return FALLBACK;
  return STAGE_COLORS[stage] ?? FALLBACK;
}

export function StageBadge({
  stage,
  size = 'sm',
  withDot = true,
  className,
}: {
  stage: string | null | undefined;
  size?: 'xs' | 'sm' | 'md';
  withDot?: boolean;
  className?: string;
}) {
  if (!stage) return <span className={cn('text-gray-400 text-xs', className)}>—</span>;
  const c = getStageColors(stage);

  const sizeCls =
    size === 'xs' ? 'text-[9px] px-1.5 py-0.5 gap-1' :
    size === 'md' ? 'text-xs px-2.5 py-1 gap-1.5' :
                    'text-[10px] px-2 py-0.5 gap-1.5';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md font-bold uppercase tracking-wide ring-1 ring-inset whitespace-nowrap',
        c.bg, c.text, c.ring,
        sizeCls,
        className,
      )}
      title={`Estágio: ${stageLabel(stage)}`}
    >
      {withDot && <span className={cn('w-1.5 h-1.5 rounded-full', c.dot)} />}
      {stageLabel(stage)}
    </span>
  );
}

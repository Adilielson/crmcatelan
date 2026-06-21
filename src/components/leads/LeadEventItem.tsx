import {
  ArrowRight, UserRoundCog, CalendarPlus, CalendarClock, CalendarX, CalendarCheck,
  ShieldCheck, LogIn, LogOut, DollarSign, XCircle, RefreshCw, Sparkles
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { StageBadge } from '@/components/leads/StageBadge';
import type { LeadEvent } from '@/hooks/use-lead-history';
import { cn } from '@/lib/utils';

function fmt(s: string | null) {
  if (!s) return '—';
  try { return format(new Date(s), "dd/MM/yy 'às' HH:mm", { locale: ptBR }); } catch { return s; }
}
function fmtDate(s: string | null) {
  if (!s) return '';
  try { return format(new Date(s), "dd/MM/yyyy", { locale: ptBR }); } catch { return s; }
}
const brl = (n: any) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

type Cfg = { icon: any; tone: string; dot: string; label: string; render: (e: LeadEvent, profileMap: Map<string, string>) => React.ReactNode };

const CFG: Record<string, Cfg> = {
  stage_change: {
    icon: ArrowRight, tone: 'text-slate-600 bg-slate-50 border-slate-200', dot: 'bg-slate-400', label: 'Etapa',
    render: (e) => (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          {e.stage_from && <StageBadge stage={e.stage_from} />}
          {e.stage_from && <span className="text-gray-300">→</span>}
          <StageBadge stage={e.stage_to} />
        </div>
        {e.stage_to === 'lost' && e.metadata?.lost_reason && (
          <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-100 rounded px-2 py-1">
            <span className="font-bold">Motivo:</span> {e.metadata.lost_reason}
            {e.metadata.lost_reason_note && <span className="italic"> — "{e.metadata.lost_reason_note}"</span>}
          </div>
        )}
        {e.stage_to === 'showed_up' && Number(e.metadata?.sales_value ?? 0) > 0 && (
          <div className="text-[11px] text-emerald-700 font-bold">Venda: {brl(e.metadata?.sales_value)}</div>
        )}
      </div>
    ),
  },
  assignment_change: {
    icon: UserRoundCog, tone: 'text-blue-700 bg-blue-50 border-blue-200', dot: 'bg-blue-500', label: 'Atendimento',
    render: (e, map) => {
      const from = e.metadata?.from_user ? (map.get(e.metadata.from_user) ?? 'Atendente anterior') : null;
      const to = e.metadata?.to_user ? (map.get(e.metadata.to_user) ?? 'Atendente') : 'Removido';
      return (
        <div className="text-xs">
          {from ? <>Transferido de <b>{from}</b> para <b>{to}</b></> : <>Atribuído a <b>{to}</b></>}
        </div>
      );
    },
  },
  appointment_created: {
    icon: CalendarPlus, tone: 'text-violet-700 bg-violet-50 border-violet-200', dot: 'bg-violet-500', label: 'Agendamento',
    render: (e) => <div className="text-xs">Agendamento criado para <b>{fmt(e.metadata?.scheduled_at)}</b>{e.metadata?.type_exam && ` — ${e.metadata.type_exam}`}</div>,
  },
  appointment_rescheduled: {
    icon: CalendarClock, tone: 'text-amber-700 bg-amber-50 border-amber-200', dot: 'bg-amber-500', label: 'Remarcado',
    render: (e) => <div className="text-xs">Remarcado: {fmt(e.metadata?.from)} → <b>{fmt(e.metadata?.to)}</b></div>,
  },
  appointment_cancelled: {
    icon: CalendarX, tone: 'text-rose-700 bg-rose-50 border-rose-200', dot: 'bg-rose-500', label: 'Cancelado',
    render: (e) => <div className="text-xs">Agendamento cancelado{e.metadata?.cancellation_reason && <span className="italic"> — "{e.metadata.cancellation_reason}"</span>}</div>,
  },
  appointment_confirmed: {
    icon: ShieldCheck, tone: 'text-cyan-700 bg-cyan-50 border-cyan-200', dot: 'bg-cyan-500', label: 'Confirmado',
    render: (e) => <div className="text-xs">Agendamento confirmado para {fmt(e.metadata?.scheduled_at)}</div>,
  },
  appointment_checkin: {
    icon: LogIn, tone: 'text-teal-700 bg-teal-50 border-teal-200', dot: 'bg-teal-500', label: 'Check-in',
    render: (e) => <div className="text-xs">Check-in: {fmt(e.metadata?.at)}</div>,
  },
  appointment_checkout: {
    icon: LogOut, tone: 'text-teal-700 bg-teal-50 border-teal-200', dot: 'bg-teal-500', label: 'Check-out',
    render: (e) => <div className="text-xs">Check-out: {fmt(e.metadata?.at)}</div>,
  },
  appointment_completed: {
    icon: CalendarCheck, tone: 'text-emerald-700 bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', label: 'Compareceu',
    render: () => <div className="text-xs font-bold">Cliente compareceu à consulta</div>,
  },
  appointment_no_show: {
    icon: XCircle, tone: 'text-rose-700 bg-rose-50 border-rose-200', dot: 'bg-rose-500', label: 'No-show',
    render: () => <div className="text-xs font-bold">Cliente não compareceu</div>,
  },
  purchase: {
    icon: DollarSign, tone: 'text-emerald-700 bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', label: 'Compra',
    render: (e) => (
      <div className="space-y-0.5">
        <div className="text-xs"><b className="text-emerald-700">{brl(e.metadata?.amount)}</b> em {fmtDate(e.metadata?.date)}</div>
        {e.metadata?.product && <div className="text-[11px] text-gray-600">{e.metadata.product}</div>}
        {(e.metadata?.payment_method || e.metadata?.installments) && (
          <div className="text-[11px] text-gray-500">
            {e.metadata.payment_method}{e.metadata.installments ? ` • ${e.metadata.installments}x` : ''}
          </div>
        )}
      </div>
    ),
  },
  lead_created: {
    icon: Sparkles, tone: 'text-amber-700 bg-amber-50 border-amber-200', dot: 'bg-amber-500', label: 'Criado',
    render: () => <div className="text-xs font-bold">Lead criado</div>,
  },
};

export const EVENT_CATEGORIES = {
  stages: ['stage_change', 'lead_created'] as string[],
  appointments: ['appointment_created', 'appointment_rescheduled', 'appointment_cancelled', 'appointment_confirmed', 'appointment_checkin', 'appointment_checkout', 'appointment_completed', 'appointment_no_show'] as string[],
  sales: ['purchase'] as string[],
  team: ['assignment_change'] as string[],
};

export function categoryOf(type: string): keyof typeof EVENT_CATEGORIES | null {
  for (const [k, v] of Object.entries(EVENT_CATEGORIES)) if (v.includes(type)) return k as any;
  return null;
}

export function LeadEventItem({ event, profileMap }: { event: LeadEvent; profileMap: Map<string, string> }) {
  const cfg = CFG[event.event_type] ?? CFG.stage_change;
  const Icon = cfg.icon;
  const who = event.changed_by ? profileMap.get(event.changed_by) : null;
  return (
    <li className="ml-4 relative">
      <div className={cn('absolute -left-[22px] mt-0.5 w-4 h-4 rounded-full border-2 border-white shadow flex items-center justify-center', cfg.dot)}>
        <Icon className="w-2.5 h-2.5 text-white" strokeWidth={3} />
      </div>
      <div className={cn('rounded-lg border px-3 py-2 space-y-1', cfg.tone)}>
        <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider font-black opacity-70">
          <span>{cfg.label}</span>
          <span>{fmt(event.created_at)}</span>
        </div>
        {cfg.render(event, profileMap)}
        {who && <div className="text-[10px] text-gray-500 italic">por {who}</div>}
      </div>
    </li>
  );
}

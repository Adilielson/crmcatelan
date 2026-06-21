import { useMemo, useState } from 'react';
import { History } from 'lucide-react';
import { useLeadHistory, type LeadEvent } from '@/hooks/use-lead-history';
import { useTenantProfiles } from '@/hooks/use-tenant-profiles';
import { LeadEventItem, EVENT_CATEGORIES, categoryOf } from './LeadEventItem';
import { cn } from '@/lib/utils';
import type { DBLead } from '@/hooks/use-leads';

const FILTERS = [
  { key: 'all', label: 'Tudo' },
  { key: 'stages', label: 'Etapas' },
  { key: 'appointments', label: 'Agenda' },
  { key: 'sales', label: 'Vendas' },
  { key: 'team', label: 'Atendente' },
] as const;

export function LeadTimeline({ lead }: { lead: DBLead }) {
  const { data: events = [], isLoading } = useLeadHistory(lead.id);
  const { data: profiles = [] } = useTenantProfiles();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');

  const profileMap = useMemo(() => {
    const m = new Map<string, string>();
    profiles.forEach((p) => m.set(p.id, p.full_name ?? 'Usuário'));
    return m;
  }, [profiles]);

  // Inject synthetic "lead_created" event
  const all: LeadEvent[] = useMemo(() => {
    const list = [...events];
    list.push({
      id: `created-${lead.id}`,
      lead_id: lead.id,
      event_type: 'lead_created',
      stage_from: null,
      stage_to: null,
      changed_by: lead.assigned_user_id,
      duration: null,
      reason: null,
      metadata: { source: lead.source },
      created_at: lead.created_at,
    });
    return list.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  }, [events, lead]);

  const filtered = useMemo(() => {
    if (filter === 'all') return all;
    return all.filter((e) => categoryOf(e.event_type) === filter);
  }, [all, filter]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <History className="w-3.5 h-3.5 text-gray-500" />
        <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500">Histórico do lead</h4>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border transition-colors',
              filter === f.key
                ? 'bg-ink text-white border-ink'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-4">
        {isLoading ? (
          <div className="text-[11px] text-gray-400">Carregando histórico...</div>
        ) : filtered.length === 0 ? (
          <div className="text-[11px] text-gray-400 font-medium">Nenhum evento registrado neste filtro.</div>
        ) : (
          <ol className="relative border-l-2 border-gray-100 ml-2 space-y-3">
            {filtered.map((e) => (
              <LeadEventItem key={e.id} event={e} profileMap={profileMap} />
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

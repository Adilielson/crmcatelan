import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, UserCheck, Eye, AlertTriangle, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { stageLabel } from '@/hooks/use-leads';
import { toast } from 'sonner';

export const Route = createFileRoute('/equipe')({
  component: Equipe,
  errorComponent: ({ error, reset }) => (
    <div className="space-y-4 p-6">
      <h1 className="text-xl font-black text-ink">Não foi possível carregar a Equipe</h1>
      <p className="text-sm text-[#6B7280]">{error?.message || 'Erro desconhecido.'}</p>
      <Button onClick={() => reset()}>Tentar novamente</Button>
    </div>
  ),
});

interface TeamProfile {
  id: string;
  full_name: string | null;
  role: string;
  avatar_url: string | null;
}

interface TeamLead {
  id: string;
  full_name: string | null;
  phone: string | null;
  status: string;
  assigned_user_id: string | null;
  updated_at: string;
  sales_value: number | null;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Dono',
  seller: 'Vendedor',
  consultant: 'Consultor',
  attendant: 'Atendente',
  admin: 'Admin',
  super_admin: 'Super Admin',
  marketing_partner: 'Parceiro',
};

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  open: 'secondary',
  in_progress: 'default',
  scheduled: 'outline',
  checked_in: 'outline',
  negotiating: 'outline',
  showed_up: 'default',
  followup: 'secondary',
  lost: 'destructive',
};

const ACTIVE_STATUSES = new Set([
  'open',
  'in_progress',
  'negotiating',
  'scheduled',
  'checked_in',
  'followup',
]);

// SLA: alerta se lead ativo está parado há mais de X horas
const STALE_HOURS = 4;

// Pseudo-id usado como filtro para leads atendidos pela IA (assigned_user_id null)
const AI_FILTER_ID = '__ai__';
const FREE_FILTER_ID = '__free__';

function initials(name: string | null | undefined, fallback = '?') {
  const n = (name || '').trim();
  if (!n) return fallback;
  return n
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s.charAt(0).toUpperCase())
    .join('');
}

function hoursSince(iso: string) {
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

const MANAGER_ROLES = new Set(['admin', 'super_admin', 'owner', 'manager']);

function Equipe() {
  const tenantId = useAuthStore((s) => s.tenant?.id ?? null);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const role = useAuthStore((s) => s.user?.role ?? null);
  const isManager = role ? MANAGER_ROLES.has(role) : false;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  // Atendente comum entra já filtrado nos próprios leads; gerentes/admins veem todos
  const [assigneeFilter, setAssigneeFilter] = useState<string>(
    !isManager && userId ? userId : 'all',
  );

  // Quando o auth carrega depois do mount, aplica o filtro padrão uma única vez
  const appliedDefaultRef = useRef(false);
  useEffect(() => {
    if (appliedDefaultRef.current) return;
    if (!userId || role === null) return;
    appliedDefaultRef.current = true;
    if (!isManager) setAssigneeFilter(userId);
  }, [userId, role, isManager]);

  // Realtime: refletir movimentações de leads imediatamente
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`equipe-leads-${tenantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads', filter: `tenant_id=eq.${tenantId}` },
        () => {
          qc.invalidateQueries({ queryKey: ['equipe-leads', tenantId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, qc]);





  const profilesQ = useQuery({
    queryKey: ['equipe-profiles', tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<TeamProfile[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, avatar_url')
        .eq('tenant_id', tenantId!);
      if (error) throw error;
      return (data ?? []) as TeamProfile[];
    },
  });

  const leadsQ = useQuery({
    queryKey: ['equipe-leads', tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<TeamLead[]> => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, full_name, phone, status, assigned_user_id, updated_at, sales_value')
        .eq('tenant_id', tenantId!)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as TeamLead[];
    },
  });

  const profiles = profilesQ.data ?? [];
  const leads = leadsQ.data ?? [];

  const profileById = useMemo(() => {
    const m = new Map<string, TeamProfile>();
    profiles.forEach((p) => m.set(p.id, p));
    return m;
  }, [profiles]);

  // Agrega carga de trabalho por atendente + IA
  const workload = useMemo(() => {
    const active = leads.filter((l) => ACTIVE_STATUSES.has(l.status));
    const byUser = new Map<string, { count: number; stale: number; oldestHrs: number; sales: number; salesCount: number }>();
    let aiCount = 0;
    let aiStale = 0;
    let aiOldest = 0;
    let aiSales = 0;
    let aiSalesCount = 0;
    for (const l of active) {
      const hrs = hoursSince(l.updated_at);
      if (!l.assigned_user_id) {
        aiCount += 1;
        if (hrs >= STALE_HOURS) aiStale += 1;
        if (hrs > aiOldest) aiOldest = hrs;
        continue;
      }
      const cur = byUser.get(l.assigned_user_id) ?? { count: 0, stale: 0, oldestHrs: 0, sales: 0, salesCount: 0 };
      cur.count += 1;
      if (hrs >= STALE_HOURS) cur.stale += 1;
      if (hrs > cur.oldestHrs) cur.oldestHrs = hrs;
      byUser.set(l.assigned_user_id, cur);
    }
    // Soma vendas fechadas (status = showed_up) por atendente, com base no valor da ficha
    for (const l of leads) {
      if (l.status !== 'showed_up') continue;
      const val = Number(l.sales_value ?? 0) || 0;
      if (!l.assigned_user_id) {
        aiSales += val;
        aiSalesCount += 1;
        continue;
      }
      const cur = byUser.get(l.assigned_user_id) ?? { count: 0, stale: 0, oldestHrs: 0, sales: 0, salesCount: 0 };
      cur.sales += val;
      cur.salesCount += 1;
      byUser.set(l.assigned_user_id, cur);
    }
    return { byUser, aiCount, aiStale, aiOldest, aiSales, aiSalesCount, totalActive: active.length };
  }, [leads]);

  const kpis = useMemo(() => {
    const busyUserIds = new Set(workload.byUser.keys());
    const free = profiles.filter((p) => !busyUserIds.has(p.id)).length;
    return {
      total: profiles.length,
      inProgress: busyUserIds.size,
      free,
      active: workload.totalActive,
    };
  }, [workload, profiles]);

  const assignMutation = useMutation({
    mutationFn: async (lead: TeamLead) => {
      if (!userId) throw new Error('Usuário não identificado');
      const { error } = await (supabase as any)
        .from('leads')
        .update({ assigned_user_id: userId, status: 'in_progress' })
        .eq('id', lead.id);
      if (error) throw error;
      return lead;
    },
    onSuccess: (lead) => {
      qc.invalidateQueries({ queryKey: ['equipe-leads', tenantId] });
      qc.invalidateQueries({ queryKey: ['leads', tenantId] });
      toast.success('Atendimento assumido');
      navigate({ to: '/chat', search: { phone: lead.phone ?? undefined } });
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      // filtro por atendente
      if (assigneeFilter !== 'all') {
        if (assigneeFilter === AI_FILTER_ID) {
          if (l.assigned_user_id !== null) return false;
        } else if (assigneeFilter === FREE_FILTER_ID) {
          if (l.assigned_user_id !== null || !ACTIVE_STATUSES.has(l.status)) return false;
        } else {
          if (l.assigned_user_id !== assigneeFilter) return false;
        }
      }
      if (!q) return true;
      const seller = l.assigned_user_id
        ? profileById.get(l.assigned_user_id)?.full_name ?? ''
        : 'IA';
      return [l.full_name, l.phone, seller]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [leads, search, profileById, assigneeFilter]);

  const filterLabel =
    assigneeFilter === 'all'
      ? null
      : assigneeFilter === AI_FILTER_ID
        ? 'IA'
        : assigneeFilter === FREE_FILTER_ID
          ? 'Livres'
          : profileById.get(assigneeFilter)?.full_name ?? 'Atendente';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-ink">Visão da Equipe</h1>
        <p className="text-sm text-[#6B7280]">
          Distribuição de atendimentos e disponibilidade do time.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Total da equipe" value={kpis.total} />
        <KpiCard label="Em atendimento" value={kpis.inProgress} />
        <KpiCard label="Livres" value={kpis.free} />
        <KpiCard label="Total ativos" value={kpis.active} />
      </div>

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-ink">Carga por atendente</h2>
            <p className="text-xs text-[#6B7280]">
              Clique em um card para filtrar a lista abaixo.
            </p>
          </div>
        </div>
        {profilesQ.isLoading ? (
          <p className="text-sm text-[#6B7280]">Carregando equipe…</p>
        ) : profilesQ.isError ? (
          <p className="text-sm text-red-600">
            Erro ao carregar equipe: {(profilesQ.error as Error)?.message}
          </p>
        ) : profiles.length === 0 ? (
          <p className="text-sm text-[#6B7280]">Nenhum membro encontrado.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {profiles.map((p) => {
              const w = workload.byUser.get(p.id) ?? { count: 0, stale: 0, oldestHrs: 0, sales: 0, salesCount: 0 };
              const isActive = assigneeFilter === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() =>
                    setAssigneeFilter((cur) => (cur === p.id ? 'all' : p.id))
                  }
                  className={`flex items-start gap-3 rounded-[12px] border bg-white p-3 text-left transition hover:border-[#FFC400] hover:shadow-sm ${
                    isActive ? 'border-[#FFC400] ring-2 ring-[#FFC400]/30' : 'border-[#E3E6EB]'
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFC400]/15 text-sm font-black text-[#1a1500]">
                    {initials(p.full_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">
                      {p.full_name || 'Sem nome'}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-[#6B7280]">
                      {ROLE_LABELS[p.role] || p.role}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-bold text-ink">
                        {w.count} <span className="font-normal text-[#6B7280]">ativos</span>
                      </span>
                      {w.stale > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 font-bold text-red-700">
                          <AlertTriangle className="h-3 w-3" />
                          {w.stale} parado{w.stale > 1 ? 's' : ''}
                        </span>
                      )}
                      {w.count === 0 && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700">
                          Livre
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-emerald-50 px-2 py-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                        Vendas
                      </span>
                      <span className="text-sm font-black text-emerald-800">
                        {BRL.format(w.sales)}
                        <span className="ml-1 text-[10px] font-normal text-emerald-700">
                          ({w.salesCount})
                        </span>
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Card IA */}
            <button
              type="button"
              onClick={() =>
                setAssigneeFilter((cur) => (cur === AI_FILTER_ID ? 'all' : AI_FILTER_ID))
              }
              className={`flex items-start gap-3 rounded-[12px] border bg-white p-3 text-left transition hover:border-[#FFC400] hover:shadow-sm ${
                assigneeFilter === AI_FILTER_ID
                  ? 'border-[#FFC400] ring-2 ring-[#FFC400]/30'
                  : 'border-[#E3E6EB]'
              }`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-black text-violet-700">
                IA
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">Atendimento IA</p>
                <p className="text-[10px] uppercase tracking-wider text-[#6B7280]">
                  Automático
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-ink">
                    {workload.aiCount}{' '}
                    <span className="font-normal text-[#6B7280]">ativos</span>
                  </span>
                  {workload.aiStale > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 font-bold text-red-700">
                      <AlertTriangle className="h-3 w-3" />
                      {workload.aiStale} parado{workload.aiStale > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-emerald-50 px-2 py-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                    Vendas
                  </span>
                  <span className="text-sm font-black text-emerald-800">
                    {BRL.format(workload.aiSales)}
                    <span className="ml-1 text-[10px] font-normal text-emerald-700">
                      ({workload.aiSalesCount})
                    </span>
                  </span>
                </div>
              </div>
            </button>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-black text-ink">Atendimentos</h2>
            {filterLabel && (
              <Badge
                variant="outline"
                className="cursor-pointer gap-1 border-[#FFC400] bg-[#FFC400]/10 text-ink"
                onClick={() => setAssigneeFilter('all')}
              >
                Filtro: {filterLabel}
                <X className="h-3 w-3" />
              </Badge>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Filtrar por atendente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os atendentes</SelectItem>
                <SelectItem value={FREE_FILTER_ID}>Livres (sem atendente)</SelectItem>
                <SelectItem value={AI_FILTER_ID}>Atendimento IA</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name || 'Sem nome'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente, telefone ou vendedor"
                className="w-full pl-9 sm:w-80"
              />
            </div>
          </div>
        </div>

        {leadsQ.isLoading ? (
          <p className="text-sm text-[#6B7280]">Carregando atendimentos…</p>
        ) : leadsQ.isError ? (
          <p className="text-sm text-red-600">
            Erro ao carregar atendimentos: {(leadsQ.error as Error)?.message}
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-[#6B7280]">Nenhum atendimento encontrado.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tempo parado</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((l) => {
                const seller = l.assigned_user_id
                  ? profileById.get(l.assigned_user_id)
                  : null;
                const hrs = hoursSince(l.updated_at);
                const isActive = ACTIVE_STATUSES.has(l.status);
                const isStale = isActive && hrs >= STALE_HOURS;
                return (
                  <TableRow key={l.id}>
                    <TableCell>
                      <div className="font-bold text-ink">
                        {l.full_name?.trim() || l.phone || 'Sem nome'}
                      </div>
                      {l.phone && (
                        <div className="text-xs text-[#6B7280]">{l.phone}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[l.status] || 'secondary'}>
                        {stageLabel(l.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      <span
                        className={
                          isStale
                            ? 'inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 font-bold text-red-700'
                            : 'text-[#6B7280]'
                        }
                      >
                        {isStale && <AlertTriangle className="h-3 w-3" />}
                        {(() => {
                          const d = l.updated_at ? new Date(l.updated_at) : null;
                          if (!d || Number.isNaN(d.getTime())) return '—';
                          try {
                            return formatDistanceToNow(d, { addSuffix: true, locale: ptBR });
                          } catch {
                            return '—';
                          }
                        })()}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {seller?.full_name ? (
                        <span className="font-medium text-ink">{seller.full_name}</span>
                      ) : l.assigned_user_id === null && isActive ? (
                        <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700">
                          IA
                        </span>
                      ) : (
                        <span className="text-[#9CA3AF] italic">Livre</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            navigate({
                              to: '/chat',
                              search: { phone: l.phone ?? undefined },
                            })
                          }
                        >
                          <Eye />
                          Ver
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => assignMutation.mutate(l)}
                          disabled={assignMutation.isPending}
                        >
                          <UserCheck />
                          Assumir
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-5">
      <p className="text-[11px] font-black uppercase tracking-widest text-[#6B7280]">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black text-ink">{value}</p>
    </Card>
  );
}

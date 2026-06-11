import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, UserCheck, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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

function initials(name: string | null | undefined, fallback = '?') {
  const n = (name || '').trim();
  if (!n) return fallback;
  return n
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s.charAt(0).toUpperCase())
    .join('');
}

function Equipe() {
  const tenantId = useAuthStore((s) => s.tenant?.id ?? null);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');

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
        .select('id, full_name, phone, status, assigned_user_id, updated_at')
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

  const kpis = useMemo(() => {
    const active = leads.filter((l) => l.status !== 'showed_up' && l.status !== 'lost');
    const inProgress = active.filter((l) => l.status === 'in_progress');
    const busyUserIds = new Set(
      inProgress.map((l) => l.assigned_user_id).filter(Boolean) as string[],
    );
    const free = profiles.filter((p) => !busyUserIds.has(p.id)).length;
    return {
      total: profiles.length,
      inProgress: busyUserIds.size,
      free,
      active: active.length,
    };
  }, [leads, profiles]);

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
    if (!q) return leads;
    return leads.filter((l) => {
      const seller = l.assigned_user_id
        ? profileById.get(l.assigned_user_id)?.full_name ?? ''
        : '';
      return [l.full_name, l.phone, seller]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [leads, search, profileById]);

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
        <h2 className="mb-4 text-lg font-black text-ink">Equipe</h2>
        {profilesQ.isLoading ? (
          <p className="text-sm text-[#6B7280]">Carregando equipe…</p>
        ) : profiles.length === 0 ? (
          <p className="text-sm text-[#6B7280]">Nenhum membro encontrado.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {profiles.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-[12px] border border-[#E3E6EB] bg-white p-3"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FFC400]/15 text-sm font-black text-[#1a1500]">
                  {initials(p.full_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">
                    {p.full_name || 'Sem nome'}
                  </p>
                  <p className="text-xs uppercase tracking-wider text-[#6B7280]">
                    {ROLE_LABELS[p.role] || p.role}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-black text-ink">Atendimentos</h2>
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

        {leadsQ.isLoading ? (
          <p className="text-sm text-[#6B7280]">Carregando atendimentos…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-[#6B7280]">Nenhum atendimento encontrado.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Última interação</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((l) => {
                const seller = l.assigned_user_id
                  ? profileById.get(l.assigned_user_id)
                  : null;
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
                    <TableCell className="text-sm text-[#6B7280]">
                      {formatDistanceToNow(new Date(l.updated_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </TableCell>
                    <TableCell className="text-sm">
                      {seller?.full_name || (
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

import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, XCircle, DollarSign, Trophy, TrendingUp, Percent, Search, FileSpreadsheet, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/hooks/use-auth';
import { useTenantProfiles } from '@/hooks/use-tenant-profiles';
import { useAllPurchases } from '@/hooks/use-lead-purchases';
import { ReportFilters, defaultRange } from '@/components/reports/ReportFilters';
import { exportToExcel, exportToPDF } from '@/lib/report-export';
import { LOST_REASONS } from '@/components/leads/LostLeadDialog';

export const Route = createFileRoute('/resultados')({
  component: ResultadosPage,
});

interface ResultRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  source: string | null;
  assigned_user_id: string | null;
  status: string;
  sales_value: number | null;
  lost_reason: string | null;
  lost_reason_note: string | null;
  products_sold: string | null;
  payment_method: string | null;
  updated_at: string | null;
  closed_at: string | null;
}

const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function ResultadosPage() {
  const tenantId = useAuthStore((s) => s.tenant?.id ?? null);
  const [range, setRange] = useState(defaultRange);
  const [attendantFilter, setAttendantFilter] = useState<string>('all');
  const [reasonFilter, setReasonFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'todos' | 'ganhos' | 'perdidos'>('todos');

  const { data: profiles = [] } = useTenantProfiles();
  const profileMap = useMemo(() => {
    const m = new Map<string, string>();
    profiles.forEach((p) => m.set(p.id, p.full_name ?? '—'));
    return m;
  }, [profiles]);

  const { data: purchases = [] } = useAllPurchases();

  const { data: rows = [], isLoading } = useQuery({
    enabled: !!tenantId,
    queryKey: ['resultados', tenantId, range],
    queryFn: async (): Promise<ResultRow[]> => {
      const fromISO = new Date(`${range.from}T00:00:00`).toISOString();
      const toISO = new Date(`${range.to}T23:59:59`).toISOString();
      const { data, error } = await supabase
        .from('leads')
        .select(
          'id, full_name, phone, source, assigned_user_id, status, sales_value, lost_reason, lost_reason_note, products_sold, payment_method, updated_at, closed_at',
        )
        .eq('tenant_id', tenantId!)
        .in('status', ['showed_up', 'lost'])
        .gte('updated_at', fromISO)
        .lte('updated_at', toISO)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ResultRow[];
    },
  });

  // Aggregate LTV per lead from purchases (fallback to sales_value)
  const ltvByLead = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of purchases) {
      m.set(p.lead_id, (m.get(p.lead_id) ?? 0) + Number(p.amount ?? 0));
    }
    return m;
  }, [purchases]);

  const enriched = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        value: ltvByLead.get(r.id) ?? Number(r.sales_value ?? 0),
      })),
    [rows, ltvByLead],
  );

  const filtered = useMemo(() => {
    return enriched.filter((r) => {
      if (tab === 'ganhos' && r.status !== 'showed_up') return false;
      if (tab === 'perdidos' && r.status !== 'lost') return false;
      if (attendantFilter !== 'all' && r.assigned_user_id !== attendantFilter) return false;
      if (tab !== 'ganhos' && reasonFilter !== 'all') {
        const v = r.lost_reason ?? 'Sem motivo';
        if (r.status !== 'lost' || v !== reasonFilter) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const hit =
          (r.full_name ?? '').toLowerCase().includes(q) ||
          (r.phone ?? '').toLowerCase().includes(q) ||
          (r.lost_reason ?? '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [enriched, tab, attendantFilter, reasonFilter, search]);

  const won = filtered.filter((r) => r.status === 'showed_up');
  const lost = filtered.filter((r) => r.status === 'lost');
  const totalWon = won.reduce((s, r) => s + r.value, 0);
  const ticket = won.length ? totalWon / won.length : 0;
  const conversion = filtered.length ? (won.length / filtered.length) * 100 : 0;

  const byReason = useMemo(() => {
    const map = new Map<string, number>();
    lost.forEach((r) => {
      const k = r.lost_reason ?? 'Sem motivo';
      map.set(k, (map.get(k) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);
  }, [lost]);

  const period = `${range.from}_a_${range.to}`;

  const exportRows = () =>
    filtered.map((r) => ({
      Lead: r.full_name ?? '',
      Telefone: r.phone ?? '',
      Origem: r.source ?? '',
      Atendente: r.assigned_user_id ? profileMap.get(r.assigned_user_id) ?? '—' : '—',
      Resultado: r.status === 'showed_up' ? 'Ganho' : 'Perdido',
      Valor: r.value,
      Motivo: r.status === 'lost' ? r.lost_reason ?? 'Sem motivo' : '',
      Data: r.updated_at ? new Date(r.updated_at).toLocaleString('pt-BR') : '',
    }));

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Trophy className="h-6 w-6 text-amber-500" />
          <div>
            <h1 className="text-2xl font-bold">Resultados</h1>
            <p className="text-sm text-muted-foreground">
              Vendas fechadas e leads perdidos — visão única.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              exportToExcel(`resultados_${period}`, [
                { name: 'Detalhamento', rows: exportRows() },
                {
                  name: 'Perdidos por motivo',
                  rows: byReason.map((r) => ({ Motivo: r.reason, Quantidade: r.count })),
                },
              ])
            }
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              exportToPDF(
                `resultados_${period}`,
                'Relatório de Resultados',
                `Período: ${range.from} a ${range.to}`,
                [
                  {
                    head: ['Lead', 'Atendente', 'Resultado', 'Valor', 'Motivo', 'Data'],
                    body: filtered.map((r) => [
                      r.full_name ?? '',
                      r.assigned_user_id ? profileMap.get(r.assigned_user_id) ?? '—' : '—',
                      r.status === 'showed_up' ? 'Ganho' : 'Perdido',
                      brl(r.value),
                      r.status === 'lost' ? r.lost_reason ?? 'Sem motivo' : '',
                      r.updated_at ? new Date(r.updated_at).toLocaleDateString('pt-BR') : '',
                    ]),
                  },
                ],
              )
            }
          >
            <FileText className="mr-2 h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      <ReportFilters value={range} onChange={setRange} />

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
        <div className="min-w-[200px]">
          <Label className="text-xs">Atendente</Label>
          <Select value={attendantFilter} onValueChange={setAttendantFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os atendentes</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.full_name ?? '—'}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {tab !== 'ganhos' && (
          <div className="min-w-[200px]">
            <Label className="text-xs">Motivo (perdidos)</Label>
            <Select value={reasonFilter} onValueChange={setReasonFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {LOST_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
                <SelectItem value="Sem motivo">Sem motivo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="min-w-[220px] flex-1">
          <Label className="text-xs">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Nome, telefone ou motivo"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi icon={CheckCircle2} tone="emerald" label="Ganhos" value={String(won.length)} sub={brl(totalWon)} />
        <Kpi icon={XCircle} tone="red" label="Perdidos" value={String(lost.length)} />
        <Kpi icon={TrendingUp} tone="sky" label="Ticket médio" value={brl(ticket)} />
        <Kpi icon={Percent} tone="amber" label="Conversão" value={`${conversion.toFixed(1)}%`} />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="todos">Todos ({filtered.length})</TabsTrigger>
          <TabsTrigger value="ganhos">Ganhos ({won.length})</TabsTrigger>
          <TabsTrigger value="perdidos">Perdidos ({lost.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="todos" className="mt-4">
          <ResultsTable rows={filtered} profileMap={profileMap} isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="ganhos" className="mt-4">
          <ResultsTable rows={filtered} profileMap={profileMap} isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="perdidos" className="mt-4 space-y-4">
          {byReason.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ranking de motivos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {byReason.map((r) => {
                  const max = byReason[0].count;
                  return (
                    <div key={r.reason} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{r.reason}</span>
                        <span className="text-muted-foreground">{r.count}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-red-500/80"
                          style={{ width: `${(r.count / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
          <ResultsTable rows={filtered} profileMap={profileMap} isLoading={isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ResultsTable({
  rows,
  profileMap,
  isLoading,
}: {
  rows: (ResultRow & { value: number })[];
  profileMap: Map<string, string>;
  isLoading: boolean;
}) {
  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Nenhum resultado no período.</p>;

  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lead</TableHead>
              <TableHead>Atendente</TableHead>
              <TableHead>Resultado</TableHead>
              <TableHead>Valor / Motivo</TableHead>
              <TableHead className="text-right">Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">
                  {r.full_name ?? '—'}
                  {r.phone && <div className="text-xs text-muted-foreground">{r.phone}</div>}
                </TableCell>
                <TableCell>
                  {r.assigned_user_id ? profileMap.get(r.assigned_user_id) ?? '—' : '—'}
                </TableCell>
                <TableCell>
                  {r.status === 'showed_up' ? (
                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Ganho
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="font-normal">
                      <XCircle className="w-3 h-3 mr-1" /> Perdido
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {r.status === 'showed_up' ? (
                    <span className="font-bold text-emerald-700 inline-flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5" /> {brl(r.value)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-sm">
                      {r.lost_reason ?? 'Sem motivo'}
                      {r.lost_reason_note && (
                        <span className="block text-xs opacity-70 truncate max-w-[240px]">
                          {r.lost_reason_note}
                        </span>
                      )}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground whitespace-nowrap">
                  {r.updated_at ? new Date(r.updated_at).toLocaleDateString('pt-BR') : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Kpi({
  icon: Icon,
  tone,
  label,
  value,
  sub,
}: {
  icon: any;
  tone: 'emerald' | 'red' | 'sky' | 'amber';
  label: string;
  value: string;
  sub?: string;
}) {
  const tones: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    red: 'bg-red-50 text-red-600 border-red-100',
    sky: 'bg-sky-50 text-sky-600 border-sky-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
  };
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-xl border flex items-center justify-center ${tones[tone]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-xl font-bold leading-tight truncate">{value}</p>
          {sub && <p className="text-[11px] text-muted-foreground truncate">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

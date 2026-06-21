import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { XCircle, FileSpreadsheet, FileText, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/hooks/use-auth';
import { useTenantProfiles } from '@/hooks/use-tenant-profiles';
import { ReportFilters, defaultRange } from '@/components/reports/ReportFilters';
import { exportToExcel, exportToPDF } from '@/lib/report-export';
import { LOST_REASONS } from '@/components/leads/LostLeadDialog';

export const Route = createFileRoute('/relatorios/perdidos')({
  component: LostLeadsReportPage,
});

interface LostLeadRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  source: string | null;
  assigned_user_id: string | null;
  lost_reason: string | null;
  lost_reason_note: string | null;
  closed_at: string | null;
  updated_at: string | null;
}

function LostLeadsReportPage() {
  const tenantId = useAuthStore((s) => s.tenant?.id ?? null);
  const [range, setRange] = useState(defaultRange);
  const [reasonFilter, setReasonFilter] = useState<string>('all');
  const [attendantFilter, setAttendantFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const { data: profiles = [] } = useTenantProfiles();
  const profileMap = useMemo(() => {
    const m = new Map<string, string>();
    profiles.forEach((p) => m.set(p.id, p.full_name ?? '—'));
    return m;
  }, [profiles]);

  const { data: rows = [], isLoading } = useQuery({
    enabled: !!tenantId,
    queryKey: ['report-lost-leads', tenantId, range],
    queryFn: async (): Promise<LostLeadRow[]> => {
      const fromISO = new Date(`${range.from}T00:00:00`).toISOString();
      const toISO = new Date(`${range.to}T23:59:59`).toISOString();
      const { data, error } = await supabase
        .from('leads')
        .select(
          'id, full_name, phone, source, assigned_user_id, lost_reason, lost_reason_note, closed_at, updated_at',
        )
        .eq('tenant_id', tenantId!)
        .eq('status', 'lost')
        .gte('updated_at', fromISO)
        .lte('updated_at', toISO)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as LostLeadRow[];
    },
  });

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (reasonFilter !== 'all') {
        const v = r.lost_reason ?? 'Sem motivo';
        if (v !== reasonFilter) return false;
      }
      if (attendantFilter !== 'all' && r.assigned_user_id !== attendantFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hit =
          (r.full_name ?? '').toLowerCase().includes(q) ||
          (r.phone ?? '').toLowerCase().includes(q) ||
          (r.lost_reason_note ?? '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [rows, reasonFilter, attendantFilter, search]);

  const byReason = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((r) => {
      const k = r.lost_reason ?? 'Sem motivo';
      map.set(k, (map.get(k) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);
  }, [filtered]);

  const total = filtered.length;
  const maxCount = byReason[0]?.count ?? 0;
  const topReason = byReason[0]?.reason ?? '—';
  const withoutReason = filtered.filter((r) => !r.lost_reason).length;

  const period = `${range.from}_a_${range.to}`;

  const exportRows = () =>
    filtered.map((r) => ({
      Lead: r.full_name ?? '',
      Telefone: r.phone ?? '',
      Origem: r.source ?? '',
      Atendente: r.assigned_user_id ? profileMap.get(r.assigned_user_id) ?? '—' : '—',
      Motivo: r.lost_reason ?? 'Sem motivo',
      Observação: r.lost_reason_note ?? '',
      Data: r.updated_at ? new Date(r.updated_at).toLocaleString('pt-BR') : '',
    }));

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <XCircle className="h-6 w-6 text-red-500" />
        <div>
          <h1 className="text-2xl font-bold">Leads Perdidos</h1>
          <p className="text-sm text-muted-foreground">
            Motivos de perda e detalhamento por lead no período selecionado.
          </p>
        </div>
      </div>

      <ReportFilters
        value={range}
        onChange={setRange}
        rightSlot={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportToExcel(`leads_perdidos_${period}`, [
                  { name: 'Perdidos por motivo', rows: byReason.map((r) => ({ Motivo: r.reason, Quantidade: r.count })) },
                  { name: 'Detalhamento', rows: exportRows() },
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
                  `leads_perdidos_${period}`,
                  'Relatório de Leads Perdidos',
                  `Período: ${range.from} a ${range.to} — ${total} lead(s) perdido(s)`,
                  [
                    {
                      head: ['Motivo', 'Qtd'],
                      body: byReason.map((r) => [r.reason, String(r.count)]),
                    },
                    {
                      head: ['Lead', 'Telefone', 'Atendente', 'Motivo', 'Observação', 'Data'],
                      body: filtered.map((r) => [
                        r.full_name ?? '',
                        r.phone ?? '',
                        r.assigned_user_id ? profileMap.get(r.assigned_user_id) ?? '—' : '—',
                        r.lost_reason ?? 'Sem motivo',
                        r.lost_reason_note ?? '',
                        r.updated_at ? new Date(r.updated_at).toLocaleDateString('pt-BR') : '',
                      ]),
                    },
                  ],
                )
              }
            >
              <FileText className="mr-2 h-4 w-4" /> PDF
            </Button>
          </>
        }
      />

      {/* Filtros adicionais */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
        <div className="min-w-[200px]">
          <Label className="text-xs">Motivo</Label>
          <Select value={reasonFilter} onValueChange={setReasonFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os motivos</SelectItem>
              {LOST_REASONS.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
              <SelectItem value="Sem motivo">Sem motivo</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
        <div className="min-w-[220px] flex-1">
          <Label className="text-xs">Buscar</Label>
          <Input
            placeholder="Nome, telefone ou observação"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi label="Total perdidos" value={String(total)} />
        <Kpi label="Motivos distintos" value={String(byReason.length)} />
        <Kpi label="Principal motivo" value={topReason} />
        <Kpi label="Sem motivo informado" value={String(withoutReason)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ranking de motivos</CardTitle>
        </CardHeader>
        <CardContent>
          {byReason.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados no período.</p>
          ) : (
            <div className="space-y-2">
              {byReason.map((r) => (
                <div key={r.reason} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{r.reason}</span>
                    <span className="text-muted-foreground">
                      {r.count} ({((r.count / total) * 100).toFixed(0)}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-red-500/80 transition-all"
                      style={{ width: `${(r.count / maxCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="h-4 w-4" /> Leads perdidos no período
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum lead perdido com esses filtros.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Atendente</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Observação</TableHead>
                  <TableHead className="text-right">Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.full_name ?? '—'}</TableCell>
                    <TableCell>{r.phone ?? '—'}</TableCell>
                    <TableCell>
                      {r.source ? <Badge variant="outline">{r.source}</Badge> : '—'}
                    </TableCell>
                    <TableCell>
                      {r.assigned_user_id ? profileMap.get(r.assigned_user_id) ?? '—' : '—'}
                    </TableCell>
                    <TableCell>
                      {r.lost_reason ? (
                        <Badge variant="destructive" className="font-normal">
                          {r.lost_reason}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">Sem motivo</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate text-muted-foreground">
                      {r.lost_reason_note ?? '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {r.updated_at
                        ? new Date(r.updated_at).toLocaleDateString('pt-BR')
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold truncate">{value}</p>
      </CardContent>
    </Card>
  );
}

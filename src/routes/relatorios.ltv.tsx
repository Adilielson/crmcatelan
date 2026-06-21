import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, FileSpreadsheet, FileText, Trophy, Users, ShoppingBag, Repeat } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/hooks/use-auth';
import { useTenantProfiles } from '@/hooks/use-tenant-profiles';
import { ReportFilters, defaultRange } from '@/components/reports/ReportFilters';
import { exportToExcel, exportToPDF, fmtBRL } from '@/lib/report-export';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const Route = createFileRoute('/relatorios/ltv')({
  component: LTVReportPage,
});

interface PurchaseRow {
  id: string;
  lead_id: string;
  purchase_date: string;
  amount: number;
  product_description: string | null;
  payment_method: string | null;
  installments: number | null;
  attendant_id: string | null;
  unit_id: string | null;
}
interface LeadLite { id: string; full_name: string; phone: string | null; }

function LTVReportPage() {
  const tenantId = useAuthStore((s) => s.tenant?.id ?? null);
  const [range, setRange] = useState(defaultRange);
  const [attendantFilter, setAttendantFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const { data: profiles = [] } = useTenantProfiles();
  const profileMap = useMemo(() => {
    const m = new Map<string, string>();
    profiles.forEach((p) => m.set(p.id, p.full_name ?? '—'));
    return m;
  }, [profiles]);

  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ['ltv-report', tenantId, range],
    enabled: !!tenantId,
    queryFn: async (): Promise<PurchaseRow[]> => {
      const { data, error } = await (supabase as any)
        .from('lead_purchases')
        .select('id, lead_id, purchase_date, amount, product_description, payment_method, installments, attendant_id, unit_id')
        .eq('tenant_id', tenantId!)
        .gte('purchase_date', range.from)
        .lte('purchase_date', range.to)
        .order('purchase_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as PurchaseRow[];
    },
  });

  const leadIds = useMemo(() => Array.from(new Set(purchases.map((p) => p.lead_id))), [purchases]);
  const { data: leads = [] } = useQuery({
    queryKey: ['ltv-report-leads', tenantId, leadIds.join(',')],
    enabled: !!tenantId && leadIds.length > 0,
    queryFn: async (): Promise<LeadLite[]> => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, full_name, phone')
        .in('id', leadIds);
      if (error) throw error;
      return (data ?? []) as LeadLite[];
    },
  });
  const leadMap = useMemo(() => {
    const m = new Map<string, LeadLite>();
    leads.forEach((l) => m.set(l.id, l));
    return m;
  }, [leads]);

  // ===== KPIs
  const filtered = useMemo(() => {
    return purchases.filter((p) => {
      if (attendantFilter !== 'all' && p.attendant_id !== attendantFilter) return false;
      if (search) {
        const lead = leadMap.get(p.lead_id);
        const q = search.toLowerCase();
        const hit = (lead?.full_name ?? '').toLowerCase().includes(q) || (lead?.phone ?? '').includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [purchases, attendantFilter, search, leadMap]);

  const totalLTV = filtered.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const totalCount = filtered.length;
  const avgTicket = totalCount > 0 ? totalLTV / totalCount : 0;

  // Por cliente (LTV agregado)
  const byClient = useMemo(() => {
    const map = new Map<string, { lead_id: string; full_name: string; phone: string | null; total: number; count: number; last: string }>();
    for (const p of filtered) {
      const lead = leadMap.get(p.lead_id);
      const existing = map.get(p.lead_id);
      if (existing) {
        existing.total += Number(p.amount ?? 0);
        existing.count += 1;
        if (p.purchase_date > existing.last) existing.last = p.purchase_date;
      } else {
        map.set(p.lead_id, {
          lead_id: p.lead_id,
          full_name: lead?.full_name ?? '—',
          phone: lead?.phone ?? null,
          total: Number(p.amount ?? 0),
          count: 1,
          last: p.purchase_date,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filtered, leadMap]);

  const recurringCount = byClient.filter((c) => c.count > 1).length;
  const recurringRate = byClient.length > 0 ? recurringCount / byClient.length : 0;

  const exportXLSX = () => {
    exportToExcel(`ltv_${range.from}_${range.to}`, [
      {
        name: 'Resumo',
        rows: [
          { Métrica: 'LTV total', Valor: totalLTV },
          { Métrica: 'Compras', Valor: totalCount },
          { Métrica: 'Clientes únicos', Valor: byClient.length },
          { Métrica: 'Clientes recorrentes', Valor: recurringCount },
          { Métrica: 'Taxa de recompra', Valor: (recurringRate * 100).toFixed(1) + '%' },
          { Métrica: 'Ticket médio', Valor: avgTicket },
        ],
      },
      {
        name: 'Top clientes',
        rows: byClient.map((c) => ({
          Cliente: c.full_name, Telefone: c.phone ?? '', 'LTV total': c.total,
          Compras: c.count, 'Última compra': c.last,
        })),
      },
      {
        name: 'Compras',
        rows: filtered.map((p) => ({
          Data: p.purchase_date,
          Cliente: leadMap.get(p.lead_id)?.full_name ?? '—',
          Telefone: leadMap.get(p.lead_id)?.phone ?? '',
          Valor: Number(p.amount),
          Produto: p.product_description ?? '',
          Pagamento: p.payment_method ?? '',
          Parcelas: p.installments ?? 1,
          Atendente: p.attendant_id ? (profileMap.get(p.attendant_id) ?? '') : '',
        })),
      },
    ]);
  };

  const exportPDF = () => {
    exportToPDF(
      `ltv_${range.from}_${range.to}`,
      'Relatório de LTV',
      `${range.from} → ${range.to}`,
      [
        {
          title: 'Resumo',
          head: ['LTV total', 'Compras', 'Clientes', 'Recorrentes', 'Taxa recompra', 'Ticket médio'],
          body: [[fmtBRL(totalLTV), totalCount, byClient.length, recurringCount, (recurringRate * 100).toFixed(1) + '%', fmtBRL(avgTicket)]],
        },
        {
          title: 'Top clientes por LTV',
          head: ['Cliente', 'Telefone', 'LTV', 'Compras', 'Última'],
          body: byClient.slice(0, 50).map((c) => [c.full_name, c.phone ?? '', fmtBRL(c.total), c.count, c.last]),
        },
      ],
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-6 w-6 text-emerald-600" />
          <div>
            <h1 className="text-2xl font-bold">Relatório de LTV</h1>
            <p className="text-sm text-muted-foreground">Compras registradas, recorrência e top clientes.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportXLSX} disabled={!filtered.length}>
            <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
          </Button>
          <Button variant="outline" onClick={exportPDF} disabled={!filtered.length}>
            <FileText className="w-4 h-4 mr-2" /> PDF
          </Button>
        </div>
      </div>

      <ReportFilters value={range} onChange={setRange} />

      <div className="flex flex-wrap gap-3 items-end">
        <div className="min-w-[220px]">
          <Label className="text-xs">Atendente</Label>
          <select
            className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={attendantFilter}
            onChange={(e) => setAttendantFilter(e.target.value)}
          >
            <option value="all">Todos</option>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>
        <div className="min-w-[260px] flex-1">
          <Label className="text-xs">Buscar cliente</Label>
          <Input placeholder="Nome ou telefone" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPICard icon={TrendingUp} label="LTV total" value={fmtBRL(totalLTV)} accent="text-emerald-600" />
        <KPICard icon={ShoppingBag} label="Compras" value={String(totalCount)} />
        <KPICard icon={Users} label="Clientes" value={String(byClient.length)} />
        <KPICard icon={Repeat} label="Recorrentes" value={`${recurringCount} (${(recurringRate * 100).toFixed(0)}%)`} />
        <KPICard icon={Trophy} label="Ticket médio" value={fmtBRL(avgTicket)} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Top clientes por LTV</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="text-right">LTV</TableHead>
                <TableHead className="text-right">Compras</TableHead>
                <TableHead>Última compra</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
              ) : byClient.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma compra no período.</TableCell></TableRow>
              ) : (
                byClient.slice(0, 100).map((c) => (
                  <TableRow key={c.lead_id}>
                    <TableCell className="font-medium">{c.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.phone ?? '—'}</TableCell>
                    <TableCell className="text-right font-bold text-emerald-700">{fmtBRL(c.total)}</TableCell>
                    <TableCell className="text-right">{c.count}</TableCell>
                    <TableCell>{format(new Date(c.last + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Todas as compras</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Atendente</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem compras.</TableCell></TableRow>
              ) : (
                filtered.slice(0, 200).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{format(new Date(p.purchase_date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                    <TableCell className="font-medium">{leadMap.get(p.lead_id)?.full_name ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{p.product_description ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.payment_method ?? '—'}{p.installments && p.installments > 1 ? ` • ${p.installments}x` : ''}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.attendant_id ? (profileMap.get(p.attendant_id) ?? '—') : '—'}</TableCell>
                    <TableCell className="text-right font-bold">{fmtBRL(Number(p.amount))}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function KPICard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Icon className="w-4 h-4" /> {label}
        </div>
        <div className={`mt-1 text-xl font-bold ${accent ?? ''}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

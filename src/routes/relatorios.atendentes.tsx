import { createFileRoute } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getAttendantsReport } from '@/lib/bi.functions';
import { ReportFilters, defaultRange } from '@/components/reports/ReportFilters';
import { exportToExcel, exportToPDF, fmtBRL, fmtPct } from '@/lib/report-export';

export const Route = createFileRoute('/relatorios/atendentes')({
  component: AttendantsReportPage,
});

function AttendantsReportPage() {
  const [range, setRange] = useState(defaultRange);
  const fetchReport = useServerFn(getAttendantsReport);
  const { data, isLoading } = useQuery({
    queryKey: ['report-attendants', range],
    queryFn: () => fetchReport({ data: range }),
  });
  const rows = data?.rows ?? [];
  const totals = data?.totals;

  function buildExportRows() {
    return rows.map((r) => ({
      Atendente: r.full_name,
      Papel: r.role,
      Leads: r.leads,
      Agendados: r.scheduled,
      Compareceram: r.showed_up,
      'No-show': r.no_show,
      Perdidos: r.lost,
      'Receita Consultas': r.revenue_consultations,
      'Receita Óculos': r.revenue_glasses,
      'Receita Total': r.revenue_total,
      'Ticket Médio': r.avg_ticket,
      Conversão: `${(r.conversion_rate * 100).toFixed(1)}%`,
    }));
  }
  const period = `${range.from} a ${range.to}`;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Relatório por Atendente</h1>
          <p className="text-sm text-muted-foreground">Desempenho individual no período selecionado.</p>
        </div>
      </div>

      <ReportFilters
        value={range}
        onChange={setRange}
        rightSlot={
          <>
            <Button variant="outline" size="sm" onClick={() => exportToExcel(`atendentes_${period}`, [{ name: 'Atendentes', rows: buildExportRows() }])}>
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportToPDF(
              `atendentes_${period}`,
              'Relatório por Atendente',
              `Período: ${period}`,
              [{
                head: ['Atendente','Papel','Leads','Ag.','Comp.','No-show','Perdidos','Receita','Ticket','Conv.'],
                body: rows.map((r) => [r.full_name, r.role, r.leads, r.scheduled, r.showed_up, r.no_show, r.lost, fmtBRL(r.revenue_total), fmtBRL(r.avg_ticket), fmtPct(r.conversion_rate)]),
              }],
            )}>
              <FileText className="mr-2 h-4 w-4" /> PDF
            </Button>
          </>
        }
      />

      {totals && (
        <div className="grid gap-3 md:grid-cols-5">
          <KpiCard label="Leads" value={String(totals.leads)} />
          <KpiCard label="Agendados" value={String(totals.scheduled)} />
          <KpiCard label="Compareceram" value={String(totals.showed_up)} />
          <KpiCard label="No-show" value={String(totals.no_show)} />
          <KpiCard label="Receita total" value={fmtBRL(totals.revenue_total)} />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="h-4 w-4" /> Detalhamento por atendente
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados no período.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Atendente</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Agendados</TableHead>
                  <TableHead className="text-right">Compareceram</TableHead>
                  <TableHead className="text-right">No-show</TableHead>
                  <TableHead className="text-right">Perdidos</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Ticket médio</TableHead>
                  <TableHead className="text-right">Conversão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.user_id}>
                    <TableCell className="font-medium">{r.full_name}</TableCell>
                    <TableCell><Badge variant="outline">{r.role}</Badge></TableCell>
                    <TableCell className="text-right">{r.leads}</TableCell>
                    <TableCell className="text-right">{r.scheduled}</TableCell>
                    <TableCell className="text-right text-emerald-600">{r.showed_up}</TableCell>
                    <TableCell className="text-right text-amber-600">{r.no_show}</TableCell>
                    <TableCell className="text-right text-red-600">{r.lost}</TableCell>
                    <TableCell className="text-right font-semibold">{fmtBRL(r.revenue_total)}</TableCell>
                    <TableCell className="text-right">{fmtBRL(r.avg_ticket)}</TableCell>
                    <TableCell className="text-right">{fmtPct(r.conversion_rate)}</TableCell>
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

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

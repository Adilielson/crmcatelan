import { createFileRoute } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { UserCheck, FileSpreadsheet, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { getAttendanceReport } from '@/lib/bi.functions';
import { ReportFilters, defaultRange } from '@/components/reports/ReportFilters';
import { exportToExcel, exportToPDF, fmtPct } from '@/lib/report-export';

export const Route = createFileRoute('/relatorios/comparecimento')({
  component: AttendanceReportPage,
});

function AttendanceReportPage() {
  const [range, setRange] = useState(defaultRange);
  const fetchReport = useServerFn(getAttendanceReport);
  const { data, isLoading } = useQuery({
    queryKey: ['report-attendance', range],
    queryFn: () => fetchReport({ data: range }),
  });
  const period = `${range.from} a ${range.to}`;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <UserCheck className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Relatório de Comparecimento</h1>
          <p className="text-sm text-muted-foreground">Show / no-show / cancelamento / remarcação.</p>
        </div>
      </div>

      <ReportFilters
        value={range}
        onChange={setRange}
        rightSlot={
          <>
            <Button variant="outline" size="sm" onClick={() => exportToExcel(`comparecimento_${period}`, [
              { name: 'Por dia', rows: (data?.byDay ?? []).map((d) => ({ Dia: d.date, Compareceu: d.completed, NoShow: d.no_show, Cancelado: d.cancelled, Total: d.total })) },
              { name: 'Por profissional', rows: (data?.byProfessional ?? []).map((p) => ({ Profissional: p.full_name, Total: p.total, Compareceu: p.completed, NoShow: p.no_show, Cancelado: p.cancelled, 'Show %': `${(p.show_rate*100).toFixed(1)}%` })) },
            ])}>
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportToPDF(
              `comparecimento_${period}`,
              'Relatório de Comparecimento',
              `Período: ${period}`,
              [
                { title: 'Taxas gerais', head: ['Indicador', 'Valor'], body: [
                  ['Show rate', fmtPct(data?.rates.show_rate ?? 0)],
                  ['No-show rate', fmtPct(data?.rates.no_show_rate ?? 0)],
                  ['Cancelamento', fmtPct(data?.rates.cancel_rate ?? 0)],
                  ['Remarcação', fmtPct(data?.rates.reschedule_rate ?? 0)],
                ] },
                { title: 'Por profissional', head: ['Profissional', 'Total', 'Comp.', 'No-show', 'Show %'],
                  body: (data?.byProfessional ?? []).map((p) => [p.full_name, p.total, p.completed, p.no_show, fmtPct(p.show_rate)]) },
              ],
            )}>
              <FileText className="mr-2 h-4 w-4" /> PDF
            </Button>
          </>
        }
      />

      <div className="grid gap-3 md:grid-cols-4">
        <KpiCard label="Taxa de comparecimento" value={fmtPct(data?.rates.show_rate ?? 0)} tone="emerald" />
        <KpiCard label="Taxa de no-show" value={fmtPct(data?.rates.no_show_rate ?? 0)} tone="amber" />
        <KpiCard label="Cancelamento" value={fmtPct(data?.rates.cancel_rate ?? 0)} tone="red" />
        <KpiCard label="Remarcação" value={fmtPct(data?.rates.reschedule_rate ?? 0)} tone="blue" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Evolução diária</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data?.byDay ?? []}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="completed" name="Compareceu" stroke="#10b981" />
              <Line type="monotone" dataKey="no_show" name="No-show" stroke="#f59e0b" />
              <Line type="monotone" dataKey="cancelled" name="Cancelado" stroke="#ef4444" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Por profissional</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (data?.byProfessional ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados no período.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Profissional</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Compareceu</TableHead>
                  <TableHead className="text-right">No-show</TableHead>
                  <TableHead className="text-right">Cancelado</TableHead>
                  <TableHead className="text-right">Show %</TableHead>
                  <TableHead className="text-right">No-show %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.byProfessional ?? []).map((p) => (
                  <TableRow key={p.professional_id}>
                    <TableCell className="font-medium">{p.full_name}</TableCell>
                    <TableCell className="text-right">{p.total}</TableCell>
                    <TableCell className="text-right text-emerald-600">{p.completed}</TableCell>
                    <TableCell className="text-right text-amber-600">{p.no_show}</TableCell>
                    <TableCell className="text-right text-red-600">{p.cancelled}</TableCell>
                    <TableCell className="text-right">{fmtPct(p.show_rate)}</TableCell>
                    <TableCell className="text-right">{fmtPct(p.no_show_rate)}</TableCell>
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

function KpiCard({ label, value, tone }: { label: string; value: string; tone: 'emerald' | 'amber' | 'red' | 'blue' }) {
  const map = {
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
    blue: 'text-blue-600',
  };
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-bold ${map[tone]}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

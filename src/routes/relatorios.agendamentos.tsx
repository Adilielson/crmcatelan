import { createFileRoute } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { Calendar, FileSpreadsheet, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area } from 'recharts';
import { getAppointmentsReport } from '@/lib/bi.functions';
import { ReportFilters, defaultRange } from '@/components/reports/ReportFilters';
import { exportToExcel, exportToPDF, fmtBRL } from '@/lib/report-export';

export const Route = createFileRoute('/relatorios/agendamentos')({
  component: AppointmentsReportPage,
});

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function AppointmentsReportPage() {
  const [range, setRange] = useState(defaultRange);
  const fetchReport = useServerFn(getAppointmentsReport);
  const { data, isLoading } = useQuery({
    queryKey: ['report-appointments', range],
    queryFn: () => fetchReport({ data: range }),
  });

  const heatGrid = useMemo(() => {
    // Build 7 (weekday) x 24 (hour) matrix
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const c of data?.heatmap ?? []) grid[c.weekday][c.hour] = c.count;
    const max = Math.max(1, ...grid.flat());
    return { grid, max };
  }, [data]);

  const period = `${range.from} a ${range.to}`;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Calendar className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Relatório de Agendamentos</h1>
          <p className="text-sm text-muted-foreground">Volume por dia, dia da semana e hora.</p>
        </div>
      </div>

      <ReportFilters
        value={range}
        onChange={setRange}
        rightSlot={
          <>
            <Button variant="outline" size="sm" onClick={() => exportToExcel(`agendamentos_${period}`, [
              { name: 'Por dia', rows: (data?.byDay ?? []).map((d) => ({ Dia: d.date, Agendamentos: d.count })) },
              { name: 'Por tipo', rows: (data?.byType ?? []).map((t) => ({ Tipo: t.type, Qtd: t.count, Receita: t.revenue })) },
              { name: 'Por status', rows: (data?.byStatus ?? []).map((s) => ({ Status: s.status, Qtd: s.count })) },
            ])}>
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportToPDF(
              `agendamentos_${period}`,
              'Relatório de Agendamentos',
              `Período: ${period}`,
              [
                { title: 'Por status', head: ['Status', 'Qtd'], body: (data?.byStatus ?? []).map((s) => [s.status, s.count]) },
                { title: 'Por tipo', head: ['Tipo', 'Qtd', 'Receita'], body: (data?.byType ?? []).map((t) => [t.type, t.count, fmtBRL(t.revenue)]) },
              ],
            )}>
              <FileText className="mr-2 h-4 w-4" /> PDF
            </Button>
          </>
        }
      />

      <div className="grid gap-3 md:grid-cols-4">
        <KpiCard label="Total" value={String(data?.total ?? 0)} />
        <KpiCard label="Valor total" value={fmtBRL(data?.totalValue ?? 0)} />
        <KpiCard label="Criados pela IA" value={String(data?.aiCount ?? 0)} />
        <KpiCard label="Criados por humano" value={String(data?.humanCount ?? 0)} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Agendamentos por dia</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.byDay ?? []}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.25} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Por dia da semana</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(data?.byWeekday ?? []).map((w) => ({ name: WEEKDAYS[w.weekday], count: w.count }))}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Heatmap (dia × hora)</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="inline-block min-w-full">
              <div className="grid" style={{ gridTemplateColumns: `60px repeat(24, minmax(22px, 1fr))` }}>
                <div />
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="text-[10px] text-center text-muted-foreground">{h}</div>
                ))}
                {heatGrid.grid.map((row, w) => (
                  <>
                    <div key={`l-${w}`} className="text-xs text-muted-foreground pr-2 text-right">{WEEKDAYS[w]}</div>
                    {row.map((c, h) => {
                      const op = c / heatGrid.max;
                      return (
                        <div
                          key={`${w}-${h}`}
                          className="h-6 m-[1px] rounded"
                          style={{ background: `rgba(59, 130, 246, ${0.1 + op * 0.85})` }}
                          title={`${WEEKDAYS[w]} ${h}h: ${c}`}
                        />
                      );
                    })}
                  </>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Por status</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Status</TableHead><TableHead className="text-right">Qtd</TableHead></TableRow></TableHeader>
              <TableBody>
                {(data?.byStatus ?? []).map((s) => (
                  <TableRow key={s.status}><TableCell>{s.status}</TableCell><TableCell className="text-right">{s.count}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Por tipo de consulta</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">Receita</TableHead></TableRow></TableHeader>
              <TableBody>
                {(data?.byType ?? []).map((t) => (
                  <TableRow key={t.type}><TableCell>{t.type}</TableCell><TableCell className="text-right">{t.count}</TableCell><TableCell className="text-right">{fmtBRL(t.revenue)}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
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

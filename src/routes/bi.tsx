import { createFileRoute } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  DollarSign,
  TrendingUp,
  Users,
  Target,
  Brain,
  Megaphone,
  Calendar as CalendarIcon,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { getExecutiveDashboard } from '@/lib/bi.functions';

export const Route = createFileRoute('/bi')({
  component: BIDashboard,
});

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

function startOfMonthInput() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

const COLORS = ['#FFC400', '#0EA5E9', '#22C55E', '#EF4444', '#8B5CF6', '#F97316'];

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: any;
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
        <Icon className={`h-4 w-4 ${tone ?? 'text-muted-foreground'}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function BIDashboard() {
  const [from, setFrom] = useState(startOfMonthInput());
  const [to, setTo] = useState(todayInput());
  const fetchDash = useServerFn(getExecutiveDashboard);
  const { data, isLoading } = useQuery({
    queryKey: ['bi-exec', from, to],
    queryFn: () =>
      fetchDash({
        data: {
          from: new Date(`${from}T00:00:00`).toISOString(),
          to: new Date(`${to}T23:59:59`).toISOString(),
        },
      }),
  });

  const funnelData = useMemo(() => {
    const f = data?.funnel;
    if (!f) return [];
    return [
      { stage: 'Novos', value: f.open + f.in_progress },
      { stage: 'Agendados', value: f.scheduled },
      { stage: 'Compareceram', value: f.showed_up },
      { stage: 'No-show', value: f.no_show },
      { stage: 'Perdidos', value: f.lost },
    ];
  }, [data]);

  const aiPie = useMemo(() => {
    const a = data?.ai;
    if (!a) return [];
    return [
      { name: 'IA', value: a.apptAi + a.msgAi },
      { name: 'Humano', value: a.apptHuman + a.msgHuman },
    ];
  }, [data]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">BI Executivo</h1>
          <p className="text-sm text-muted-foreground">Visão consolidada do negócio.</p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" /> De
            </label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Até</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Kpi
              icon={DollarSign}
              label="Faturamento total"
              value={fmtBRL(data?.revenue.total ?? 0)}
              hint={`Consultas ${fmtBRL(data?.revenue.consultations ?? 0)} • Óculos ${fmtBRL(
                data?.revenue.glasses ?? 0,
              )}`}
              tone="text-emerald-600"
            />
            <Kpi
              icon={Users}
              label="Leads no período"
              value={String(data?.leads.total ?? 0)}
              hint={`${data?.leads.converted ?? 0} conversões`}
              tone="text-blue-600"
            />
            <Kpi
              icon={Target}
              label="Taxa de conversão"
              value={fmtPct(data?.leads.conversionRate ?? 0)}
              hint="Compareceram ÷ leads totais"
              tone="text-yellow-600"
            />
            <Kpi
              icon={TrendingUp}
              label="ROI marketing"
              value={fmtPct(data?.marketing.roi ?? 0)}
              hint={`Investido ${fmtBRL(data?.marketing.spend ?? 0)}`}
              tone="text-purple-600"
            />
          </div>

          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Faturamento diário</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={data?.revenue.series ?? []}>
                    <defs>
                      <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FFC400" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="#FFC400" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" fontSize={11} />
                    <YAxis fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: any) => fmtBRL(Number(v))} />
                    <Area type="monotone" dataKey="total" stroke="#FFC400" fill="url(#g1)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Funil de leads</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={funnelData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="stage" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#0EA5E9" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Marketing + AI */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Megaphone className="h-4 w-4" /> Top campanhas
                </CardTitle>
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <span>CPL {fmtBRL(data?.marketing.cpl ?? 0)}</span>
                  <span>•</span>
                  <span>CPA {fmtBRL(data?.marketing.cpa ?? 0)}</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 pr-4">Campanha</th>
                        <th className="py-2 pr-4 text-right">Leads</th>
                        <th className="py-2 pr-4 text-right">Conv.</th>
                        <th className="py-2 pr-4 text-right">Taxa</th>
                        <th className="py-2 pr-4 text-right">Receita</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.marketing.topCampaigns ?? []).map((c) => (
                        <tr key={c.campaign} className="border-b last:border-0">
                          <td className="py-2 pr-4 truncate max-w-[240px]">{c.campaign}</td>
                          <td className="py-2 pr-4 text-right">{c.leads}</td>
                          <td className="py-2 pr-4 text-right">{c.converted}</td>
                          <td className="py-2 pr-4 text-right">
                            {c.leads > 0 ? `${((c.converted / c.leads) * 100).toFixed(0)}%` : '—'}
                          </td>
                          <td className="py-2 pr-4 text-right font-medium">{fmtBRL(c.revenue)}</td>
                        </tr>
                      ))}
                      {(data?.marketing.topCampaigns ?? []).length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-muted-foreground">
                            Sem campanhas no período.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-4 w-4" /> IA vs Humano
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={aiPie}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={70}
                      innerRadius={40}
                      label
                    >
                      {aiPie.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-2 border-t">
                  <div>
                    Receita IA <Badge variant="secondary">{fmtBRL(data?.revenue.aiRevenue ?? 0)}</Badge>
                  </div>
                  <div>Atend. IA: {data?.ai.apptAi ?? 0}</div>
                  <div>Msgs IA: {data?.ai.msgAi ?? 0}</div>
                  <div>Msgs humanas: {data?.ai.msgHuman ?? 0}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

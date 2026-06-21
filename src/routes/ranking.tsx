import { createFileRoute } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Trophy, Medal, Award } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { getGoalProgress } from '@/lib/bi.functions';

export const Route = createFileRoute('/ranking')({
  component: RankingPage,
});

function currentMonthInput() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const podiumStyle = [
  { icon: Trophy, color: 'text-yellow-500', label: '1º' },
  { icon: Award, color: 'text-slate-400', label: '2º' },
  { icon: Medal, color: 'text-amber-700', label: '3º' },
];

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function RankingPage() {
  const [month, setMonth] = useState(currentMonthInput());
  const fetchProgress = useServerFn(getGoalProgress);
  const { data, isLoading } = useQuery({
    queryKey: ['ranking', month],
    queryFn: () => fetchProgress({ data: { month: `${month}-01` } }),
  });

  const ranking = data?.ranking ?? [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ranking de Vendedores</h1>
          <p className="text-sm text-muted-foreground">
            Performance dos atendentes no mês selecionado.
          </p>
        </div>
        <Input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="w-full sm:w-48"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : ranking.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Sem dados de vendas no período.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Podium top 3 */}
          <div className="grid gap-4 md:grid-cols-3">
            {ranking.slice(0, 3).map((r, i) => {
              const p = podiumStyle[i];
              const Icon = p.icon;
              const pct = Math.min((r.progress ?? 0) * 100, 100);
              return (
                <Card key={r.user_id} className={i === 0 ? 'ring-2 ring-yellow-300' : ''}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={r.avatar_url ?? undefined} />
                        <AvatarFallback>{initials(r.full_name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-base">{r.full_name}</CardTitle>
                        <Badge variant="outline" className="mt-1 text-xs">
                          {r.role === 'manager' ? 'Gerente' : 'Vendedor'}
                        </Badge>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1 font-bold ${p.color}`}>
                      <Icon className="h-5 w-5" />
                      {p.label}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-2xl font-bold">{fmtBRL(r.total)}</div>
                    <Progress value={pct} className="h-2" />
                    <div className="text-xs text-muted-foreground">
                      Meta: {fmtBRL(r.goal)} • {pct.toFixed(0)}%
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
                      <span>Consultas: {fmtBRL(r.consultations)}</span>
                      <span>Óculos: {fmtBRL(r.glasses)}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Full table */}
          <Card>
            <CardHeader>
              <CardTitle>Classificação completa</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-4">#</th>
                      <th className="py-2 pr-4">Vendedor</th>
                      <th className="py-2 pr-4 text-right">Consultas</th>
                      <th className="py-2 pr-4 text-right">Óculos</th>
                      <th className="py-2 pr-4 text-right">Total</th>
                      <th className="py-2 pr-4 text-right">Meta</th>
                      <th className="py-2 pr-4 text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((r, i) => {
                      const pct = (r.progress ?? 0) * 100;
                      return (
                        <tr key={r.user_id} className="border-b last:border-0">
                          <td className="py-2 pr-4 font-semibold">{i + 1}</td>
                          <td className="py-2 pr-4">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={r.avatar_url ?? undefined} />
                                <AvatarFallback className="text-xs">
                                  {initials(r.full_name)}
                                </AvatarFallback>
                              </Avatar>
                              {r.full_name}
                            </div>
                          </td>
                          <td className="py-2 pr-4 text-right">{fmtBRL(r.consultations)}</td>
                          <td className="py-2 pr-4 text-right">{fmtBRL(r.glasses)}</td>
                          <td className="py-2 pr-4 text-right font-semibold">{fmtBRL(r.total)}</td>
                          <td className="py-2 pr-4 text-right">{fmtBRL(r.goal)}</td>
                          <td
                            className={`py-2 pr-4 text-right font-medium ${
                              pct >= 100 ? 'text-emerald-600' : pct >= 70 ? 'text-amber-600' : ''
                            }`}
                          >
                            {pct.toFixed(0)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

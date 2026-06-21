import { createFileRoute } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Award, Medal, Gem, Target, Users, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { getGoalProgress } from '@/lib/bi.functions';

export const Route = createFileRoute('/metas')({
  component: MetasPage,
});

function currentMonthInput() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const tierMeta = {
  bronze: { label: 'Bronze', icon: Medal, color: 'text-amber-700', bg: 'bg-amber-50', ring: 'ring-amber-200' },
  gold: { label: 'Ouro', icon: Award, color: 'text-yellow-600', bg: 'bg-yellow-50', ring: 'ring-yellow-300' },
  diamond: { label: 'Diamante', icon: Gem, color: 'text-cyan-600', bg: 'bg-cyan-50', ring: 'ring-cyan-300' },
} as const;

function MetasPage() {
  const [month, setMonth] = useState(currentMonthInput());
  const fetchProgress = useServerFn(getGoalProgress);
  const { data, isLoading } = useQuery({
    queryKey: ['goal-progress', month],
    queryFn: () => fetchProgress({ data: { month: `${month}-01` } }),
  });

  const tiers = data?.tiers ?? { bronze: 0, gold: 0, diamond: 0 };
  const active = data?.activeTier ?? 'bronze';
  const total = data?.totalRevenue ?? 0;

  const tierCards = useMemo(
    () =>
      (['bronze', 'gold', 'diamond'] as const).map((t) => {
        const meta = tierMeta[t];
        const Icon = meta.icon;
        const value = tiers[t];
        const progress = value > 0 ? Math.min((total / value) * 100, 100) : 0;
        const isActive = active === t;
        const reached = total >= value && value > 0;
        return (
          <Card key={t} className={isActive ? `ring-2 ${meta.ring}` : ''}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Icon className={`h-5 w-5 ${meta.color}`} />
                {meta.label}
              </CardTitle>
              {isActive && <Badge variant="default">Meta ativa</Badge>}
              {reached && !isActive && <Badge variant="secondary">Atingida</Badge>}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-2xl font-bold">{fmtBRL(value)}</div>
              <Progress value={progress} className="h-2" />
              <div className="text-xs text-muted-foreground">
                {fmtBRL(total)} de {fmtBRL(value)} • {progress.toFixed(1)}%
              </div>
            </CardContent>
          </Card>
        );
      }),
    [tiers, total, active],
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Metas Mensais</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe metas Bronze, Ouro e Diamante da loja.
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
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">{tierCards}</div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" /> Vendedores ativos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{data?.activeSellersCount ?? 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Target className="h-4 w-4" /> Meta individual
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{fmtBRL(data?.individualGoal ?? 0)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Meta {tierMeta[active].label} ÷ vendedores ativos
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="h-4 w-4" /> Faturamento do mês
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{fmtBRL(total)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Consultas {fmtBRL(data?.totalConsultations ?? 0)} • Óculos{' '}
                  {fmtBRL(data?.totalGlasses ?? 0)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Progresso individual</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(data?.ranking ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">Sem vendedores ativos no período.</p>
              )}
              {(data?.ranking ?? []).map((r) => {
                const pct = Math.min((r.progress ?? 0) * 100, 100);
                return (
                  <div key={r.user_id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{r.full_name}</span>
                      <span className="text-muted-foreground">
                        {fmtBRL(r.total)} / {fmtBRL(r.goal)} • {pct.toFixed(0)}%
                      </span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

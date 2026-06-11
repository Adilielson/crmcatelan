import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription 
} from "@/components/ui/card"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  Cell,
  PieChart,
  Pie,
  AreaChart,
  Area
} from 'recharts'
import { 
  Calendar, 
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Filter,
  UserCheck,
  UserX,
  TrendingDown,
  DollarSign,
  Share2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

import { useServerFn } from '@tanstack/react-start'
import { useQuery } from '@tanstack/react-query'
import { getNoShowMetrics, getTenantUnits } from '@/lib/analytics.functions'

export const Route = createFileRoute('/analytics/no-show')({
  component: NoShowAnalytics,
})



function NoShowAnalytics() {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly')
  const [unit, setUnit] = useState<string>('all')

  const fetchMetrics = useServerFn(getNoShowMetrics)
  const fetchUnits = useServerFn(getTenantUnits)

  const { data: units = [] } = useQuery({
    queryKey: ['tenant-units'],
    queryFn: () => fetchUnits({}),
  })

  const { data: metrics } = useQuery({
    queryKey: ['noshow-metrics', period, unit],
    queryFn: () =>
      fetchMetrics({ data: { period, unitId: unit === 'all' ? null : unit } }),
  })

  const attendanceTrend = metrics?.attendanceTrend ?? []
  const sourceData = metrics?.sourceData ?? []
  const recovery = metrics?.recovery ?? []
  const noShowRate = metrics?.kpis.noShowRate ?? 0
  const attendanceRate = metrics?.kpis.attendanceRate ?? 0
  const noShowValue = metrics?.kpis.noShowValue ?? 0
  const totalAppts = metrics?.kpis.total ?? 0
  const isCritical = noShowRate > 20

  // Reasons data — placeholder até existir tabela de motivos
  const reasonsData: Array<{ name: string; value: number; color: string }> = []


  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Métricas de No-Show e Conversão</h1>
          <p className="text-muted-foreground">Analise o comparecimento de pacientes e o impacto financeiro de ausências.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">
            <Share2 className="w-4 h-4" /> Compartilhar
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" /> Exportar
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-xl border border-border">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filtros:</span>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Hoje</SelectItem>
            <SelectItem value="weekly">Esta Semana</SelectItem>
            <SelectItem value="monthly">Este Mês</SelectItem>
            <SelectItem value="yearly">Este Ano</SelectItem>
          </SelectContent>
        </Select>

        <Select value={unit} onValueChange={setUnit}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Unidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Unidades</SelectItem>
            {units.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-ink">
        <MetricCard 
          title="Taxa de Presença" 
          value={`${attendanceRate.toFixed(1)}%`} 
          trend={`${totalAppts} agend.`} 
          trendUp={attendanceRate >= 75} 
          icon={<UserCheck className="w-5 h-5 text-green-600" />} 
          description="Agendamentos que compareceram"
        />
        <MetricCard 
          title="Taxa de No-Show" 
          value={`${noShowRate.toFixed(1)}%`} 
          trend={isCritical ? 'crítico' : 'normal'} 
          trendUp={!isCritical} 
          icon={<UserX className="w-5 h-5" />} 
          description="Não comparecimentos"
          alert={isCritical}
        />
        <MetricCard 
          title="Conversão Final" 
          value={`${(metrics?.kpis ? 100 - (metrics.kpis.noShowRate + metrics.kpis.cancelRate) : 0).toFixed(1)}%`} 
          trend="presença líquida" 
          trendUp={true} 
          icon={<ArrowUpRight className="w-5 h-5" />} 
          description="Compareceram vs agendados"
        />
        <MetricCard 
          title="Perda Estimada" 
          value={noShowValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} 
          trend={`${metrics?.recovery.length ?? 0} p/ recuperar`} 
          trendUp={false} 
          icon={<DollarSign className="w-5 h-5 text-red-600" />} 
          description="Valor de no-shows no período"
        />
      </div>

      {isCritical && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex gap-3 items-start animate-in fade-in slide-in-from-top-4">
          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-900">Alerta: Taxa de No-Show Crítica</p>
            <p className="text-xs text-red-800">O limite de 20% definido nas configurações foi excedido nesta unidade. Recomenda-se revisar as mensagens de confirmação da IA SDR.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white border-border shadow-card">
          <CardHeader>
            <CardTitle>Tendência de Comparecimento</CardTitle>
            <CardDescription>Comparativo mensal entre comparecimentos e faltas.</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendanceTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="compareceu" name="Compareceu" fill="#10b981" stackId="a" />
                <Bar dataKey="noShow" name="No-Show" fill="#ef4444" stackId="a" />
                <Bar dataKey="cancelado" name="Cancelado" fill="#94a3b8" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-white border-border shadow-card">
          <CardHeader>
            <CardTitle>No-Show por Origem de Tráfego</CardTitle>
            <CardDescription>Identifique a qualidade dos leads por canal de aquisição.</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sourceData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" name="Agendamentos" fill="#6366f1" radius={[0, 4, 4, 0]} />
                <Bar dataKey="noShow" name="No-Show" fill="#ef4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 bg-white border-border shadow-card text-ink">
          <CardHeader>
            <CardTitle>Motivos de No-Show</CardTitle>
            <CardDescription>Principais justificativas registradas.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center">
            {reasonsData.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center italic px-6">
                Ainda não há motivos registrados. Os motivos serão capturados automaticamente quando o atendente registrar a causa de uma falta.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={reasonsData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {reasonsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend layout="vertical" align="right" verticalAlign="middle" />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 bg-white border-border shadow-card text-ink">
          <CardHeader>
            <CardTitle>Recuperação de No-Shows</CardTitle>
            <CardDescription>Leads que faltaram e precisam de reagendamento.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recovery.length === 0 && (
                <p className="text-xs text-muted-foreground italic text-center py-6">Nenhum no-show nos últimos 7 dias.</p>
              )}
              {recovery.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{lead.name}</p>
                    <p className="text-xs text-muted-foreground">{lead.date}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="text-[10px]">no-show</Badge>
                    <Button size="sm" variant="secondary" onClick={() => window.location.assign('/agenda')}>Reagendar</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function MetricCard({ title, value, trend, trendUp, icon, description, alert }: any) {
  return (
    <Card className={cn(alert && "border-red-200 bg-red-50/30")}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={cn("p-2 rounded-lg bg-slate-100", alert && "bg-red-100")}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold", alert && "text-red-700")}>{value}</div>
        <div className="flex items-center gap-1 mt-1">
          {trendUp ? (
            <ArrowUpRight className={cn("w-3 h-3", trendUp ? "text-green-600" : "text-red-600")} />
          ) : (
            <ArrowDownRight className={cn("w-3 h-3", trendUp ? "text-green-600" : "text-red-600")} />
          )}
          <span className={cn("text-xs font-medium", trendUp ? "text-green-600" : "text-red-600")}>
            {trend}
          </span>
          <span className="text-xs text-muted-foreground ml-1">vs mês ant.</span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-3">{description}</p>
      </CardContent>
    </Card>
  )
}

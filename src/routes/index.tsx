import React, { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription 
} from "@/components/ui/card"
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts'
import { 
  Users, 
  Calendar, 
  Target, 
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Brain,
  TrendingUp,
  Clock,
  ExternalLink,
  ChevronRight,
  DollarSign,
  Store,
  MessageSquare,
  CalendarRange,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Link } from '@tanstack/react-router'
import { useUnits } from '@/hooks/use-leads'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useServerFn } from '@tanstack/react-start'
import { useQuery } from '@tanstack/react-query'
import { getDashboardMetrics } from '@/lib/analytics.functions'

export const Route = createFileRoute('/')({
  component: Dashboard,
})

function fmtBRL(n: number) {
  if (n >= 1000) return `R$ ${(n / 1000).toFixed(1)}k`
  return `R$ ${n.toFixed(0)}`
}
function fmtDelta(n: number) {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
}

type PeriodKey = 'all' | 'today' | '7d' | '15d' | '30d' | 'custom'

const PERIOD_LABELS: Record<PeriodKey, string> = {
  all: 'Acumulado',
  today: 'Hoje',
  '7d': 'Últimos 7 dias',
  '15d': 'Últimos 15 dias',
  '30d': 'Últimos 30 dias',
  custom: 'Personalizado',
}

function computeRange(period: PeriodKey, customFrom: string, customTo: string): { from: string | null; to: string | null } {
  if (period === 'all') return { from: null, to: null }
  const now = new Date()
  const to = new Date(now); to.setHours(23, 59, 59, 999)
  const from = new Date(now); from.setHours(0, 0, 0, 0)
  if (period === 'today') return { from: from.toISOString(), to: to.toISOString() }
  if (period === '7d') from.setDate(from.getDate() - 6)
  else if (period === '15d') from.setDate(from.getDate() - 14)
  else if (period === '30d') from.setDate(from.getDate() - 29)
  else if (period === 'custom') {
    if (!customFrom || !customTo) return { from: null, to: null }
    const f = new Date(customFrom); f.setHours(0, 0, 0, 0)
    const t = new Date(customTo); t.setHours(23, 59, 59, 999)
    return { from: f.toISOString(), to: t.toISOString() }
  }
  return { from: from.toISOString(), to: to.toISOString() }
}

function Dashboard() {
  const { data: pipelines = [] } = useUnits()
  const [selectedUnit, setSelectedUnit] = useState<string>('all')
  const [period, setPeriod] = useState<PeriodKey>('all')
  const [customFrom, setCustomFrom] = useState<string>('')
  const [customTo, setCustomTo] = useState<string>('')

  const range = useMemo(() => computeRange(period, customFrom, customTo), [period, customFrom, customTo])

  const fetchMetrics = useServerFn(getDashboardMetrics)
  const { data: metrics } = useQuery({
    queryKey: ['dashboard-metrics', selectedUnit, period, range.from, range.to],
    queryFn: () => fetchMetrics({ data: {
      unitId: selectedUnit === 'all' ? null : selectedUnit,
      from: range.from,
      to: range.to,
    } }),
  })

  const funnelData = metrics?.funnelData ?? []
  const sourceData = metrics?.sourceData ?? []
  const slaAlerts = metrics?.slaAlerts ?? []
  const recentAi = metrics?.recentAi ?? []
  const kpis = metrics?.kpis
  const stats = {
    totalLeads: kpis?.totalLeads ?? 0,
    totalValue: fmtBRL(kpis?.totalValue ?? 0),
    confirmedAppts: kpis?.confirmedAppts ?? 0,
    qualRate: `${kpis?.qualRate?.toFixed(0) ?? 0}%`,
  }
  const periodDesc = period === 'all' ? 'vs 30 dias anteriores' : `${PERIOD_LABELS[period]} · vs período anterior`
  const apptDesc = period === 'all' ? 'próximos 7 dias' : PERIOD_LABELS[period]


  return (
    <div className="space-y-6 md:space-y-10 animate-in fade-in duration-1000">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-8 bg-white p-5 md:p-10 rounded-[18px] md:rounded-[24px] border border-[#E3E6EB] shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl transition-all group-hover:bg-primary/10" />
        <div className="relative z-10 min-w-0">
          <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
            <div className="w-6 md:w-10 h-1 rounded-full bg-primary shrink-0" />
            <span className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] text-primary truncate">Relatório em Tempo Real</span>
          </div>
          <h1 className="text-[26px] md:text-[44px] font-black text-ink tracking-tight font-jakarta leading-[1.05] md:leading-none mb-2 md:mb-4">
            Dashboard Executivo
          </h1>
          <p className="text-gray-500 font-medium text-[13px] md:text-[15px] max-w-xl">
            Visão consolidada da performance comercial e operacional de suas unidades com inteligência preditiva.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 relative z-10 w-full md:w-auto">
          {/* Filtro de período */}
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
            <SelectTrigger className="w-full sm:w-[200px] md:w-[220px] bg-white border-[#E3E6EB] shadow-sm font-black text-[11px] h-12 md:h-14 text-ink rounded-[14px] md:rounded-[16px] px-4 md:px-6 uppercase tracking-wider transition-all hover:border-primary/50">
              <CalendarRange className="w-4 h-4 mr-3 text-primary shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white border-[#E3E6EB] text-ink rounded-[16px]">
              <SelectItem value="all" className="font-bold">Acumulado</SelectItem>
              <SelectItem value="today" className="font-bold">Hoje</SelectItem>
              <SelectItem value="7d" className="font-bold">Últimos 7 dias</SelectItem>
              <SelectItem value="15d" className="font-bold">Últimos 15 dias</SelectItem>
              <SelectItem value="30d" className="font-bold">Últimos 30 dias</SelectItem>
              <SelectItem value="custom" className="font-bold">Personalizado</SelectItem>
            </SelectContent>
          </Select>

          {period === 'custom' && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto h-12 md:h-14 rounded-[14px] md:rounded-[16px] border-[#E3E6EB] font-black text-[11px] uppercase tracking-wider px-4 md:px-6">
                  {customFrom && customTo
                    ? `${new Date(customFrom).toLocaleDateString('pt-BR')} → ${new Date(customTo).toLocaleDateString('pt-BR')}`
                    : 'Escolher datas'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-4 space-y-3 bg-white" align="end">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-wider text-gray-500">Data inicial</Label>
                  <Input type="date" value={customFrom} max={customTo || undefined} onChange={(e) => setCustomFrom(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-wider text-gray-500">Data final</Label>
                  <Input type="date" value={customTo} min={customFrom || undefined} onChange={(e) => setCustomTo(e.target.value)} />
                </div>
              </PopoverContent>
            </Popover>
          )}

          {pipelines.length > 1 && (
            <Select value={selectedUnit} onValueChange={setSelectedUnit}>
              <SelectTrigger className="w-full sm:w-[220px] md:w-[240px] bg-white border-[#E3E6EB] shadow-sm font-black text-[11px] h-12 md:h-14 text-ink rounded-[14px] md:rounded-[16px] px-4 md:px-6 uppercase tracking-wider transition-all hover:border-primary/50">
                <Store className="w-4 h-4 mr-3 text-primary shrink-0" />
                <SelectValue placeholder="Todas as Unidades" />
              </SelectTrigger>
              <SelectContent className="bg-white border-[#E3E6EB] text-ink rounded-[16px]">
                <SelectItem value="all" className="font-bold">Todas as Unidades</SelectItem>
                {pipelines.map(p => (
                  <SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
        <StatCard
          title="Total de Leads"
          value={stats.totalLeads.toString()}
          change={fmtDelta(kpis?.leadsDelta ?? 0)}
          changeDesc={periodDesc}
          icon={<Users className="w-5 h-5" />}
          link="/kanban"
        />
        <StatCard
          title="Valor em Pipeline"
          value={stats.totalValue}
          change={fmtDelta(kpis?.valueDelta ?? 0)}
          changeDesc={periodDesc}
          icon={<DollarSign className="w-5 h-5" />}
          link="/kanban"
        />
        <StatCard
          title="Consultas Agendadas"
          value={stats.confirmedAppts.toString()}
          change={`${stats.confirmedAppts}`}
          changeDesc={apptDesc}
          icon={<Calendar className="w-5 h-5" />}
          link="/agenda"
        />
        <StatCard
          title="Qualificação IA"
          value={stats.qualRate}
          change={`${kpis?.qualRate?.toFixed(0) ?? 0}%`}
          changeDesc="leads com score ≥ 70"
          icon={<Brain className="w-5 h-5" />}
          highlight
          link="/performance"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Funil de Vendas */}
        <Card className="lg:col-span-2 shadow-card border-border bg-card rounded-[14px] overflow-hidden">
          <CardHeader className="pb-4 border-b border-border/50 bg-gray-50/50">
            <CardTitle className="text-sm font-black flex items-center gap-3 uppercase tracking-[0.15em] text-gray-400 font-jakarta">
              <div className="p-1.5 bg-primary/10 rounded-lg">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              Performance do Funil (CRM)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[260px] sm:h-[300px] md:h-[320px] p-3 md:p-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" fontSize={11} fontWeight="bold" axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: '#f8fafc'}} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={32}>
                  {funnelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Origem dos Leads */}
        <Card className="shadow-card border-border bg-card rounded-[14px] overflow-hidden">
          <CardHeader className="pb-4 border-b border-border/50 bg-gray-50/50">
            <CardTitle className="text-sm font-black flex items-center gap-3 uppercase tracking-[0.15em] text-gray-400 font-jakarta">
              <div className="p-1.5 bg-primary/10 rounded-lg">
                <Target className="w-4 h-4 text-primary" />
              </div>
              Origem dos Leads
            </CardTitle>
          </CardHeader>
          <CardContent className="h-auto sm:h-[280px] flex flex-col items-center p-3 md:p-6">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={sourceData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {sourceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-1 gap-2 mt-4 w-full">
               {sourceData.map((item) => (
                 <div key={item.name} className="flex items-center justify-between">
                   <div className="flex items-center gap-2">
                     <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                     <span className="text-[11px] font-bold text-slate-600">{item.name}</span>
                   </div>
                   <span className="text-[11px] font-bold text-slate-900">{item.value}%</span>
                 </div>
               ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Atividade da IA SDR */}
        <Card className="shadow-card border-border bg-card rounded-[14px] overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-4 border-b border-border/50 bg-gray-50/50">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-primary/10 rounded-xl shrink-0">
                <Brain className="w-5 h-5 text-primary" />
              </div>
              <CardTitle className="text-[11px] sm:text-sm font-black uppercase tracking-widest text-gray-400 truncate">Atividade IA SDR</CardTitle>
            </div>
            <Link to="/performance" className="shrink-0">
              <Button variant="ghost" size="sm" className="text-xs h-8 px-2 sm:px-3"><span className="hidden sm:inline">Ver métricas de IA</span><span className="sm:hidden">Ver</span></Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentAi.length === 0 && (
                <p className="text-xs text-gray-400 italic p-4 text-center">Sem atividade da IA ainda.</p>
              )}
              {recentAi.map((lead, i) => (
                <div key={i} className="flex items-center justify-between gap-3 p-3 md:p-4 border border-border rounded-[14px] bg-background/50 hover:border-primary/30 transition-all cursor-pointer group/item">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Badge className={cn(
                      "text-[10px] uppercase font-bold shrink-0",
                      (lead.score_ia ?? 0) >= 70 ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                    )}>
                      {(lead.score_ia ?? 0) >= 70 ? 'qualificado' : 'em análise'}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-ink font-jakarta truncate">{lead.full_name}</p>
                      <p className="text-[10px] text-[#6C727C] truncate">{lead.ia_summary ?? '—'}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-bold border-slate-200 shrink-0">
                    {lead.score_ia ?? 0}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>

        </Card>

        {/* Alertas de SLA e Estagnação */}
        <Card className="shadow-card border-border bg-card rounded-[14px] overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-4 border-b border-border/50 bg-gray-50/50">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-danger/10 rounded-xl shrink-0">
                <AlertTriangle className="w-5 h-5 text-danger" />
              </div>
              <CardTitle className="text-[11px] sm:text-sm font-black uppercase tracking-widest text-gray-400 truncate">Alertas SLA</CardTitle>
            </div>
            <Link to="/chat" search={{ stage: 'open' }} className="shrink-0">
              <Button size="sm" className="h-8 text-[11px] font-black uppercase tracking-wider px-2 sm:px-3"><span className="hidden sm:inline">Atender Leads</span><span className="sm:hidden">Atender</span></Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {slaAlerts.length === 0 && (
                <p className="text-xs text-gray-400 italic p-4 text-center">Nenhum lead estagnado. ✓</p>
              )}
              {slaAlerts.map((alert, i) => (
                <div key={i} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 md:p-4 border border-danger/20 rounded-[14px] bg-danger/5 hover:bg-danger/10 transition-all">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 shrink-0 rounded-full bg-red-100 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-red-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="text-sm font-black text-ink font-jakarta truncate min-w-0">{alert.name}</p>
                        <Badge className="bg-danger/20 text-danger text-[9px] border-none font-black shrink-0">{alert.priority}</Badge>
                      </div>
                      <p className="text-[10px] text-[#6C727C] truncate">Parado em {alert.stage} há {alert.waitHours}h</p>
                      {alert.firstContactAt && (
                        <p className="text-[9px] text-gray-400 font-medium truncate">1º contato: {new Date(alert.firstContactAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                      )}
                    </div>
                  </div>
                  <Link to="/chat" search={alert.phone ? { phone: alert.phone } : undefined} className="shrink-0 self-stretch sm:self-auto">
                    <Button size="sm" className="h-8 w-full sm:w-auto text-[10px] font-bold">Assumir Chat</Button>
                  </Link>

                </div>
              ))}
            </div>
          </CardContent>

        </Card>
      </div>
    </div>
  )
}

function StatCard({ title, value, change, changeDesc, icon, highlight, link }: { title: string; value: string; change: string; changeDesc: string; icon: React.ReactNode; highlight?: boolean; link: string }) {
  return (
    <Link to={link} className="block group h-full">
      <Card className={cn(
        "h-full transition-all duration-500 cursor-pointer border-[#E3E6EB] shadow-[0_4px_20px_rgba(0,0,0,0.02)] group-hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] group-hover:-translate-y-2 group-active:scale-[0.98] overflow-hidden relative rounded-[18px] md:rounded-[24px]",
        highlight
          ? "bg-gradient-to-br from-[#FFC400] via-[#FFD60A] to-[#E0A500] border-none" 
          : "bg-white"
      )}>
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: cn("w-16 h-16 md:w-20 md:h-20", highlight ? "text-[#1a1500]" : "text-ink") })}
        </div>
        
        {highlight && (
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/20 rounded-full blur-2xl" />
        )}

        <CardContent className="p-4 md:p-8 relative z-10">
          <div className="flex items-center justify-between mb-3 md:mb-6 gap-2">
            <p className={cn(
              "text-[9px] md:text-[10px] font-black uppercase tracking-[0.15em] md:tracking-[0.2em] font-jakarta min-w-0 truncate",
              highlight ? "text-[#5a4900]/60" : "text-gray-400"
            )}>{title}</p>
            <div className={cn(
              "p-2 md:p-3 rounded-[12px] md:rounded-[16px] transition-all duration-500 shrink-0",
              highlight 
                ? "bg-white/20 text-[#1a1500] backdrop-blur-md" 
                : "bg-gray-50 text-ink border border-[#E3E6EB] group-hover:bg-[#FFC400] group-hover:text-[#1a1500] group-hover:border-[#FFC400] group-hover:scale-110"
            )}>
              {icon}
            </div>
          </div>
          
          <div className="space-y-1">
            <h3 className={cn(
              "text-[30px] md:text-[48px] font-black tracking-tight font-jakarta leading-none",
              highlight ? "text-[#1a1500]" : "text-ink"
            )}>{value}</h3>
            
            <div className="flex items-center gap-2 mt-2 md:mt-4 flex-wrap">
              <div className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-black",
                highlight 
                  ? "bg-[#1a1500]/10 text-[#1a1500]" 
                  : "bg-success-soft text-success"
              )}>
                {change}
              </div>
              <p className={cn(
                "text-[10px] md:text-[11px] font-bold",
                highlight ? "text-[#5a4900]/70" : "text-gray-400"
              )}>{changeDesc}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

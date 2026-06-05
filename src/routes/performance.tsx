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
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs"
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
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts'
import { 
  TrendingUp, 
  Users, 
  Calendar, 
  Clock, 
  Target, 
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Filter
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export const Route = createFileRoute('/performance' as any)({
  component: PerformanceDashboard,
})

const funnelData = [
  { name: 'Leads Totais', value: 450, fill: '#8884d8' },
  { name: 'Qualificados IA', value: 320, fill: '#83a6ed' },
  { name: 'Agendados', value: 180, fill: '#8dd1e1' },
  { name: 'Compareceram', value: 145, fill: '#82ca9d' },
]

const performanceData = [
  { name: 'Seg', leads: 40, scheduled: 24, conversion: 60 },
  { name: 'Ter', leads: 30, scheduled: 13, conversion: 43 },
  { name: 'Qua', leads: 20, scheduled: 98, conversion: 49 },
  { name: 'Qui', leads: 27, scheduled: 39, conversion: 44 },
  { name: 'Sex', leads: 18, scheduled: 48, conversion: 46 },
  { name: 'Sáb', leads: 23, scheduled: 38, conversion: 41 },
  { name: 'Dom', leads: 34, scheduled: 43, conversion: 42 },
]

const sellerRanking = [
  { id: 1, name: 'Ana Silva', unit: 'Unidade Sul', conversion: 42.5, appointments: 45, sla: '2m', status: 'Benchmark' },
  { id: 2, name: 'Carlos Santos', unit: 'Unidade Norte', conversion: 38.2, appointments: 38, sla: '5m', status: 'Normal' },
  { id: 3, name: 'Beatriz Oliveira', unit: 'Unidade Sul', conversion: 15.4, appointments: 12, sla: '18m', status: 'Atenção' },
  { id: 4, name: 'Ricardo Melo', unit: 'Unidade Centro', conversion: 31.0, appointments: 29, sla: '4m', status: 'Normal' },
]

function PerformanceDashboard() {
  const [period, setPeriod] = useState('monthly')
  const [unit, setUnit] = useState('all')

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Relatórios de Performance</h1>
          <p className="text-muted-foreground">Monitore KPIs de vendas, atendimento e conversão da IA.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" /> Exportar PDF
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" /> Exportar CSV
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-xl border">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filtros:</span>
        </div>
        <Select value={period} onValueChange={setPeriod}>
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
            <SelectItem value="sul">Unidade Sul</SelectItem>
            <SelectItem value="norte">Unidade Norte</SelectItem>
            <SelectItem value="centro">Unidade Centro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          title="Taxa de Conversão" 
          value="32.2%" 
          trend="+4.1%" 
          trendUp={true} 
          icon={<Target className="w-5 h-5" />} 
          description="Leads → Agendados"
        />
        <MetricCard 
          title="Tempo Médio Resposta (SLA)" 
          value="4m 12s" 
          trend="-15%" 
          trendUp={true} 
          icon={<Clock className="w-5 h-5" />} 
          description="IA / Atendimento Humano"
        />
        <MetricCard 
          title="Custo por Agendamento" 
          value="R$ 42,50" 
          trend="+R$ 2,10" 
          trendUp={false} 
          icon={<TrendingUp className="w-5 h-5" />} 
          description="Investimento Ads / Agendamentos"
        />
        <MetricCard 
          title="Taxa de No-Show" 
          value="22%" 
          trend="+5%" 
          trendUp={false} 
          icon={<AlertTriangle className="w-5 h-5" />} 
          description="Não comparecimento"
          alert={true}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Funnel Chart */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Funil de Vendas (IA SDR)</CardTitle>
            <CardDescription>Fluxo desde a captura até o comparecimento.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={funnelData}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={100} fontSize={12} />
                <Tooltip />
                <Bar dataKey="value" fill="#8884d8" radius={[0, 4, 4, 0]} label={{ position: 'right' }} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Volume Over Time */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Volume de Leads vs Agendamentos</CardTitle>
            <CardDescription>Performance diária no período selecionado.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performanceData}>
                <defs>
                  <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8884d8" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <Tooltip />
                <Area type="monotone" dataKey="leads" stroke="#8884d8" fillOpacity={1} fill="url(#colorLeads)" />
                <Area type="monotone" dataKey="scheduled" stroke="#82ca9d" fillOpacity={0} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Seller Ranking */}
        <Card>
          <CardHeader>
            <CardTitle>Ranking de Vendedores</CardTitle>
            <CardDescription>Performance individual por taxa de conversão.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {sellerRanking.map((seller) => (
                <div key={seller.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-sm">
                      {seller.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{seller.name}</p>
                      <p className="text-xs text-muted-foreground">{seller.unit}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-bold text-sm">{seller.conversion}%</p>
                      <p className="text-[10px] text-muted-foreground">Conversão</p>
                    </div>
                    <Badge variant={seller.status === 'Benchmark' ? 'default' : seller.status === 'Atenção' ? 'destructive' : 'secondary'}>
                      {seller.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* IA Insights & Disqualifications */}
        <Card>
          <CardHeader>
            <CardTitle>Insights da IA SDR</CardTitle>
            <CardDescription>Principais motivos de desqualificação e perda.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <p className="text-sm font-medium mb-3">Motivos de Desqualificação</p>
                <div className="space-y-2">
                  <ReasonProgress label="Fora da Região Atendida" value={45} color="bg-blue-500" />
                  <ReasonProgress label="Sem Orçamento (Ticket Médio)" value={30} color="bg-indigo-500" />
                  <ReasonProgress label="Curiosidade / Sem intenção imediata" value={15} color="bg-slate-400" />
                  <ReasonProgress label="Outros" value={10} color="bg-slate-200" />
                </div>
              </div>
              
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex gap-2 items-start">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-amber-900">Prioridade de Recuperação</p>
                    <p className="text-xs text-amber-800">12 leads qualificados como "Alta Intenção" não converteram em agendamento nas últimas 48h.</p>
                    <Button variant="link" className="h-auto p-0 text-xs text-amber-900 font-bold mt-2">Visualizar lista →</Button>
                  </div>
                </div>
              </div>
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
        <div className={cn("p-2 rounded-lg bg-slate-100", alert && "bg-red-100 text-red-600")}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className="flex items-center gap-1 mt-1">
          {trendUp ? (
            <ArrowUpRight className={cn("w-3 h-3", alert ? "text-red-600" : "text-green-600")} />
          ) : (
            <ArrowDownRight className={cn("w-3 h-3", alert ? "text-red-600" : "text-red-600")} />
          )}
          <span className={cn("text-xs font-medium", trendUp ? (alert ? "text-red-600" : "text-green-600") : "text-red-600")}>
            {trend}
          </span>
          <span className="text-xs text-muted-foreground ml-1">vs mês ant.</span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-3">{description}</p>
      </CardContent>
    </Card>
  )
}

function ReasonProgress({ label, value, color }: { label: string, value: number, color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px]">
        <span>{label}</span>
        <span className="font-bold">{value}%</span>
      </div>
      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
        <div className={cn("h-full", color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

import { cn } from '@/lib/utils'

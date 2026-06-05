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

export const Route = createFileRoute('/analytics/no-show' as any)({
  component: NoShowAnalytics,
})

const attendanceTrend = [
  { name: 'Jan', compareceu: 120, noShow: 30, cancelado: 10 },
  { name: 'Fev', compareceu: 132, noShow: 25, cancelado: 15 },
  { name: 'Mar', compareceu: 101, noShow: 45, cancelado: 12 },
  { name: 'Abr', compareceu: 154, noShow: 20, cancelado: 8 },
  { name: 'Mai', compareceu: 140, noShow: 35, cancelado: 20 },
  { name: 'Jun', compareceu: 165, noShow: 28, cancelado: 10 },
]

const sourceData = [
  { name: 'Facebook Ads', value: 45, noShow: 12 },
  { name: 'Google Ads', value: 38, noShow: 5 },
  { name: 'Instagram Org', value: 25, noShow: 2 },
  { name: 'Indicação', value: 15, noShow: 1 },
]

const reasonsData = [
  { name: 'Esquecimento', value: 40, color: '#f59e0b' },
  { name: 'Imprevisto Trabalho', value: 25, color: '#6366f1' },
  { name: 'Problema Financeiro', value: 20, color: '#ef4444' },
  { name: 'Distância/Trânsito', value: 15, color: '#94a3b8' },
]

function NoShowAnalytics() {
  const [period, setPeriod] = useState('monthly')
  const [unit, setUnit] = useState('all')

  const noShowRate = 22.5
  const isCritical = noShowRate > 20

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
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          title="Taxa de Presença" 
          value="77.5%" 
          trend="+2.4%" 
          trendUp={true} 
          icon={<UserCheck className="w-5 h-5 text-green-600" />} 
          description="Agendamentos que compareceram"
        />
        <MetricCard 
          title="Taxa de No-Show" 
          value={`${noShowRate}%`} 
          trend="+5.1%" 
          trendUp={false} 
          icon={<UserX className="w-5 h-5" />} 
          description="Não comparecimentos"
          alert={isCritical}
        />
        <MetricCard 
          title="Conversão de Vendas" 
          value="18.2%" 
          trend="-1.5%" 
          trendUp={false} 
          icon={<ArrowUpRight className="w-5 h-5" />} 
          description="Leads → Vendas Finalizadas"
        />
        <MetricCard 
          title="Perda Estimada" 
          value="R$ 12.450" 
          trend="+R$ 3.200" 
          trendUp={false} 
          icon={<DollarSign className="w-5 h-5 text-red-600" />} 
          description="Ticket médio de No-Shows"
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
        <Card>
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

        <Card>
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
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Motivos de No-Show</CardTitle>
            <CardDescription>Principais justificativas registradas.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={reasonsData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {reasonsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend layout="vertical" align="right" verticalAlign="middle" />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recuperação de No-Shows</CardTitle>
            <CardDescription>Leads que faltaram e precisam de reagendamento.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: 'Ricardo Santos', date: 'Hoje às 10:00', source: 'Google Ads', reason: 'Esquecimento' },
                { name: 'Julia Paiva', date: 'Ontem às 15:30', source: 'Facebook Ads', reason: 'Trabalho' },
                { name: 'Marcos Lima', date: '04/06 às 09:00', source: 'Indicação', reason: 'Financeiro' },
              ].map((lead, i) => (
                <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{lead.name}</p>
                    <p className="text-xs text-muted-foreground">{lead.date} • {lead.source}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="text-[10px]">{lead.reason}</Badge>
                    <Button size="sm" variant="secondary">Reagendar</Button>
                  </div>
                </div>
              ))}
              <Button variant="link" className="w-full text-xs">Ver todos os 28 faltantes →</Button>
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

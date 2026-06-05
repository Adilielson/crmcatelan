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
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell
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
  ChevronRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Dashboard,
})

const trendData = [
  { name: 'Seg', leads: 45, agendamentos: 28 },
  { name: 'Ter', leads: 52, agendamentos: 32 },
  { name: 'Qua', leads: 38, agendamentos: 24 },
  { name: 'Qui', leads: 65, agendamentos: 42 },
  { name: 'Sex', leads: 48, agendamentos: 31 },
  { name: 'Sáb', leads: 30, agendamentos: 18 },
  { name: 'Dom', leads: 22, agendamentos: 12 },
]

const statusData = [
  { name: 'Compareceu', value: 72, color: '#10b981' },
  { name: 'No-Show', value: 18, color: '#ef4444' },
  { name: 'Cancelado', value: 10, color: '#94a3b8' },
]

function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Resumo Executivo</h1>
          <p className="text-muted-foreground">Visão geral de performance, IA e conversão da rede.</p>
        </div>
        <div className="flex items-center gap-2">
           <Badge variant="outline" className="px-3 py-1 bg-blue-50 text-blue-700 border-blue-200">
             <div className="w-2 h-2 rounded-full bg-blue-500 mr-2 animate-pulse" />
             IA Operando Normal
           </Badge>
           <Button variant="outline" size="sm">Últimos 30 dias</Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link to="/kanban">
          <StatCard 
            title="Total de Leads" 
            value="348" 
            change="+12% que ontem" 
            icon={<Users className="w-4 h-4" />}
          />
        </Link>
        <Link to="/performance">
          <StatCard 
            title="Taxa de Conversão" 
            value="32.5%" 
            change="+4% este mês" 
            icon={<Target className="w-4 h-4" />}
            color="text-blue-600"
          />
        </Link>
        <Link to="/analytics/no-show">
          <StatCard 
            title="No-Show" 
            value="18.4%" 
            change="-2% vs média" 
            icon={<AlertTriangle className="w-4 h-4" />}
            color="text-red-600"
            alert={true}
          />
        </Link>
        <Link to="/performance">
          <StatCard 
            title="CPA Médio" 
            value="R$ 42,10" 
            change="R$ 3,20 abaixo da meta" 
            icon={<TrendingUp className="w-4 h-4" />}
            color="text-green-600"
          />
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Fluxo de Captação e Agendamento</CardTitle>
              <CardDescription>Volume diário de novos leads vs. agendamentos finalizados pela IA.</CardDescription>
            </div>
            <Link to="/performance">
              <Button variant="ghost" size="sm" className="gap-2">
                Ver Detalhes <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8884d8" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="leads" name="Novos Leads" stroke="#8884d8" fillOpacity={1} fill="url(#colorLeads)" />
                <Area type="monotone" dataKey="agendamentos" name="Agendamentos" stroke="#10b981" fillOpacity={0} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status Pie */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Status de Comparecimento</CardTitle>
            <CardDescription>Performance de presença nos últimos 30 dias.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={statusData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-3 gap-4 mt-4 w-full">
               {statusData.map((item) => (
                 <div key={item.name} className="text-center">
                   <p className="text-[10px] text-muted-foreground uppercase">{item.name}</p>
                   <p className="font-bold text-sm" style={{ color: item.color }}>{item.value}%</p>
                 </div>
               ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* IA Training Quick Access */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Brain className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <CardTitle>Status de Treinamento IA</CardTitle>
              <CardDescription>Qualidade de resposta e qualificação de leads.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Última atualização:</span>
              <span className="font-medium">Hoje, 14:20</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Taxa de Qualificação:</span>
              <span className="font-medium text-green-600">72%</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">SLA Médio (Resposta):</span>
              <span className="font-medium">4m 12s</span>
            </div>
            <Link to="/ai-training" className="block">
              <Button variant="outline" className="w-full gap-2">
                Ajustar Comportamento <ExternalLink className="w-4 h-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Critical Tasks */}
        <Card>
          <CardHeader>
            <CardTitle>Prioridades de Conversão</CardTitle>
            <CardDescription>Leads qualificados que ainda não agendaram.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { name: 'Ana Souza', score: 95, time: '2h atrás', unit: 'Sul' },
                { name: 'Roberto Lima', score: 88, time: '5h atrás', unit: 'Norte' },
                { name: 'Carla Pereira', score: 82, time: '8h atrás', unit: 'Sul' },
              ].map((task, i) => (
                <div key={i} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">{task.score}</Badge>
                    <div>
                      <p className="text-sm font-medium">{task.name}</p>
                      <p className="text-[10px] text-muted-foreground">Qualificado há {task.time} • Unidade {task.unit}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="secondary">Agendar</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({ title, value, change, icon, color, alert }: { title: string; value: string; change: string; icon: React.ReactNode; color?: string; alert?: boolean }) {
  return (
    <Card className={cn("hover:shadow-md transition-shadow cursor-pointer", alert && "border-red-100")}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="p-2 bg-slate-50 rounded-lg text-slate-500">
            {icon}
          </div>
        </div>
        <div className="space-y-1">
          <h3 className={cn("text-2xl font-bold", color)}>{value}</h3>
          <p className="text-xs text-muted-foreground">{change}</p>
        </div>
      </CardContent>
    </Card>
  )
}

import React, { useState, useMemo } from 'react'
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
  Settings
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Link } from '@tanstack/react-router'
import { useKanban } from '@/hooks/use-kanban'
import { useAgenda } from '@/hooks/use-agenda'
import { useChatStore } from '@/hooks/use-chat'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'

export const Route = createFileRoute('/')({
  component: Dashboard,
})

const funnelData = [
  { name: 'Leads Prontos', value: 120, color: '#94a3b8' },
  { name: 'Em Atendimento', value: 85, color: '#6366f1' },
  { name: 'Agendado', value: 42, color: '#10b981' },
  { name: 'Perdido', value: 15, color: '#ef4444' },
]

const sourceData = [
  { name: 'WhatsApp', value: 65, color: '#22c55e' },
  { name: 'Instagram', value: 25, color: '#ec4899' },
  { name: 'Google', value: 10, color: '#3b82f6' },
]

function Dashboard() {
  const { leads, pipelines } = useKanban()
  const { appointments } = useAgenda()
  const { sessions } = useChatStore()
  const [selectedUnit, setSelectedUnit] = useState('all')

  const stats = useMemo(() => {
    const totalLeads = leads.length
    const totalValue = leads.reduce((acc, lead) => acc + lead.value, 0)
    const confirmedAppts = appointments.filter(a => a.status === 'confirmado').length
    const qualRate = leads.filter(l => l.ia_status === 'qualificado').length / (leads.length || 1) * 100
    
    return {
      totalLeads,
      totalValue: `R$ ${(totalValue / 1000).toFixed(1)}k`,
      confirmedAppts,
      qualRate: `${qualRate.toFixed(0)}%`
    }
  }, [leads, appointments])

  return (
    <div className="space-y-8 animate-in fade-in duration-700 bg-[#0E0E11]">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight font-jakarta">
            Painel de Gestão
          </h1>
          <p className="text-[#6C727C] font-medium mt-1">
            Monitoramento em tempo real da unidade e performance IA.
          </p>
        </div>
        <div className="flex items-center gap-3">
           <Select value={selectedUnit} onValueChange={setSelectedUnit}>
             <SelectTrigger className="w-[200px] bg-[#17171B] border-[#23232B] shadow-sm font-semibold text-xs h-10 text-white rounded-[14px]">
               <Store className="w-3.5 h-3.5 mr-2 text-[#FFC400]" />
               <SelectValue placeholder="Todas as Unidades" />
             </SelectTrigger>
             <SelectContent className="bg-[#17171B] border-[#23232B] text-white">
               <SelectItem value="all">Todas as Unidades</SelectItem>
               {pipelines.map(p => (
                 <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
               ))}
             </SelectContent>
           </Select>
           <Button variant="outline" className="bg-[#FFC400] hover:bg-[#FFD60A] text-[#1a1500] border-none shadow-sm font-bold text-xs h-10 px-6 rounded-[14px]">
             Relatório Completo
           </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total de Leads" 
          value={stats.totalLeads.toString()} 
          change="+12% vs semana anterior" 
          icon={<Users className="w-4 h-4" />}
          link="/kanban"
        />
        <StatCard 
          title="Valor em Pipeline" 
          value={stats.totalValue} 
          change="Leads ativos no funil" 
          icon={<DollarSign className="w-4 h-4" />}
          color="text-blue-600"
          link="/kanban"
        />
        <StatCard 
          title="Consultas Confirmadas" 
          value={stats.confirmedAppts.toString()} 
          change="Próximos 7 dias" 
          icon={<Calendar className="w-4 h-4" />}
          color="text-green-600"
          link="/agenda"
        />
        <StatCard 
          title="Qualificação IA" 
          value={stats.qualRate} 
          change="Performance SDR" 
          icon={<Brain className="w-4 h-4" />}
          color="text-purple-600"
          link="/performance"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Funil de Vendas */}
        <Card className="lg:col-span-2 shadow-sm border-none bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest text-slate-500">
              <TrendingUp className="w-4 h-4" /> Funil de Conversão (Kanban)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
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
        <Card className="shadow-sm border-none bg-white">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-500">Origem dos Leads</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px] flex flex-col items-center">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Atividade da IA SDR */}
        <Card className="shadow-sm border-none bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Brain className="w-5 h-5 text-purple-600" />
              </div>
              <CardTitle className="text-sm font-bold">Atividade Recente IA SDR</CardTitle>
            </div>
            <Link to="/performance">
              <Button variant="ghost" size="sm" className="text-xs h-8">Ver métricas de IA</Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {leads.filter(l => l.ia_status).slice(0, 3).map((lead, i) => (
                <div key={i} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <Badge className={cn(
                      "text-[10px] uppercase font-bold",
                      lead.ia_status === 'qualificado' ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                    )}>
                      {lead.ia_status}
                    </Badge>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{lead.name}</p>
                      <p className="text-[10px] text-slate-500 truncate max-w-[200px]">{lead.ia_resumo}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-bold border-slate-200">
                    {lead.ia_score}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Alertas de SLA e Estagnação */}
        <Card className="shadow-sm border-none bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <CardTitle className="text-sm font-bold">Leads em Alerta (SLA)</CardTitle>
            </div>
            <Link to="/settings">
              <Button variant="ghost" size="icon" className="h-8 w-8"><Settings className="w-4 h-4 text-slate-400" /></Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { name: 'Roberto Lima', stage: 'Leads Prontos', wait: '5h', priority: 'VIP' },
                { name: 'Ana Souza', stage: 'Em Atendimento', wait: '26h', priority: 'Alta' },
              ].map((alert, i) => (
                <div key={i} className="flex items-center justify-between p-3 border border-red-50 rounded-xl bg-red-50/30">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{alert.name} <Badge className="ml-2 bg-red-100 text-red-700 text-[9px] border-none">{alert.priority}</Badge></p>
                      <p className="text-[10px] text-slate-500">Parado em {alert.stage} há {alert.wait}</p>
                    </div>
                  </div>
                  <Link to="/chat">
                    <Button size="sm" className="h-7 text-[10px] font-bold">Assumir Chat</Button>
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

function StatCard({ title, value, change, icon, color, link }: { title: string; value: string; change: string; icon: React.ReactNode; color?: string; link: string }) {
  return (
    <Link to={link}>
      <Card className="hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer border-[#23232B] shadow-sm bg-[#17171B] group overflow-hidden relative rounded-[14px]">
        <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
          {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "w-16 h-16 text-white" })}
        </div>
        <CardContent className="p-6 relative z-10">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{title}</p>
            <div className={cn(
              "p-2 rounded-xl transition-colors",
              "bg-[#0E0E11] text-[#FFC400] border border-[#23232B] group-hover:bg-[#FFC400] group-hover:text-[#1a1500]"
            )}>
              {icon}
            </div>
          </div>
          <div className="space-y-1">
            <h3 className={cn("text-3xl font-black text-white tracking-tight font-jakarta")}>{value}</h3>
            <div className="flex items-center gap-1.5">
              <div className="h-1 w-1 rounded-full bg-[#FFC400]" />
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{change}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

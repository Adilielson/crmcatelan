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
    <div className="space-y-8 animate-in fade-in duration-700 bg-background min-h-screen">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-card p-8 rounded-[14px] border border-border shadow-sm">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight font-jakarta mb-2">
            Dashboard Executivo
          </h1>
          <p className="text-gray-500 font-medium">
            Métricas estratégicas e performance da unidade em tempo real.
          </p>
        </div>
        <div className="flex items-center gap-3">
           <Select value={selectedUnit} onValueChange={setSelectedUnit}>
             <SelectTrigger className="w-[220px] bg-background border-border shadow-sm font-semibold text-xs h-12 text-white rounded-[14px] px-4">
               <Store className="w-4 h-4 mr-2 text-primary" />
               <SelectValue placeholder="Todas as Unidades" />
             </SelectTrigger>
             <SelectContent className="bg-card border-border text-white">
               <SelectItem value="all">Todas as Unidades</SelectItem>
               {pipelines.map(p => (
                 <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
               ))}
             </SelectContent>
           </Select>
           <Button className="bg-primary hover:bg-yellow-bright text-primary-foreground shadow-lg shadow-primary/20 font-black text-xs h-12 px-8 rounded-[14px] transition-all hover:scale-[1.02] active:scale-95">
             GERAR RELATÓRIO
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
          link="/kanban"
        />
        <StatCard 
          title="Consultas Confirmadas" 
          value={stats.confirmedAppts.toString()} 
          change="Próximos 7 dias" 
          icon={<Calendar className="w-4 h-4" />}
          link="/agenda"
        />
        <StatCard 
          title="Qualificação IA" 
          value={stats.qualRate} 
          change="Performance SDR" 
          icon={<Brain className="w-4 h-4" />}
          highlight
          link="/performance"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Funil de Vendas */}
        <Card className="lg:col-span-2 shadow-xl border-border bg-card rounded-[14px] overflow-hidden">
          <CardHeader className="pb-4 border-b border-border/50 bg-black/20">
            <CardTitle className="text-sm font-black flex items-center gap-3 uppercase tracking-[0.15em] text-gray-400 font-jakarta">
              <div className="p-1.5 bg-primary/10 rounded-lg">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              Performance do Funil (CRM)
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
        <Card className="shadow-xl border-border bg-card rounded-[14px] overflow-hidden">
          <CardHeader className="pb-4 border-b border-border/50 bg-black/20">
            <CardTitle className="text-sm font-black flex items-center gap-3 uppercase tracking-[0.15em] text-gray-400 font-jakarta">
              <div className="p-1.5 bg-primary/10 rounded-lg">
                <Target className="w-4 h-4 text-primary" />
              </div>
              Origem dos Leads
            </CardTitle>
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
        <Card className="shadow-xl border-border bg-card rounded-[14px] overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/50 bg-black/20">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                <Brain className="w-5 h-5 text-primary" />
              </div>
              <CardTitle className="text-sm font-black uppercase tracking-widest text-gray-400">Atividade Recente IA SDR</CardTitle>
            </div>
            <Link to="/performance">
              <Button variant="ghost" size="sm" className="text-xs h-8">Ver métricas de IA</Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {leads.filter(l => l.ia_status).slice(0, 3).map((lead, i) => (
                <div key={i} className="flex items-center justify-between p-4 border border-border rounded-[14px] bg-background/50 hover:border-primary/30 transition-all cursor-pointer group/item">
                  <div className="flex items-center gap-3">
                    <Badge className={cn(
                      "text-[10px] uppercase font-bold",
                      lead.ia_status === 'qualificado' ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                    )}>
                      {lead.ia_status}
                    </Badge>
                    <div>
                      <p className="text-sm font-bold text-white font-jakarta">{lead.name}</p>
                      <p className="text-[10px] text-[#6C727C] truncate max-w-[200px]">{lead.ia_resumo}</p>
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
        <Card className="shadow-xl border-border bg-card rounded-[14px] overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/50 bg-black/20">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-danger/10 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-danger" />
              </div>
              <CardTitle className="text-sm font-black uppercase tracking-widest text-gray-400">Alertas de SLA / Estagnação</CardTitle>
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
                <div key={i} className="flex items-center justify-between p-4 border border-danger/20 rounded-[14px] bg-danger/5 hover:bg-danger/10 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-white font-jakarta">{alert.name} <Badge className="ml-2 bg-danger/20 text-danger text-[9px] border-none font-black">{alert.priority}</Badge></p>
                      <p className="text-[10px] text-[#6C727C]">Parado em {alert.stage} há {alert.wait}</p>
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

function StatCard({ title, value, change, icon, highlight, link }: { title: string; value: string; change: string; icon: React.ReactNode; highlight?: boolean; link: string }) {
  return (
    <Link to={link} className="block">
      <Card className={cn(
        "hover:shadow-[0_20px_50px_rgba(255,196,0,0.15)] hover:-translate-y-2 transition-all duration-500 cursor-pointer border-border shadow-xl group overflow-hidden relative rounded-[14px]",
        highlight
          ? "bg-gradient-to-br from-primary via-yellow-bright to-yellow-dark border-primary" 
          : "bg-gradient-to-br from-card to-black-3 shadow-black/40"
      )}>
        <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
          {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "w-16 h-16 text-white" })}
        </div>
        {highlight && <div className="absolute right-[-10px] bottom-[-18px] text-[96px] opacity-[0.13]">🔥</div>}
        <CardContent className="p-6 relative z-10">
          <div className="flex items-center justify-between mb-4">
            <p className={cn(
              "text-[11px] font-black uppercase tracking-[0.12em] font-mono",
              highlight ? "text-[#5a4900]" : "text-gray-500"
            )}>{title}</p>
            <div className={cn(
              "p-2 rounded-xl transition-colors",
              highlight 
                ? "bg-[#1a1500]/10 text-[#1a1500] group-hover:bg-[#1a1500]/20" 
                : "bg-background text-primary border border-border group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary shadow-inner"
            )}>
              {icon}
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline gap-3">
              <div className={cn(
                "h-[38px] w-1 rounded-sm",
                highlight ? "bg-[#1a1500]" : "bg-primary shadow-[0_0_15px_rgba(255,196,0,0.5)]"
              )} />
              <h3 className={cn(
                "text-[46px] font-black tracking-tight font-jakarta leading-none",
                highlight ? "text-[#1a1500]" : "text-white"
              )}>{value}</h3>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full",
                highlight ? "bg-[#1a1500]" : "bg-[#1FA463]"
              )} />
              <p className={cn(
                "text-[12px] font-bold font-inter",
                highlight ? "text-[#5a4900]" : "text-gray-400"
              )}>{change}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

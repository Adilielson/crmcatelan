import { createFileRoute } from '@tanstack/react-router'
import { Brain, Users, TrendingUp, MessageCircle, AlertTriangle, Target, Clock, Filter, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/performance')({
  component: IAMetrics,
})

function IAMetrics() {
  const stats = [
    { title: 'Total Processado', value: '1.284', change: '+12%', icon: Brain, color: 'text-blue-600' },
    { title: 'Qualificados (SDR)', value: '842', change: '+18%', icon: Target, color: 'text-green-600' },
    { title: 'Desqualificados', value: '442', change: '-5%', icon: Filter, color: 'text-slate-600' },
    { title: 'Economia Horas/Atendimento', value: '215h', change: '+22%', icon: Clock, color: 'text-purple-600' },
  ]

  const funnelData = [
    { label: 'Primeiro Contato', count: 1284, percentage: 100 },
    { label: 'Identificação de Necessidade', count: 1020, percentage: 79 },
    { label: 'Qualificação Financeira', count: 890, percentage: 69 },
    { label: 'Pronto para Agendamento', count: 842, percentage: 65 },
  ]

  const dropOffReasons = [
    { question: 'Qualificação de Receita', drop: 15, color: 'bg-red-500' },
    { question: 'Consulta de Preço', drop: 12, color: 'bg-orange-500' },
    { question: 'Localização da Unidade', drop: 8, color: 'bg-yellow-500' },
    { question: 'Urgência do Problema', drop: 4, color: 'bg-blue-500' },
  ]

  return (
    <div className="space-y-10 text-ink animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-10 rounded-[24px] border border-[#E3E6EB] shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-1 rounded-full bg-primary" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Performance de Qualificação</span>
          </div>
          <h1 className="text-[36px] font-black tracking-tight font-jakarta leading-none mb-3">Inteligência Artificial</h1>
          <p className="text-[15px] text-gray-500 font-medium">Análise granular da eficiência operacional da sua IA SDR em tempo real.</p>
        </div>
        <div className="flex items-center gap-3 relative z-10">
          <div className="flex flex-col items-end mr-4">
            <span className="text-[10px] font-black text-[#A7ADB8] uppercase tracking-widest">Status do Sistema</span>
            <span className="text-xs font-bold text-[#1FA463]">IA Operacional 24/7</span>
          </div>
          <div className="p-3 bg-green-50 rounded-[14px] border border-green-100">
            <div className="w-3 h-3 bg-[#1FA463] rounded-full animate-pulse shadow-[0_0_10px_rgba(31,164,99,0.5)]" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {stats.map((stat, i) => (
          <Card key={i} className="border border-[#E3E6EB] shadow-[0_4px_20px_rgba(0,0,0,0.02)] bg-white rounded-[24px] overflow-hidden hover:shadow-[0_12px_30px_rgba(0,0,0,0.05)] hover:-translate-y-1 transition-all duration-300 group">
            <CardHeader className="flex flex-row items-center justify-between pb-6 pt-8 px-8">
              <CardTitle className="text-[10px] font-black text-[#A7ADB8] uppercase tracking-[0.2em]">{stat.title}</CardTitle>
              <div className={cn("p-3 rounded-[14px] transition-all group-hover:scale-110", stat.color.replace('text-', 'bg-').replace('-600', '-50'))}>
                <stat.icon className={cn("w-5 h-5", stat.color)} />
              </div>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              <div className="text-[32px] font-black text-ink tracking-tight mb-2">{stat.value}</div>
              <div className="flex items-center gap-2">
                <div className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black",
                  stat.change.startsWith('+') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                )}>
                  {stat.change.startsWith('+') ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {stat.change}
                </div>
                <span className="text-[11px] font-bold text-[#A7ADB8]">vs mês anterior</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border border-border shadow-card bg-white">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Funil de Conversão SDR
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {funnelData.map((item, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-gray-700 font-bold">{item.label}</span>
                  <span className="text-gray-400">{item.count} leads ({item.percentage}%)</span>
                </div>
                <Progress value={item.percentage} className="h-2 bg-slate-100" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border border-border shadow-card bg-white">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" /> Pontos de Abandono (Drop-off)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-[11px] text-gray-500 leading-relaxed mb-4">
              Análise de onde os leads param de responder durante a qualificação automática.
            </p>
            {dropOffReasons.map((item, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className={cn("w-1 h-8 rounded-full", item.color)} />
                <div className="flex-1">
                  <div className="text-xs font-bold text-gray-700">{item.question}</div>
                  <div className="text-[10px] text-gray-400">{item.drop}% de desistência nesta etapa</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


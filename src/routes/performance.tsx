import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Brain, Target, Filter, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from '@/lib/utils'
import { getIAPerformanceMetrics } from '@/lib/analytics.functions'

export const Route = createFileRoute('/performance')({
  component: IAMetrics,
})

type Period = 'weekly' | 'monthly' | 'yearly'

function IAMetrics() {
  const [period, setPeriod] = useState<Period>('monthly')
  const fetchMetrics = useServerFn(getIAPerformanceMetrics)
  const { data, isLoading } = useQuery({
    queryKey: ['ia-performance', period],
    queryFn: () => fetchMetrics({ data: { period } }),
  })

  const fmt = (n: number) => n.toLocaleString('pt-BR')
  const sign = (n: number) => (n >= 0 ? `+${n}%` : `${n}%`)

  const stats = [
    { title: 'Total Processado', value: fmt(data?.stats.processed.value ?? 0), change: sign(data?.stats.processed.change ?? 0), icon: Brain, color: 'text-blue-600' },
    { title: 'Qualificados (SDR)', value: fmt(data?.stats.qualified.value ?? 0), change: sign(data?.stats.qualified.change ?? 0), icon: Target, color: 'text-green-600' },
    { title: 'Desqualificados', value: fmt(data?.stats.disqualified.value ?? 0), change: sign(data?.stats.disqualified.change ?? 0), icon: Filter, color: 'text-slate-600' },
    { title: 'Economia Horas/Atendimento', value: `${fmt(data?.stats.hoursSaved.value ?? 0)}h`, change: sign(data?.stats.hoursSaved.change ?? 0), icon: Clock, color: 'text-purple-600' },
  ]

  const funnelData = data?.funnelData ?? []
  const dropOffReasons = data?.dropOffReasons ?? []

  return (
    <div className="space-y-10 text-ink animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 bg-white p-10 rounded-[24px] border border-[#E3E6EB] shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl transition-all group-hover:bg-primary/10" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-1 rounded-full bg-primary" />
            <span className="text-[11px] font-black uppercase tracking-[0.3em] text-primary">Performance de Qualificação</span>
          </div>
          <h1 className="text-[44px] font-black text-ink tracking-tight font-jakarta leading-none mb-4">Inteligência Artificial</h1>
          <p className="text-gray-500 font-medium text-[15px] max-w-xl">Análise granular da eficiência operacional da sua IA SDR em tempo real com métricas preditivas.</p>
        </div>
        <div className="flex items-center gap-4 relative z-10">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-[160px] h-11 rounded-xl border-[#E3E6EB] bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Últimos 7 dias</SelectItem>
              <SelectItem value="monthly">Últimos 30 dias</SelectItem>
              <SelectItem value="yearly">Últimos 12 meses</SelectItem>
            </SelectContent>
          </Select>
          <div className="p-4 bg-green-50 rounded-[18px] border border-green-100 shadow-sm relative overflow-hidden">
            <div className="w-4 h-4 bg-[#1FA463] rounded-full animate-pulse shadow-[0_0_15px_rgba(31,164,99,0.5)]" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {stats.map((stat, i) => (
          <Card key={i} className="border border-[#E3E6EB] shadow-[0_4px_20px_rgba(0,0,0,0.02)] bg-white rounded-[24px] overflow-hidden hover:shadow-[0_12px_40px_rgba(0,0,0,0.06)] hover:-translate-y-2 transition-all duration-500 group relative">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
               <stat.icon className="w-24 h-24" />
            </div>
            <CardHeader className="flex flex-row items-center justify-between pb-6 pt-8 px-8 relative z-10">
              <CardTitle className="text-[10px] font-black text-[#A7ADB8] uppercase tracking-[0.2em]">{stat.title}</CardTitle>
              <div className={cn("p-4 rounded-[18px] border transition-all group-hover:scale-110 shadow-sm", stat.color.replace('text-', 'bg-').replace('-600', '-50'), stat.color.replace('text-', 'border-').replace('-600', '-100'))}>
                <stat.icon className={cn("w-6 h-6", stat.color)} />
              </div>
            </CardHeader>
            <CardContent className="px-8 pb-8 relative z-10">
              <div className="text-[42px] font-black text-ink tracking-tight mb-3 leading-none">{isLoading ? '—' : stat.value}</div>
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight shadow-sm",
                  stat.change.startsWith('+') ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'
                )}>
                  {stat.change.startsWith('+') ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                  {stat.change}
                </div>
                <span className="text-[11px] font-bold text-[#A7ADB8] uppercase tracking-widest">vs período anterior</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border border-[#E3E6EB] shadow-[0_8px_30px_rgb(0,0,0,0.03)] bg-white rounded-[24px] overflow-hidden">
          <CardHeader className="p-8 border-b border-[#E3E6EB] bg-[#F6F7F9]/50">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-0.5 bg-primary rounded-full" />
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em] text-primary">Funil de Conversão SDR</CardTitle>
            </div>
            <p className="text-[14px] text-gray-500 font-medium">Fluxo de leads qualificados pela inteligência artificial.</p>
          </CardHeader>
          <CardContent className="p-8 space-y-8">
            {funnelData.length === 0 && !isLoading && (
              <p className="text-sm text-gray-400 italic">Sem dados de qualificação no período. A IA ainda não processou leads suficientes.</p>
            )}
            {funnelData.map((item, i) => (
              <div key={i} className="space-y-3">
                <div className="flex justify-between text-[11px] font-black uppercase tracking-widest">
                  <span className="text-ink">{item.label}</span>
                  <span className="text-gray-400">{item.count} leads ({item.percentage}%)</span>
                </div>
                <Progress value={item.percentage} className="h-2.5 bg-[#F6F7F9] rounded-full overflow-hidden" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border border-[#E3E6EB] shadow-[0_8px_30px_rgb(0,0,0,0.03)] bg-white rounded-[24px] overflow-hidden">
          <CardHeader className="p-8 border-b border-[#E3E6EB] bg-[#F6F7F9]/50">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-0.5 bg-danger rounded-full" />
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em] text-danger">Pontos de Drop-off</CardTitle>
            </div>
            <p className="text-[14px] text-gray-500 font-medium">Principais motivos de não fechamento registrados.</p>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <p className="text-[11px] text-gray-500 font-medium leading-relaxed mb-6 italic">
              Agregação de "motivo de não fechamento" registrado nas consultas de leads.
            </p>
            {dropOffReasons.length === 0 && !isLoading && (
              <p className="text-sm text-gray-400 italic">
                Nenhum motivo de não fechamento registrado ainda. Preencha no resumo de consulta dos leads para começar a ver o padrão.
              </p>
            )}
            <div className="space-y-4">
              {dropOffReasons.map((item, i) => (
                <div key={i} className="flex items-center gap-5 group cursor-pointer p-3 rounded-2xl hover:bg-gray-50 transition-all border border-transparent hover:border-border">
                  <div className={cn("w-2 h-10 rounded-full transition-all group-hover:scale-y-110 shadow-sm", item.color)} />
                  <div className="flex-1">
                    <div className="text-xs font-black text-ink uppercase tracking-tight">{item.question}</div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{item.drop}% das ocorrências</div>
                  </div>
                  <div className="h-8 w-8 rounded-xl bg-gray-50 border border-border flex items-center justify-center group-hover:bg-red-50 group-hover:border-red-100 transition-colors">
                    <ArrowDownRight className="w-4 h-4 text-danger group-hover:scale-110 transition-transform" />
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

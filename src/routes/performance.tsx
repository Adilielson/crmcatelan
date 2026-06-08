import { createFileRoute } from '@tanstack/react-router'
import { Brain, Users, TrendingUp, MessageCircle, AlertTriangle, Target, Clock, Filter, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

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
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1>Métricas de Inteligência Artificial</h1>
          <p className="text-sm text-gray-500">Acompanhamento de performance da IA SDR</p>
        </div>
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 py-1 px-3">
          IA Ativa 24/7
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className="border border-border shadow-card bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold text-gray-500 uppercase tracking-widest">{stat.title}</CardTitle>
              <stat.icon className={cn("w-4 h-4", stat.color)} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-ink">{stat.value}</div>
              <p className="text-[10px] flex items-center gap-1 mt-1 font-bold">
                {stat.change.startsWith('+') ? (
                  <ArrowUpRight className="w-3 h-3 text-green-500" />
                ) : (
                  <ArrowDownRight className="w-3 h-3 text-red-500" />
                )}
                <span className={stat.change.startsWith('+') ? 'text-green-500' : 'text-red-500'}>
                  {stat.change} em relação ao mês anterior
                </span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border border-border shadow-card bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Funil de Conversão SDR
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {funnelData.map((item, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-gray-600">{item.label}</span>
                  <span className="text-gray-400">{item.count} leads ({item.percentage}%)</span>
                </div>
                <Progress value={item.percentage} className="h-2 bg-slate-100" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border border-border shadow-card bg-card">
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

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ')
}

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useLeads, stageLabel } from '@/hooks/use-leads'
import { useUnits } from '@/hooks/use-leads'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { TrendingUp, Users, DollarSign, Target } from 'lucide-react'

export function MarketingMetrics() {
  const { data: leads = [] } = useLeads()

  const leadsByStatus = leads.reduce((acc: Record<string, number>, lead) => {
    const label = stageLabel(lead.status)
    acc[label] = (acc[label] || 0) + 1
    return acc
  }, {})

  const chartData = Object.entries(leadsByStatus).map(([name, value]) => ({ name, value }))

  const totalValue = leads.reduce((acc, lead) => acc + (lead.sales_value ?? 0), 0)
  const scheduledCount = leads.filter(l => l.status === 'scheduled').length
  const conversionRate = leads.length > 0
    ? ((scheduledCount / leads.length) * 100).toFixed(1)
    : '0.0'

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#eab308', '#22c55e']

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard title="Total de Leads" value={leads.length} icon={<Users className="text-blue-500" />} />
        <MetricCard title="Valor em Pipeline" value={`R$ ${totalValue.toLocaleString('pt-BR')}`} icon={<DollarSign className="text-green-500" />} />
        <MetricCard title="Taxa de Agendamento" value={`${conversionRate}%`} icon={<Target className="text-orange-500" />} />
        <MetricCard title="Crescimento" value="+12%" icon={<TrendingUp className="text-emerald-500" />} trend="up" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Distribuição por Etapa</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: '#f1f5f9' }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard({ title, value, icon, trend }: { title: string; value: string | number; icon: React.ReactNode; trend?: 'up' | 'down' }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">{title}</p>
            <h3 className="text-2xl font-bold">{value}</h3>
          </div>
          <div className="p-2 bg-slate-50 rounded-lg border">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

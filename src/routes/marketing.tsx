import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, 
  LineChart, Line, Legend
} from 'recharts'
import { Target, Users, TrendingUp, DollarSign, Brain, Filter } from 'lucide-react'
import { useState } from 'react'

export const Route = createFileRoute('/marketing')({
  component: MarketingPartnerDashboard,
})

const performanceData = [
  { name: 'Jan', clicks: 400, conversions: 240, roi: 2.5 },
  { name: 'Fev', clicks: 300, conversions: 139, roi: 3.1 },
  { name: 'Mar', clicks: 200, conversions: 980, roi: 4.5 },
  { name: 'Abr', clicks: 278, conversions: 390, roi: 3.8 },
  { name: 'Mai', clicks: 189, conversions: 480, roi: 5.2 },
]

function MarketingPartnerDashboard() {
  const [selectedLoja, setSelectedLoja] = useState('Loja Centro')

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Painel de Performance - Marketing</h1>
          <p className="text-slate-500">Monitoramento estratégico para {selectedLoja}</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select 
            className="border rounded-md px-3 py-1.5 text-sm"
            value={selectedLoja}
            onChange={(e) => setSelectedLoja(e.target.value)}
          >
            <option>Loja Centro</option>
            <option>Loja Sul</option>
            <option>Loja Norte</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard title="CTR (UTM)" value="4.2%" icon={<Target className="text-blue-500" />} />
        <MetricCard title="CPL" value="R$ 12,50" icon={<Users className="text-purple-500" />} />
        <MetricCard title="ROI" value="4.8x" icon={<TrendingUp className="text-emerald-500" />} />
        <MetricCard title="Conversão" value="18.5%" icon={<Brain className="text-orange-500" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">Clicks vs Conversões</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="clicks" fill="#3b82f6" radius={[4,4,0,0]} />
                <Bar dataKey="conversions" fill="#10b981" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Evolução do ROI</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="roi" stroke="#f59e0b" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function MetricCard({ title, value, icon }: any) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{title}</p>
            <h3 className="text-2xl font-bold mt-1">{value}</h3>
          </div>
          <div className="p-2 bg-slate-50 rounded-lg">{icon}</div>
        </div>
      </CardContent>
    </Card>
  )
}

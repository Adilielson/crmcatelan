import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, 
  LineChart, Line, Legend, AreaChart, Area, PieChart, Pie
} from 'recharts'
import { Target, Users, TrendingUp, DollarSign, Brain, Filter, MousePointer2, Megaphone, Layout, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export const Route = createFileRoute('/marketing')({
  component: MarketingPartnerDashboard,
})

const performanceData = [
  { name: '01/06', clicks: 450, leads: 42, conversions: 5, spend: 250, roi: 3.2 },
  { name: '02/06', clicks: 520, leads: 48, conversions: 8, spend: 280, roi: 4.1 },
  { name: '03/06', clicks: 380, leads: 35, conversions: 4, spend: 210, roi: 2.8 },
  { name: '04/06', clicks: 610, leads: 55, conversions: 12, spend: 320, roi: 5.4 },
  { name: '05/06', clicks: 580, leads: 52, conversions: 9, spend: 300, roi: 4.5 },
  { name: '06/06', clicks: 490, leads: 45, conversions: 7, spend: 270, roi: 3.9 },
]

const creativePerformance = [
  { name: 'Criativo_Verao_01', utm: 'utm_content=v1', leads: 125, cpl: 8.50, conversion: 12 },
  { name: 'Video_Depoimento_02', utm: 'utm_content=v2', leads: 85, cpl: 12.20, conversion: 15 },
  { name: 'Carrossel_Lançamento', utm: 'utm_content=c1', leads: 210, cpl: 6.40, conversion: 8 },
  { name: 'Banner_Promo_Junho', utm: 'utm_content=b1', leads: 64, cpl: 15.30, conversion: 10 },
]

function MarketingPartnerDashboard() {
  const [selectedLoja, setSelectedLoja] = useState('Loja Centro')
  const [activeMainTab, setActiveMainTab] = useState('performance')

  return (
    <div className="space-y-6">
      {/* Header com Filtros Globais */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Painel de Marketing</h1>
          <p className="text-slate-500 text-sm">Dashboard de Parceiro - Agência Performance</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="mr-4">
            <TabsList className="bg-slate-100">
              <TabsTrigger value="performance" className="text-xs font-bold">Performance</TabsTrigger>
              <TabsTrigger value="integrations" className="text-xs font-bold">Integrações & Pixel</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border">
            <Filter className="w-4 h-4 text-slate-400" />
            <select 
              className="bg-transparent border-none text-sm font-bold focus:ring-0 cursor-pointer"
              value={selectedLoja}
              onChange={(e) => setSelectedLoja(e.target.value)}
            >
              <option>Loja Centro</option>
              <option>Loja Sul</option>
            </select>
          </div>
        </div>
      </div>

      {activeMainTab === 'performance' ? (
        <PerformanceView performanceData={performanceData} creativePerformance={creativePerformance} />
      ) : (
        <IntegrationsView />
      )}
    </div>
  )
}

function IntegrationsView() {
  const [platform, setPlatform] = useState<'facebook_ads' | 'google_ads' | 'tiktok_ads'>('facebook_ads')
  const [isTesting, setIsTesting] = useState(false)
  const [showToken, setShowToken] = useState(false)

  const handleTestConnection = () => {
    setIsTesting(true)
    setTimeout(() => {
      setIsTesting(false)
      alert("Disparo de teste realizado com sucesso! Evento 'Lead' recebido pela plataforma.")
    }, 2000)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-bold">Configurar Integração Ads</CardTitle>
          <CardDescription>Configure o Pixel e a API de Conversão para rastreamento de ROAS</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Plataforma</label>
              <select 
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={platform}
                onChange={(e) => setPlatform(e.target.value as any)}
              >
                <option value="facebook_ads">Facebook / Meta Ads</option>
                <option value="google_ads">Google Ads</option>
                <option value="tiktok_ads">TikTok Ads</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Tipo de Integração</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm">
                <option>API de Conversão (Recomendado)</option>
                <option>Pixel Browser</option>
                <option>Ambos (Desduplicação Ativa)</option>
              </select>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">ID do Pixel / Conta de Anúncios</label>
              <input type="text" className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Ex: 123456789012345" />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Token de Acesso (API de Conversão)</label>
              <div className="relative">
                <input 
                  type={showToken ? "text" : "password"} 
                  className="w-full border rounded-lg px-3 py-2 text-sm pr-20" 
                  placeholder="EAA..." 
                />
                <button 
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2 top-1.5 text-[10px] font-bold text-primary hover:underline bg-white px-2"
                >
                  {showToken ? "Ocultar" : "Revelar"}
                </button>
              </div>
              <p className="text-[10px] text-slate-400">O token é armazenado de forma criptografada e nunca é exibido em texto plano após salvo.</p>
            </div>
          </div>

            <div className="space-y-4 pt-4 border-t">
            <h4 className="text-xs font-bold text-slate-700">Mapeamento de Eventos (CRM {"\u2192"} Ads)</h4>
            <div className="space-y-3">
              {[
                { label: 'Lead Gerado', crmStatus: 'Novo Lead', defaultEvent: 'Lead' },

                { label: 'Agendamento Confirmado', crmStatus: 'Agendado', defaultEvent: 'Schedule' },
                { label: 'Check-in Realizado', crmStatus: 'Compareceu', defaultEvent: 'Purchase' },
              ].map((map, i) => (
                <div key={i} className="flex items-center gap-4 bg-slate-50 p-3 rounded-lg border border-dashed">
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-700">{map.label}</p>
                    <p className="text-[10px] text-slate-400">Gatilho: Status {map.crmStatus}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400">Enviar como:</span>
                    <input type="text" defaultValue={map.defaultEvent} className="border rounded px-2 py-1 text-xs w-32" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center pt-6 border-t">
            <Button 
              variant="outline" 
              onClick={handleTestConnection} 
              disabled={isTesting}
              className="font-bold text-xs"
            >
              {isTesting ? "Testando..." : "Realizar Disparo de Teste"}
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" className="font-bold text-xs">Cancelar</Button>
              <Button className="font-bold text-xs bg-emerald-600 hover:bg-emerald-700">Salvar Integração</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-bold">Status da Conexão</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Facebook API</span>
              <Badge className="bg-emerald-50 text-emerald-600 border-none font-bold text-[10px]">Ativo</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Google Ads</span>
              <Badge variant="outline" className="text-slate-400 font-bold text-[10px]">Inativo</Badge>
            </div>
            <div className="pt-2 border-t text-[10px] text-slate-400">
              <p>Último evento enviado: 12min atrás</p>
              <p>Qualidade da desduplicação: 98%</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm bg-blue-50/50 border-blue-100">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-blue-800 flex items-center gap-2">
              <Brain className="w-4 h-4" /> Dica Pro Agência
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-blue-700 leading-relaxed">
              O uso da API de Conversão com o identifikador <span className="font-bold italic">external_id</span> garante que eventos não sejam perdidos por bloqueadores de anúncios e evita contagem duplicada.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function PerformanceView({ performanceData, creativePerformance }: any) {
  return (
    <>
      {/* Principais KPIs de Performance */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="Investimento Total" 
          value="R$ 1.630,00" 
          change="+15% vs mês ant." 
          icon={<DollarSign className="w-4 h-4 text-blue-600" />} 
          color="blue"
        />
        <MetricCard 
          title="Custo por Lead (CPL)" 
          value="R$ 5,88" 
          change="-8% (Otimização)" 
          icon={<Target className="w-4 h-4 text-emerald-600" />} 
          color="emerald"
        />
        <MetricCard 
          title="ROI Comercial" 
          value="4.5x" 
          change="Direto via CRM" 
          icon={<TrendingUp className="w-4 h-4 text-orange-600" />} 
          color="orange"
        />
        <MetricCard 
          title="Leads Qualificados" 
          value="277" 
          change="85% de Eficiência" 
          icon={<Brain className="w-4 h-4 text-purple-600" />} 
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico Principal de Conversão */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-700">Fluxo de Conversão (Daily)</CardTitle>
              <CardDescription className="text-xs">Cliques vs Leads vs Vendas</CardDescription>
            </div>
            <Tabs defaultValue="leads">
              <TabsList className="h-8">
                <TabsTrigger value="leads" className="text-[10px] px-2 h-6 font-bold">Leads</TabsTrigger>
                <TabsTrigger value="roi" className="text-[10px] px-2 h-6 font-bold">ROI</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performanceData}>
                <defs>
                  <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Area type="monotone" dataKey="leads" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorLeads)" />
                <Area type="monotone" dataKey="conversions" stroke="#10b981" strokeWidth={3} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Performance de Criativos via UTM */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-700 flex items-center gap-2">
              <Megaphone className="w-4 h-4" /> Criativos (UTM Content)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              {creativePerformance.map((item: any, i: number) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs font-bold text-slate-800">{item.name}</p>
                      <p className="text-[9px] text-slate-400 font-mono">{item.utm}</p>
                    </div>
                    <Badge variant="outline" className="text-[9px] font-bold">R$ {item.cpl.toFixed(2)}/lead</Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-primary h-full rounded-full" 
                        style={{ width: `${(item.leads / 210) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-slate-500">{item.leads} leads</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Atividade de Eventos (Pixel/CAPI) */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <MousePointer2 className="w-4 h-4 text-blue-500" /> Eventos Tracking (CAPI)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { event: 'Lead Qualificado', count: 245, status: 'Ativo', health: 98 },
                { event: 'Início Atendimento', count: 189, status: 'Ativo', health: 95 },
                { event: 'Consulta Agendada', count: 82, status: 'Ativo', health: 100 },
                { event: 'Compra (CRM)', count: 42, status: 'Ativo', health: 92 },
              ].map((ev, i) => (
                <div key={i} className="flex items-center justify-between p-2 border-b last:border-0">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-700">{ev.event}</span>
                    <span className="text-[9px] text-slate-400">{ev.count} eventos / 24h</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                       <p className="text-[10px] font-bold text-emerald-600">{ev.health}% Match</p>
                       <Badge className="text-[8px] h-4 bg-emerald-50 text-emerald-600 border-none">Sync OK</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Auditoria Comercial (Análise de Conversa) */}
        <Card className="lg:col-span-2 shadow-sm bg-slate-900 text-white overflow-hidden">
          <CardHeader className="bg-slate-800/50">
            <div className="flex justify-between items-center">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-emerald-400" /> Auditoria de Qualidade Comercial
              </CardTitle>
              <Badge className="bg-emerald-500 text-white border-none text-[10px]">Novos Insights</Badge>
            </div>
            <CardDescription className="text-slate-400 text-xs">Visão da agência sobre a abordagem do time comercial</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-4 space-y-4">
              {[
                { lead: 'Roberto Silva', status: 'Agendado', feedback: 'O vendedor demorou 15min para responder após a qualificação da IA. Risco de perda de timing.', time: '2h atrás' },
                { lead: 'Ana Clara', status: 'Perdido', feedback: 'Lead questionou sobre parcelamento e não foi ofertado o plano especial da campanha.', time: '5h atrás' },
              ].map((audit, i) => (
                <div key={i} className="bg-slate-800 p-3 rounded-xl border border-slate-700/50 group hover:border-emerald-500/50 transition-all cursor-pointer">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-xs font-bold text-slate-200">{audit.lead}</p>
                      <Badge variant="outline" className="text-[8px] text-slate-400 border-slate-600 h-4 mt-1">{audit.status}</Badge>
                    </div>
                    <span className="text-[9px] text-slate-500">{audit.time}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 italic leading-relaxed">
                    "{audit.feedback}"
                  </p>
                  <div className="mt-2 pt-2 border-t border-slate-700 flex justify-end">
                    <Button variant="ghost" size="sm" className="h-6 text-[9px] text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10">Ver Histórico Conversa</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function MetricCard({ title, value, change, icon, color }: any) {
  const colorMap: any = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
  }
  
  return (
    <Card className="shadow-sm border-none bg-white">
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</p>
            <h3 className="text-2xl font-black text-slate-800">{value}</h3>
          </div>
          <div className={`p-2 rounded-xl border ${colorMap[color]}`}>
            {icon}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Badge className={`text-[9px] font-bold border-none ${colorMap[color]} px-1.5 h-4`}>
            {change}
          </Badge>
          <span className="text-[9px] text-slate-400 font-medium">vs período anterior</span>
        </div>
      </CardContent>
    </Card>
  )
}

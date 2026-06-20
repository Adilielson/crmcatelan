import React, { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, 
  LineChart, Line, Legend, AreaChart, Area, PieChart, Pie
} from 'recharts'
import { Target, Users, TrendingUp, DollarSign, Brain, Filter, MousePointer2, Megaphone, Layout, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { AdSourceBreakdown } from '@/components/marketing/AdSourceBreakdown'

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
    <div className="space-y-10 animate-in fade-in duration-700">
      {/* Header com Filtros Globais */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 bg-white p-10 rounded-[24px] border border-[#E3E6EB] shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full -mr-24 -mt-24 blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-1 rounded-full bg-primary" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Inteligência de Tráfego</span>
          </div>
          <h1 className="text-[36px] font-black text-ink tracking-tight font-jakarta leading-none mb-3">Painel de Marketing</h1>
          <p className="text-[15px] text-gray-500 font-medium italic">Visão estratégica para parceiros e gestores de performance.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 relative z-10">
          <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="mr-2">
            <TabsList className="bg-[#F6F7F9] p-1 rounded-[16px] border border-[#E3E6EB] h-14">
              <TabsTrigger value="performance" className="px-6 h-11 text-[11px] font-black uppercase tracking-widest rounded-[12px] data-[state=active]:bg-white data-[state=active]:shadow-sm">Performance</TabsTrigger>
              <TabsTrigger value="integrations" className="px-6 h-11 text-[11px] font-black uppercase tracking-widest rounded-[12px] data-[state=active]:bg-white data-[state=active]:shadow-sm">Pixels {'&'} CAPI</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-3 bg-white px-6 h-14 rounded-[16px] border border-[#E3E6EB] shadow-sm hover:border-primary/50 transition-all cursor-pointer">
            <Filter className="w-4 h-4 text-primary" />
            <select 
              className="bg-transparent border-none text-[11px] font-black uppercase tracking-widest focus:ring-0 cursor-pointer text-ink outline-none pr-8"
              value={selectedLoja}
              onChange={(e) => setSelectedLoja(e.target.value)}
            >
              <option>Loja Centro</option>
              <option>Loja Sul</option>
            </select>
          </div>
        </div>
      </div>

      <AdSourceBreakdown />

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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <Card className="lg:col-span-2 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-[#E3E6EB] bg-white rounded-[24px] overflow-hidden">
        <CardHeader className="pb-8 border-b border-[#E3E6EB] bg-[#F6F7F9]/50">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-0.5 bg-primary rounded-full" />
            <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em] text-primary">Configuração de Tráfego</CardTitle>
          </div>
          <CardDescription className="text-[14px] text-gray-500 font-medium">Configure o Pixel e a API de Conversão para rastreamento de ROAS em tempo real.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 p-8">
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
            <h4 className="text-xs font-bold text-slate-700">Mapeamento de Eventos (CRM {'\u2192'} Ads)</h4>
            <div className="space-y-3">
              {[
                { label: 'Lead Gerado', crmStatus: 'Novo Lead', defaultEvent: 'Lead' },

                { label: 'Agendamento Confirmado', crmStatus: 'Agendado', defaultEvent: 'Schedule' },
                { label: 'Check-in Realizado', crmStatus: 'Compareceu', defaultEvent: 'Purchase' },
              ].map((map, i) => (
                <div key={i} className="flex items-center gap-4 bg-[#F6F7F9] p-4 rounded-[16px] border border-dashed border-[#E3E6EB] hover:border-primary/50 transition-all">
                  <div className="flex-1">
                    <p className="text-[13px] font-black text-ink uppercase tracking-tight">{map.label}</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Gatilho: Status {map.crmStatus}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Mapear para:</span>
                    <Input defaultValue={map.defaultEvent} className="h-10 border-[#E3E6EB] rounded-xl px-4 text-xs font-bold w-40" />
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
        <Card className="lg:col-span-2 shadow-card border-border bg-white text-ink">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-black text-ink uppercase tracking-wider">Fluxo de Conversão (Daily)</CardTitle>
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
        <Card className="shadow-card border-border bg-white text-ink">
          <CardHeader>
            <CardTitle className="text-base font-black text-ink flex items-center gap-2 uppercase tracking-wider">
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
        <Card className="shadow-card border-border bg-white text-ink">
          <CardHeader>
            <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-wider text-gray-500">
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
                    <span className="text-xs font-bold text-ink">{ev.event}</span>
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
        <Card className="lg:col-span-2 shadow-[0_8px_30px_rgb(0,0,0,0.1)] bg-[#0E0E11] text-white overflow-hidden border-[#23232B] rounded-[24px]">
          <CardHeader className="bg-[#17171B] border-b border-[#23232B] p-8">
            <div className="flex justify-between items-center mb-1">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#1FA463]/20 rounded-xl border border-[#1FA463]/30">
                  <MessageCircle className="w-5 h-5 text-[#1FA463]" />
                </div>
                <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-white">Auditoria de Qualidade</CardTitle>
              </div>
              <Badge className="bg-[#1FA463] text-white border-none text-[10px] font-black px-3 py-1 rounded-lg">NOVOS INSIGHTS</Badge>
            </div>
            <CardDescription className="text-slate-400 text-xs font-medium">Visão estratégica da agência sobre a performance do time comercial.</CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { lead: 'Roberto Silva', status: 'Agendado', feedback: 'O vendedor demorou 15min para responder após a qualificação da IA. Risco de perda de timing.', time: '2h atrás' },
                { lead: 'Ana Clara', status: 'Perdido', feedback: 'Lead questionou sobre parcelamento e não foi ofertado o plano especial da campanha.', time: '5h atrás' },
              ].map((audit, i) => (
                <div key={i} className="bg-[#17171B] p-6 rounded-[20px] border border-[#23232B] group hover:border-[#FFC400]/50 transition-all cursor-pointer relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-24 h-24 bg-[#FFC400]/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-[#FFC400]/10" />
                  <div className="flex justify-between items-start mb-4 relative z-10">
                    <div>
                      <p className="text-sm font-black text-white uppercase tracking-tight">{audit.lead}</p>
                      <Badge variant="outline" className="text-[9px] text-[#A7ADB8] border-[#23232B] h-5 mt-2 font-black uppercase tracking-widest">{audit.status}</Badge>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500">{audit.time}</span>
                  </div>
                  <p className="text-[12px] text-slate-400 font-medium leading-relaxed mb-4 italic relative z-10">
                    "{audit.feedback}"
                  </p>
                  <div className="pt-4 border-t border-[#23232B] flex justify-end relative z-10">
                    <Button variant="ghost" size="sm" className="h-8 text-[10px] font-black text-[#FFC400] hover:text-[#FFC400] hover:bg-[#FFC400]/10 uppercase tracking-widest">Ver Histórico</Button>
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

function MetricCard({ title, value, change, icon, color }: { title: string; value: string; change: string; icon: React.ReactNode; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
  }
  
  return (
    <Card className="shadow-[0_8px_30px_rgb(0,0,0,0.03)] border-[#E3E6EB] bg-white rounded-[24px] hover:shadow-[0_12px_40px_rgba(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300 group overflow-hidden relative">
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
         {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "w-24 h-24" })}
      </div>
      <CardContent className="p-8 relative z-10">
        <div className="flex justify-between items-start mb-6">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-[#A7ADB8] uppercase tracking-[0.2em] font-jakarta">{title}</p>
            <h3 className="text-[36px] font-black text-ink tracking-tight font-jakarta leading-none">{value}</h3>
          </div>
          <div className={cn("p-4 rounded-[18px] border transition-all group-hover:scale-110", colorMap[color])}>
            {icon}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={cn("text-[10px] font-black border-none px-2.5 py-1 rounded-lg", colorMap[color])}>
            {change}
          </Badge>
          <span className="text-[10px] text-[#A7ADB8] font-bold uppercase tracking-widest">vs mês anterior</span>
        </div>
      </CardContent>
    </Card>
  )
}

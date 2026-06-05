import { createFileRoute } from '@tanstack/react-router'
import { 
  BarChart3, 
  Target, 
  Share2, 
  AlertCircle,
  TrendingUp,
  Users as UsersIcon,
  Calendar as CalendarIcon
} from 'lucide-react'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/marketing')({
  component: MarketingDashboard,
})

function MarketingDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Custo por Agendamento (CPA)" 
          value="R$ 42,50" 
          change="-R$ 5,00 vs semana anterior" 
          icon={TrendingUp}
        />
        <StatCard 
          title="Taxa de No-Show" 
          value="18%" 
          change="+2% vs meta (15%)" 
          color="text-red-600"
          icon={AlertCircle}
        />
        <StatCard 
          title="ROI de Marketing" 
          value="4.2x" 
          change="+0.5x este mês" 
          icon={BarChart3}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border rounded-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              Origem de Leads (Ads)
            </h3>
            <select className="text-xs border rounded px-2 py-1 outline-none">
              <option>Últimos 30 dias</option>
              <option>Últimos 7 dias</option>
            </select>
          </div>
          <div className="space-y-4">
            <SourceRow name="Facebook Ads" leads={450} conversion="12%" color="bg-blue-500" />
            <SourceRow name="Google Ads" leads={320} conversion="15%" color="bg-red-500" />
            <SourceRow name="Orgânico" leads={120} conversion="8%" color="bg-green-500" />
          </div>
        </section>

        <section className="bg-white border rounded-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold flex items-center gap-2">
              <Share2 className="w-4 h-4 text-primary" />
              Integração de Conversão (Pixel/API)
            </h3>
          </div>
          <div className="space-y-4">
            <IntegrationStatus platform="Facebook Ads" status="active" lastSync="Há 5 min" />
            <IntegrationStatus platform="Google Ads" status="active" lastSync="Há 12 min" />
            <IntegrationStatus platform="TikTok Ads" status="inactive" lastSync="-" />
          </div>
          <button className="w-full mt-6 py-2 border-2 border-dashed rounded-lg text-sm text-muted-foreground hover:bg-gray-50 transition-colors">
            Configurar Nova Integração
          </button>
        </section>
      </div>
    </div>
  )
}

function StatCard({ title, value, change, color, icon: Icon }: any) {
  return (
    <div className="bg-white p-6 rounded-xl border">
      <div className="flex justify-between items-start mb-4">
        <p className="text-sm text-muted-foreground">{title}</p>
        {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
      </div>
      <h4 className={cn("text-2xl font-bold", color)}>{value}</h4>
      <p className="text-xs text-muted-foreground mt-2">{change}</p>
    </div>
  )
}

function SourceRow({ name, leads, conversion, color }: any) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{name}</span>
        <span className="text-muted-foreground">{leads} leads • {conversion} conv.</span>
      </div>
      <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: conversion }} />
      </div>
    </div>
  )
}

function IntegrationStatus({ platform, status, lastSync }: any) {
  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex items-center gap-3">
        <div className={cn("w-2 h-2 rounded-full", status === 'active' ? 'bg-green-500' : 'bg-gray-300')} />
        <span className="text-sm font-medium">{platform}</span>
      </div>
      <div className="text-right">
        <p className={cn("text-xs font-medium uppercase", status === 'active' ? 'text-green-600' : 'text-muted-foreground')}>
          {status === 'active' ? 'Conectado' : 'Desconectado'}
        </p>
        <p className="text-[10px] text-muted-foreground">Sinc: {lastSync}</p>
      </div>
    </div>
  )
}

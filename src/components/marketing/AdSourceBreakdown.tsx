import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useLeads } from '@/hooks/use-leads'
import { Megaphone, ExternalLink, ImageOff } from 'lucide-react'

type AdRow = {
  key: string
  ad_name: string | null
  ad_id: string | null
  utm_campaign: string | null
  utm_source: string | null
  utm_medium: string | null
  ad_thumbnail_url: string | null
  ad_source_url: string | null
  total: number
  scheduled: number
  showed_up: number
  pipeline: number
  revenue: number
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

export function AdSourceBreakdown() {
  const { data: leads = [] } = useLeads()

  const { rows, totalFromAds, totalLeads } = useMemo(() => {
    const map = new Map<string, AdRow>()
    let fromAds = 0

    for (const l of leads as any[]) {
      const hasOrigin = l.ad_id || l.ad_name || l.utm_campaign || l.ctwa_clid
      if (!hasOrigin) continue
      fromAds++

      const key = l.ad_id || l.ad_name || l.utm_campaign || l.ctwa_clid || 'desconhecido'
      const cur = map.get(key) ?? {
        key,
        ad_name: l.ad_name ?? null,
        ad_id: l.ad_id ?? null,
        utm_campaign: l.utm_campaign ?? null,
        utm_source: l.utm_source ?? null,
        utm_medium: l.utm_medium ?? null,
        ad_thumbnail_url: l.ad_thumbnail_url ?? null,
        ad_source_url: l.ad_source_url ?? null,
        total: 0, scheduled: 0, showed_up: 0, pipeline: 0, revenue: 0,
      }
      cur.total++
      if (['scheduled', 'checked_in', 'negotiating', 'showed_up'].includes(l.status)) cur.scheduled++
      if (l.status === 'showed_up') {
        cur.showed_up++
        cur.revenue += Number(l.sales_value ?? 0)
      } else {
        cur.pipeline += Number(l.sales_value ?? 0)
      }
      map.set(key, cur)
    }

    const rows = Array.from(map.values()).sort((a, b) => b.total - a.total)
    return { rows, totalFromAds: fromAds, totalLeads: leads.length }
  }, [leads])

  const conv = totalFromAds > 0
    ? ((rows.reduce((s, r) => s + r.showed_up, 0) / totalFromAds) * 100).toFixed(1)
    : '0.0'

  return (
    <Card className="shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-[#E3E6EB] bg-white rounded-[24px] overflow-hidden">
      <CardHeader className="pb-6 border-b border-[#E3E6EB] bg-[#F6F7F9]/50">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-0.5 bg-primary rounded-full" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Dados reais do WhatsApp</span>
        </div>
        <CardTitle className="text-2xl font-black tracking-tight flex items-center gap-3">
          <Megaphone className="w-5 h-5 text-primary" />
          Origem por Anúncio (CTWA)
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Leads que chegaram via clique no anúncio do Meta. Capturado automaticamente do contexto da mensagem.
        </CardDescription>

        <div className="grid grid-cols-3 gap-4 mt-6">
          <Stat label="Leads de anúncios" value={String(totalFromAds)} sub={`${totalLeads} no total`} />
          <Stat label="Anúncios distintos" value={String(rows.length)} />
          <Stat label="Conversão (fechados)" value={`${conv}%`} />
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Ainda não há leads com origem de anúncio capturada. Assim que um lead chegar via Click-to-WhatsApp,
            o anúncio aparecerá aqui automaticamente.
          </div>
        ) : (
          <div className="divide-y divide-[#E3E6EB]">
            {rows.map((r) => (
              <div key={r.key} className="flex items-center gap-4 px-6 py-4 hover:bg-[#F6F7F9]/40 transition-colors">
                <div className="w-14 h-14 rounded-xl bg-[#F6F7F9] border border-[#E3E6EB] flex items-center justify-center overflow-hidden shrink-0">
                  {r.ad_thumbnail_url ? (
                    <img src={r.ad_thumbnail_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageOff className="w-5 h-5 text-gray-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">
                    {r.ad_name || r.utm_campaign || r.ad_id || 'Anúncio sem nome'}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {r.utm_source && <Badge variant="secondary" className="text-[10px]">src: {r.utm_source}</Badge>}
                    {r.utm_medium && <Badge variant="secondary" className="text-[10px]">med: {r.utm_medium}</Badge>}
                    {r.utm_campaign && r.utm_campaign !== r.ad_name && (
                      <Badge variant="outline" className="text-[10px]">camp: {r.utm_campaign}</Badge>
                    )}
                    {r.ad_id && <Badge variant="outline" className="text-[10px]">id: {r.ad_id.slice(0, 12)}</Badge>}
                    {r.ad_source_url && (
                      <a
                        href={r.ad_source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                      >
                        abrir <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
                <div className="hidden sm:grid grid-cols-4 gap-6 text-right">
                  <Mini label="Leads" value={r.total} />
                  <Mini label="Agendados" value={r.scheduled} />
                  <Mini label="Fechados" value={r.showed_up} />
                  <Mini label="Receita" value={fmtBRL(r.revenue)} mono />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-[#E3E6EB] rounded-2xl p-4">
      <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-2xl font-black mt-1">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  )
}

function Mini({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="min-w-[64px]">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-sm font-bold ${mono ? 'tabular-nums' : ''}`}>{value}</div>
    </div>
  )
}

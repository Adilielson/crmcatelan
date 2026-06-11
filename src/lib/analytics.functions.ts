import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { z } from 'zod'

const DashboardInput = z.object({
  unitId: z.string().uuid().nullable().optional(),
})

const NoShowInput = z.object({
  unitId: z.string().uuid().nullable().optional(),
  period: z.enum(['daily', 'weekly', 'monthly', 'yearly']).default('monthly'),
})

const LEAD_COLORS: Record<string, string> = {
  open: '#94a3b8',
  in_progress: '#6366f1',
  scheduled: '#8b5cf6',
  checked_in: '#10b981',
  negotiating: '#06b6d4',
  showed_up: '#22c55e',
  followup: '#eab308',
  lost: '#ef4444',
  no_show: '#f97316',
}

const SOURCE_COLORS = ['#22c55e', '#ec4899', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4']

function pct(num: number, denom: number) {
  if (!denom) return 0
  return Math.round((num / denom) * 1000) / 10
}

export const getDashboardMetrics = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DashboardInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context
    const unitFilter = data.unitId ?? null

    // ---- Leads ----
    let leadsQ = supabase
      .from('leads')
      .select('id, status, sales_value, score_ia, source, updated_at, full_name, ia_summary, created_at, unit_id')
    if (unitFilter) leadsQ = leadsQ.eq('unit_id', unitFilter)
    const { data: leads, error: leadsErr } = await leadsQ
    if (leadsErr) throw leadsErr
    const allLeads = leads ?? []

    // ---- Appointments (next 7 days) ----
    const in7d = new Date()
    in7d.setDate(in7d.getDate() + 7)
    let apptQ = supabase
      .from('appointments')
      .select('id, status, scheduled_at, unit_id')
      .gte('scheduled_at', new Date().toISOString())
      .lte('scheduled_at', in7d.toISOString())
    if (unitFilter) apptQ = apptQ.eq('unit_id', unitFilter)
    const { data: appts } = await apptQ

    // ---- Kanban columns for funnel ----
    let colsQ = supabase.from('kanban_columns').select('name, system_key, position').order('position')
    const { data: cols } = await colsQ

    // ---- Period split (current 30d vs previous 30d) for deltas ----
    const now = Date.now()
    const D30 = 30 * 24 * 60 * 60 * 1000
    const cur = allLeads.filter((l) => new Date(l.created_at ?? 0).getTime() > now - D30)
    const prev = allLeads.filter((l) => {
      const t = new Date(l.created_at ?? 0).getTime()
      return t <= now - D30 && t > now - 2 * D30
    })

    const totalLeads = allLeads.length
    const totalValue = allLeads.reduce((a, l) => a + (Number(l.sales_value) || 0), 0)
    const qualified = allLeads.filter((l) => (l.score_ia ?? 0) >= 70).length
    const qualRate = pct(qualified, totalLeads)
    const confirmedAppts = (appts ?? []).filter((a) => a.status === 'confirmed' || a.status === 'pending').length

    const leadsDelta = pct(cur.length - prev.length, Math.max(prev.length, 1))
    const valueDelta = pct(
      cur.reduce((a, l) => a + (Number(l.sales_value) || 0), 0) -
        prev.reduce((a, l) => a + (Number(l.sales_value) || 0), 0),
      Math.max(prev.reduce((a, l) => a + (Number(l.sales_value) || 0), 0), 1),
    )

    // ---- Funnel by status ----
    const counts: Record<string, number> = {}
    for (const l of allLeads) {
      const k = l.status ?? 'open'
      counts[k] = (counts[k] ?? 0) + 1
    }
    const funnelData = (cols ?? [])
      .filter((c) => (counts[c.system_key ?? ''] ?? 0) > 0)
      .map((c) => ({
        name: c.name,
        value: counts[c.system_key ?? ''] ?? 0,
        color: LEAD_COLORS[c.system_key ?? ''] ?? '#94a3b8',
      }))

    // ---- Sources ----
    const srcCount: Record<string, number> = {}
    for (const l of allLeads) {
      const k = (l.source || 'Sem origem').trim()
      srcCount[k] = (srcCount[k] ?? 0) + 1
    }
    const sourceEntries = Object.entries(srcCount).sort((a, b) => b[1] - a[1]).slice(0, 6)
    const sourceTotal = sourceEntries.reduce((a, [, v]) => a + v, 0)
    const sourceData = sourceEntries.map(([name, value], i) => ({
      name,
      value: pct(value, sourceTotal),
      raw: value,
      color: SOURCE_COLORS[i % SOURCE_COLORS.length],
    }))

    // ---- SLA alerts (parado há >4h em open/in_progress) ----
    const FOUR_H = 4 * 60 * 60 * 1000
    const slaAlerts = allLeads
      .filter((l) => l.status === 'open' || l.status === 'in_progress')
      .filter((l) => now - new Date(l.updated_at ?? 0).getTime() > FOUR_H)
      .sort((a, b) => new Date(a.updated_at ?? 0).getTime() - new Date(b.updated_at ?? 0).getTime())
      .slice(0, 5)
      .map((l) => {
        const waitH = Math.floor((now - new Date(l.updated_at ?? 0).getTime()) / (60 * 60 * 1000))
        return {
          id: l.id,
          name: l.full_name ?? 'Sem nome',
          stage: l.status === 'open' ? 'Leads Prontos' : 'Em Atendimento',
          waitHours: waitH,
          priority: waitH > 24 ? 'Alta' : 'Normal',
        }
      })

    // ---- Recent AI activity ----
    const recentAi = allLeads
      .filter((l) => l.ia_summary || (l.score_ia ?? 0) > 0)
      .sort((a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime())
      .slice(0, 3)
      .map((l) => ({
        id: l.id,
        full_name: l.full_name ?? 'Sem nome',
        ia_summary: l.ia_summary,
        score_ia: l.score_ia ?? 0,
      }))

    return {
      kpis: {
        totalLeads,
        totalValue,
        confirmedAppts,
        qualRate,
        leadsDelta,
        valueDelta,
      },
      funnelData,
      sourceData,
      slaAlerts,
      recentAi,
    }
  })

export const getNoShowMetrics = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => NoShowInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context
    const periodDays = { daily: 1, weekly: 7, monthly: 30, yearly: 365 }[data.period]
    const since = new Date()
    since.setDate(since.getDate() - periodDays)

    let q = supabase
      .from('appointments')
      .select('id, status, scheduled_at, value, lead_id, unit_id, lead_name')
      .gte('scheduled_at', since.toISOString())
    if (data.unitId) q = q.eq('unit_id', data.unitId)
    const { data: appts, error } = await q
    if (error) throw error
    const list = appts ?? []

    const total = list.length
    const compareceu = list.filter((a) => a.status === 'completed').length
    const noShow = list.filter((a) => a.status === 'no_show').length
    const cancelado = list.filter((a) => a.status === 'cancelled').length
    const attendanceRate = pct(compareceu, total)
    const noShowRate = pct(noShow, total)

    const noShowValue = list
      .filter((a) => a.status === 'no_show')
      .reduce((a, x) => a + (Number(x.value) || 0), 0)

    // 6-month trend
    const monthMap: Record<string, { compareceu: number; noShow: number; cancelado: number }> = {}
    const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
    sixMonthsAgo.setDate(1)
    let trendQ = supabase
      .from('appointments')
      .select('status, scheduled_at, unit_id')
      .gte('scheduled_at', sixMonthsAgo.toISOString())
    if (data.unitId) trendQ = trendQ.eq('unit_id', data.unitId)
    const { data: trendRows } = await trendQ
    for (const a of trendRows ?? []) {
      const d = new Date(a.scheduled_at)
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!monthMap[k]) monthMap[k] = { compareceu: 0, noShow: 0, cancelado: 0 }
      if (a.status === 'completed') monthMap[k].compareceu++
      else if (a.status === 'no_show') monthMap[k].noShow++
      else if (a.status === 'cancelled') monthMap[k].cancelado++
    }
    const attendanceTrend = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => {
        const m = parseInt(k.split('-')[1], 10) - 1
        return { name: MONTHS[m], ...v }
      })

    // No-show by source — JOIN leads
    let sourceData: Array<{ name: string; value: number; noShow: number }> = []
    if (list.length > 0) {
      const leadIds = Array.from(new Set(list.map((a) => a.lead_id).filter(Boolean) as string[]))
      if (leadIds.length > 0) {
        const { data: leadRows } = await supabase
          .from('leads')
          .select('id, source')
          .in('id', leadIds)
        const srcByLead: Record<string, string> = {}
        for (const l of leadRows ?? []) srcByLead[l.id] = l.source || 'Sem origem'
        const agg: Record<string, { value: number; noShow: number }> = {}
        for (const a of list) {
          const s = (a.lead_id && srcByLead[a.lead_id]) || 'Sem origem'
          if (!agg[s]) agg[s] = { value: 0, noShow: 0 }
          agg[s].value++
          if (a.status === 'no_show') agg[s].noShow++
        }
        sourceData = Object.entries(agg)
          .map(([name, v]) => ({ name, ...v }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 6)
      }
    }

    // Recovery list (no-show last 7 days)
    const sevenAgo = new Date()
    sevenAgo.setDate(sevenAgo.getDate() - 7)
    const recovery = list
      .filter((a) => a.status === 'no_show' && new Date(a.scheduled_at) >= sevenAgo)
      .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
      .slice(0, 5)
      .map((a) => ({
        id: a.id,
        name: a.lead_name || 'Sem nome',
        date: new Date(a.scheduled_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
      }))

    return {
      kpis: {
        attendanceRate,
        noShowRate,
        cancelRate: pct(cancelado, total),
        noShowValue,
        total,
      },
      attendanceTrend,
      sourceData,
      recovery,
    }
  })

export const getTenantUnits = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from('units').select('id, name').order('name')
    if (error) throw error
    return data ?? []
  })

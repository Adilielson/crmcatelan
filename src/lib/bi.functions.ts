// Server functions for BI / Metas / Relatórios (Phase 1 foundation).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TierEnum = z.enum(["bronze", "gold", "diamond"]);

async function getTenantOrThrow(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("tenant_id, role")
    .eq("id", userId)
    .single();
  if (error || !data) throw new Error("Perfil não encontrado");
  return { tenantId: data.tenant_id as string, role: data.role as string };
}

function assertAdmin(role: string) {
  if (!["admin", "super_admin", "manager"].includes(role)) {
    throw new Error("Apenas administradores ou gerentes podem editar configurações de BI");
  }
}

// ----------------- Consultation types -----------------

export const listConsultationTypes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { tenantId } = await getTenantOrThrow(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("consultation_types")
      .select("id, name, default_value, is_active, created_at")
      .eq("tenant_id", tenantId)
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const UpsertTypeSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80),
  default_value: z.number().nonnegative(),
  is_active: z.boolean().default(true),
});

export const upsertConsultationType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpsertTypeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { tenantId, role } = await getTenantOrThrow(context.supabase, context.userId);
    assertAdmin(role);

    if (data.id) {
      const { error } = await context.supabase
        .from("consultation_types")
        .update({
          name: data.name,
          default_value: data.default_value,
          is_active: data.is_active,
        })
        .eq("id", data.id)
        .eq("tenant_id", tenantId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await context.supabase
      .from("consultation_types")
      .insert({
        tenant_id: tenantId,
        name: data.name,
        default_value: data.default_value,
        is_active: data.is_active,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

export const deleteConsultationType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { tenantId, role } = await getTenantOrThrow(context.supabase, context.userId);
    assertAdmin(role);
    const { error } = await context.supabase
      .from("consultation_types")
      .delete()
      .eq("id", data.id)
      .eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ----------------- Revenue goals -----------------

function monthKey(d: string | Date) {
  const dt = typeof d === "string" ? new Date(d) : d;
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

export const getRevenueGoal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ month: z.string(), unit_id: z.string().uuid().nullable().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { tenantId } = await getTenantOrThrow(context.supabase, context.userId);
    const mk = monthKey(data.month);
    let q = context.supabase
      .from("revenue_goals")
      .select("id, month, bronze, gold, diamond, active_tier, unit_id")
      .eq("tenant_id", tenantId)
      .eq("month", mk);
    q = data.unit_id ? q.eq("unit_id", data.unit_id) : q.is("unit_id", null);
    const { data: row, error } = await q.maybeSingle();
    if (error) throw new Error(error.message);
    return row ?? null;
  });

const UpsertGoalSchema = z.object({
  month: z.string(),
  unit_id: z.string().uuid().nullable().optional(),
  bronze: z.number().nonnegative(),
  gold: z.number().nonnegative(),
  diamond: z.number().nonnegative(),
  active_tier: TierEnum,
});

export const upsertRevenueGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpsertGoalSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { tenantId, role } = await getTenantOrThrow(context.supabase, context.userId);
    assertAdmin(role);
    const payload = {
      tenant_id: tenantId,
      unit_id: data.unit_id ?? null,
      month: monthKey(data.month),
      bronze: data.bronze,
      gold: data.gold,
      diamond: data.diamond,
      active_tier: data.active_tier,
    };
    const { error } = await context.supabase
      .from("revenue_goals")
      .upsert(payload, { onConflict: "tenant_id,unit_id,month" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ----------------- Revenue read -----------------

const PeriodSchema = z.object({
  from: z.string(),
  to: z.string(),
  user_id: z.string().uuid().optional(),
  unit_id: z.string().uuid().optional(),
});

export const getRevenueByPeriod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PeriodSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { tenantId } = await getTenantOrThrow(context.supabase, context.userId);
    let q = context.supabase
      .from("v_revenue_events")
      .select("amount, event_at, user_id, source_type, unit_id, created_by_ai")
      .eq("tenant_id", tenantId)
      .gte("event_at", data.from)
      .lte("event_at", data.to);
    if (data.user_id) q = q.eq("user_id", data.user_id);
    if (data.unit_id) q = q.eq("unit_id", data.unit_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    let totalConsultations = 0;
    let totalGlasses = 0;
    const byUser = new Map<string, { consultations: number; glasses: number; total: number }>();
    for (const r of rows ?? []) {
      const amount = Number(r.amount) || 0;
      if (r.source_type === "consultation") totalConsultations += amount;
      else totalGlasses += amount;
      const uid = (r.user_id as string | null) ?? "__unassigned";
      const cur = byUser.get(uid) ?? { consultations: 0, glasses: 0, total: 0 };
      if (r.source_type === "consultation") cur.consultations += amount;
      else cur.glasses += amount;
      cur.total += amount;
      byUser.set(uid, cur);
    }
    return {
      total: totalConsultations + totalGlasses,
      totalConsultations,
      totalGlasses,
      byUser: Array.from(byUser.entries()).map(([user_id, v]) => ({ user_id, ...v })),
      eventsCount: rows?.length ?? 0,
    };
  });

// ----------------- Goal progress (Phase 2) -----------------

function monthBounds(month: string) {
  const mk = monthKey(month);
  const start = new Date(`${mk}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { from: start.toISOString(), to: end.toISOString(), mk };
}

export const getGoalProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      month: z.string(),
      unit_id: z.string().uuid().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { tenantId } = await getTenantOrThrow(context.supabase, context.userId);
    const { from, to, mk } = monthBounds(data.month);

    let gq = context.supabase
      .from("revenue_goals")
      .select("bronze, gold, diamond, active_tier")
      .eq("tenant_id", tenantId)
      .eq("month", mk);
    gq = data.unit_id ? gq.eq("unit_id", data.unit_id) : gq.is("unit_id", null);
    const { data: goal } = await gq.maybeSingle();

    const tiers = {
      bronze: Number(goal?.bronze ?? 0),
      gold: Number(goal?.gold ?? 0),
      diamond: Number(goal?.diamond ?? 0),
    };
    const activeTier = (goal?.active_tier as "bronze" | "gold" | "diamond" | undefined) ?? "bronze";
    const activeTierValue = tiers[activeTier];

    const { data: sellers } = await context.supabase
      .from("profiles")
      .select("id, full_name, avatar_url, role, status")
      .eq("tenant_id", tenantId)
      .in("role", ["seller", "manager"]);
    const activeSellers = (sellers ?? []).filter(
      (s: any) => !s.status || s.status === "active",
    );
    const activeCount = activeSellers.length || 1;
    const individualGoal = activeTierValue / activeCount;

    let rq = context.supabase
      .from("v_revenue_events")
      .select("amount, user_id, source_type")
      .eq("tenant_id", tenantId)
      .gte("event_at", from)
      .lt("event_at", to);
    if (data.unit_id) rq = rq.eq("unit_id", data.unit_id);
    const { data: events } = await rq;

    let totalRevenue = 0;
    let totalConsultations = 0;
    let totalGlasses = 0;
    const byUser = new Map<string, { consultations: number; glasses: number; total: number }>();
    for (const r of events ?? []) {
      const amt = Number(r.amount) || 0;
      totalRevenue += amt;
      if (r.source_type === "consultation") totalConsultations += amt;
      else totalGlasses += amt;
      const uid = (r.user_id as string | null) ?? "__unassigned";
      const cur = byUser.get(uid) ?? { consultations: 0, glasses: 0, total: 0 };
      if (r.source_type === "consultation") cur.consultations += amt;
      else cur.glasses += amt;
      cur.total += amt;
      byUser.set(uid, cur);
    }

    const ranking = activeSellers
      .map((s: any) => {
        const v = byUser.get(s.id) ?? { consultations: 0, glasses: 0, total: 0 };
        return {
          user_id: s.id,
          full_name: s.full_name ?? "Sem nome",
          avatar_url: s.avatar_url ?? null,
          role: s.role as string,
          consultations: v.consultations,
          glasses: v.glasses,
          total: v.total,
          goal: individualGoal,
          progress: individualGoal > 0 ? v.total / individualGoal : 0,
        };
      })
      .sort((a, b) => b.total - a.total);

    return {
      month: mk,
      tiers,
      activeTier,
      activeTierValue,
      activeSellersCount: activeSellers.length,
      individualGoal,
      totalRevenue,
      totalConsultations,
      totalGlasses,
      storeProgress: activeTierValue > 0 ? totalRevenue / activeTierValue : 0,
      ranking,
    };
  });

// ----------------- Executive dashboard (Phase 3) -----------------

const RangeSchema = z.object({
  from: z.string(),
  to: z.string(),
  unit_id: z.string().uuid().nullable().optional(),
});

export const getExecutiveDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RangeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { tenantId } = await getTenantOrThrow(context.supabase, context.userId);
    const fromISO = new Date(data.from).toISOString();
    const toISO = new Date(data.to).toISOString();

    // Revenue events
    let rq = context.supabase
      .from("v_revenue_events")
      .select("amount, event_at, source_type, created_by_ai")
      .eq("tenant_id", tenantId)
      .gte("event_at", fromISO)
      .lte("event_at", toISO);
    if (data.unit_id) rq = rq.eq("unit_id", data.unit_id);
    const { data: events } = await rq;

    let totalRevenue = 0;
    let consultations = 0;
    let glasses = 0;
    let aiRevenue = 0;
    const byDay = new Map<string, { date: string; consultations: number; glasses: number; total: number }>();
    for (const e of events ?? []) {
      const amt = Number(e.amount) || 0;
      totalRevenue += amt;
      if (e.source_type === "consultation") consultations += amt;
      else glasses += amt;
      if (e.created_by_ai) aiRevenue += amt;
      const day = new Date(e.event_at as string).toISOString().slice(0, 10);
      const cur = byDay.get(day) ?? { date: day, consultations: 0, glasses: 0, total: 0 };
      if (e.source_type === "consultation") cur.consultations += amt;
      else cur.glasses += amt;
      cur.total += amt;
      byDay.set(day, cur);
    }
    const revenueSeries = Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));

    // Leads funnel
    let lq = context.supabase
      .from("leads")
      .select("status, source, utm_source, utm_campaign, created_at, sales_value")
      .eq("tenant_id", tenantId)
      .gte("created_at", fromISO)
      .lte("created_at", toISO);
    const { data: leads } = await lq;
    const funnel = { open: 0, in_progress: 0, scheduled: 0, showed_up: 0, no_show: 0, lost: 0, other: 0 };
    const campaignMap = new Map<string, { campaign: string; leads: number; converted: number; revenue: number }>();
    for (const l of leads ?? []) {
      const s = (l.status as string) ?? "open";
      if (s in funnel) (funnel as any)[s] += 1;
      else funnel.other += 1;
      const key = (l.utm_campaign as string) || (l.source as string) || "Direto";
      const cur = campaignMap.get(key) ?? { campaign: key, leads: 0, converted: 0, revenue: 0 };
      cur.leads += 1;
      if (s === "showed_up") {
        cur.converted += 1;
        cur.revenue += Number(l.sales_value ?? 0) || 0;
      }
      campaignMap.set(key, cur);
    }
    const totalLeads = leads?.length ?? 0;
    const converted = funnel.showed_up;
    const conversionRate = totalLeads > 0 ? converted / totalLeads : 0;
    const topCampaigns = Array.from(campaignMap.values()).sort((a, b) => b.leads - a.leads).slice(0, 10);

    // Marketing spend & CPL/ROI
    const { data: spend } = await context.supabase
      .from("marketing_spend")
      .select("amount, spend_date")
      .eq("tenant_id", tenantId)
      .gte("spend_date", data.from.slice(0, 10))
      .lte("spend_date", data.to.slice(0, 10));
    const totalSpend = (spend ?? []).reduce((acc: number, s: any) => acc + (Number(s.amount) || 0), 0);
    const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
    const cpa = converted > 0 ? totalSpend / converted : 0;
    const roi = totalSpend > 0 ? (totalRevenue - totalSpend) / totalSpend : 0;

    // AI vs human (appointments + messages)
    const { data: appts } = await context.supabase
      .from("appointments")
      .select("created_by_ai")
      .eq("tenant_id", tenantId)
      .gte("created_at", fromISO)
      .lte("created_at", toISO);
    const apptAi = (appts ?? []).filter((a: any) => a.created_by_ai).length;
    const apptHuman = (appts ?? []).length - apptAi;

    const { data: msgs } = await context.supabase
      .from("messages")
      .select("is_from_ai")
      .gte("created_at", fromISO)
      .lte("created_at", toISO);
    const msgAi = (msgs ?? []).filter((m: any) => m.is_from_ai).length;
    const msgHuman = (msgs ?? []).length - msgAi;

    return {
      revenue: {
        total: totalRevenue,
        consultations,
        glasses,
        aiRevenue,
        series: revenueSeries,
      },
      funnel,
      leads: { total: totalLeads, converted, conversionRate },
      marketing: { spend: totalSpend, cpl, cpa, roi, topCampaigns },
      ai: { apptAi, apptHuman, msgAi, msgHuman },
    };
  });

// ----------------- Phase 4 — Operational Reports -----------------

const ReportRangeSchema = z.object({
  from: z.string(),
  to: z.string(),
  unit_id: z.string().uuid().nullable().optional(),
});

/** /relatorios/atendentes — desempenho por atendente no período. */
export const getAttendantsReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ReportRangeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { tenantId } = await getTenantOrThrow(context.supabase, context.userId);
    const fromISO = new Date(data.from).toISOString();
    const toISO = new Date(data.to).toISOString();

    // Times do tenant (sellers + managers).
    const { data: sellers } = await context.supabase
      .from("profiles")
      .select("id, full_name, avatar_url, role, status")
      .eq("tenant_id", tenantId)
      .in("role", ["seller", "manager"]);
    const sellerMap = new Map<string, any>();
    for (const s of sellers ?? []) sellerMap.set(s.id, s);

    // Leads do período (para funil por atendente).
    let lq = context.supabase
      .from("leads")
      .select("id, assigned_user_id, status, sales_value, created_at, closed_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", fromISO)
      .lte("created_at", toISO);
    if (data.unit_id) lq = lq.eq("unit_id", data.unit_id);
    const { data: leads } = await lq;

    type Row = {
      user_id: string;
      full_name: string;
      role: string;
      leads: number;
      scheduled: number;
      showed_up: number;
      no_show: number;
      lost: number;
      revenue_consultations: number;
      revenue_glasses: number;
      revenue_total: number;
      avg_ticket: number;
      conversion_rate: number;
    };
    const byUser = new Map<string, Row>();
    const ensure = (uid: string | null): Row => {
      const key = uid ?? "__unassigned";
      let r = byUser.get(key);
      if (!r) {
        const s = uid ? sellerMap.get(uid) : null;
        r = {
          user_id: key,
          full_name: s?.full_name ?? (uid ? "Sem nome" : "Não atribuído"),
          role: s?.role ?? "—",
          leads: 0,
          scheduled: 0,
          showed_up: 0,
          no_show: 0,
          lost: 0,
          revenue_consultations: 0,
          revenue_glasses: 0,
          revenue_total: 0,
          avg_ticket: 0,
          conversion_rate: 0,
        };
        byUser.set(key, r);
      }
      return r;
    };

    for (const l of leads ?? []) {
      const r = ensure(l.assigned_user_id as string | null);
      r.leads += 1;
      const s = l.status as string;
      if (s === "scheduled" || s === "checked_in" || s === "showed_up") r.scheduled += 1;
      if (s === "showed_up") r.showed_up += 1;
      if (s === "no_show") r.no_show += 1;
      if (s === "lost") r.lost += 1;
    }

    // Receita real do período pela view (independente do created_at do lead).
    let rq = context.supabase
      .from("v_revenue_events")
      .select("amount, user_id, source_type, event_at")
      .eq("tenant_id", tenantId)
      .gte("event_at", fromISO)
      .lte("event_at", toISO);
    if (data.unit_id) rq = rq.eq("unit_id", data.unit_id);
    const { data: events } = await rq;
    for (const e of events ?? []) {
      const r = ensure(e.user_id as string | null);
      const amt = Number(e.amount) || 0;
      if (e.source_type === "consultation") r.revenue_consultations += amt;
      else r.revenue_glasses += amt;
      r.revenue_total += amt;
    }

    for (const r of byUser.values()) {
      r.avg_ticket = r.showed_up > 0 ? r.revenue_total / r.showed_up : 0;
      r.conversion_rate = r.leads > 0 ? r.showed_up / r.leads : 0;
    }

    // Garante que todo seller ativo apareça mesmo sem leads.
    for (const s of sellers ?? []) {
      if (!byUser.has(s.id)) ensure(s.id);
    }

    const rows = Array.from(byUser.values()).sort((a, b) => b.revenue_total - a.revenue_total);
    const totals = rows.reduce(
      (acc, r) => ({
        leads: acc.leads + r.leads,
        scheduled: acc.scheduled + r.scheduled,
        showed_up: acc.showed_up + r.showed_up,
        no_show: acc.no_show + r.no_show,
        lost: acc.lost + r.lost,
        revenue_total: acc.revenue_total + r.revenue_total,
      }),
      { leads: 0, scheduled: 0, showed_up: 0, no_show: 0, lost: 0, revenue_total: 0 },
    );
    return { rows, totals };
  });

/** /relatorios/agendamentos — distribuição por dia, dia da semana, hora. */
export const getAppointmentsReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ReportRangeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { tenantId } = await getTenantOrThrow(context.supabase, context.userId);
    const fromISO = new Date(data.from).toISOString();
    const toISO = new Date(data.to).toISOString();

    let q = context.supabase
      .from("appointments")
      .select("id, scheduled_at, status, value, type_exam, professional_id, unit_id, created_by_ai")
      .eq("tenant_id", tenantId)
      .gte("scheduled_at", fromISO)
      .lte("scheduled_at", toISO);
    if (data.unit_id) q = q.eq("unit_id", data.unit_id);
    const { data: appts, error } = await q;
    if (error) throw new Error(error.message);

    const byDay = new Map<string, number>();
    const byWeekday = Array.from({ length: 7 }, (_, i) => ({ weekday: i, count: 0 }));
    const heatmap: { weekday: number; hour: number; count: number }[] = [];
    const heatmapMap = new Map<string, number>();
    const byStatus = new Map<string, number>();
    const byType = new Map<string, { type: string; count: number; revenue: number }>();
    let aiCount = 0;
    let totalValue = 0;

    for (const a of appts ?? []) {
      const dt = new Date(a.scheduled_at as string);
      const day = dt.toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
      const w = dt.getUTCDay();
      const h = dt.getUTCHours();
      byWeekday[w].count += 1;
      const k = `${w}-${h}`;
      heatmapMap.set(k, (heatmapMap.get(k) ?? 0) + 1);
      const status = (a.status as string) ?? "scheduled";
      byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
      const t = (a.type_exam as string) || "—";
      const cur = byType.get(t) ?? { type: t, count: 0, revenue: 0 };
      cur.count += 1;
      cur.revenue += Number(a.value ?? 0) || 0;
      byType.set(t, cur);
      if (a.created_by_ai) aiCount += 1;
      totalValue += Number(a.value ?? 0) || 0;
    }
    for (const [k, count] of heatmapMap.entries()) {
      const [w, h] = k.split("-").map(Number);
      heatmap.push({ weekday: w, hour: h, count });
    }

    return {
      total: appts?.length ?? 0,
      totalValue,
      aiCount,
      humanCount: (appts?.length ?? 0) - aiCount,
      byDay: Array.from(byDay.entries()).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date)),
      byWeekday,
      heatmap,
      byStatus: Array.from(byStatus.entries()).map(([status, count]) => ({ status, count })),
      byType: Array.from(byType.values()).sort((a, b) => b.count - a.count),
    };
  });

/** /relatorios/comparecimento — taxas de show / no-show / cancelado / remarcou. */
export const getAttendanceReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ReportRangeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { tenantId } = await getTenantOrThrow(context.supabase, context.userId);
    const fromISO = new Date(data.from).toISOString();
    const toISO = new Date(data.to).toISOString();

    let q = context.supabase
      .from("appointments")
      .select("id, scheduled_at, status, reschedule_count, professional_id")
      .eq("tenant_id", tenantId)
      .gte("scheduled_at", fromISO)
      .lte("scheduled_at", toISO);
    if (data.unit_id) q = q.eq("unit_id", data.unit_id);
    const { data: appts, error } = await q;
    if (error) throw new Error(error.message);

    let completed = 0;
    let no_show = 0;
    let cancelled = 0;
    let confirmed = 0;
    let scheduled = 0;
    let rescheduled = 0;
    const byDay = new Map<string, { date: string; completed: number; no_show: number; cancelled: number; total: number }>();
    const byProf = new Map<string, { professional_id: string; completed: number; no_show: number; cancelled: number; total: number }>();

    for (const a of appts ?? []) {
      const s = (a.status as string) ?? "scheduled";
      if (s === "completed") completed += 1;
      else if (s === "no_show") no_show += 1;
      else if (s === "cancelled") cancelled += 1;
      else if (s === "confirmed") confirmed += 1;
      else scheduled += 1;
      if ((a.reschedule_count as number | null) && (a.reschedule_count as number) > 0) rescheduled += 1;

      const day = new Date(a.scheduled_at as string).toISOString().slice(0, 10);
      const dRow = byDay.get(day) ?? { date: day, completed: 0, no_show: 0, cancelled: 0, total: 0 };
      dRow.total += 1;
      if (s === "completed") dRow.completed += 1;
      if (s === "no_show") dRow.no_show += 1;
      if (s === "cancelled") dRow.cancelled += 1;
      byDay.set(day, dRow);

      const pid = (a.professional_id as string | null) ?? "__none";
      const pRow = byProf.get(pid) ?? { professional_id: pid, completed: 0, no_show: 0, cancelled: 0, total: 0 };
      pRow.total += 1;
      if (s === "completed") pRow.completed += 1;
      if (s === "no_show") pRow.no_show += 1;
      if (s === "cancelled") pRow.cancelled += 1;
      byProf.set(pid, pRow);
    }

    // Enriquecer nomes de profissionais.
    const profIds = Array.from(byProf.keys()).filter((id) => id !== "__none");
    let profNames = new Map<string, string>();
    if (profIds.length) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", profIds);
      for (const p of profs ?? []) profNames.set(p.id, p.full_name ?? "Sem nome");
    }

    const total = appts?.length ?? 0;
    const closed = completed + no_show + cancelled;
    return {
      total,
      counts: { completed, no_show, cancelled, confirmed, scheduled, rescheduled },
      rates: {
        show_rate: closed > 0 ? completed / closed : 0,
        no_show_rate: closed > 0 ? no_show / closed : 0,
        cancel_rate: closed > 0 ? cancelled / closed : 0,
        reschedule_rate: total > 0 ? rescheduled / total : 0,
      },
      byDay: Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date)),
      byProfessional: Array.from(byProf.values()).map((p) => ({
        ...p,
        full_name: p.professional_id === "__none" ? "Sem profissional" : (profNames.get(p.professional_id) ?? "—"),
        show_rate: p.total > 0 ? p.completed / p.total : 0,
        no_show_rate: p.total > 0 ? p.no_show / p.total : 0,
      })).sort((a, b) => b.total - a.total),
    };
  });

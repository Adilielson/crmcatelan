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
  if (!["admin", "super_admin"].includes(role)) {
    throw new Error("Apenas administradores podem editar configurações de BI");
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

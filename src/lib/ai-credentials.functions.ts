// Server fns para gerenciar credenciais IA por tenant (Super Admin).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ProviderEnum = z.enum(["openai", "anthropic", "gemini", "lovable"]);

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.role !== "super_admin") {
    throw new Error("Forbidden: super admin required");
  }
}

export const listTenantAiCredentials = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tenants, error: tErr } = await supabaseAdmin
      .from("tenants")
      .select("id, name")
      .order("name");
    if (tErr) throw new Error(tErr.message);

    const { data: creds, error: cErr } = await supabaseAdmin
      .from("tenant_ai_credentials")
      .select("id, tenant_id, provider, key_hint, model_default, monthly_budget_usd, is_active, last_used_at, updated_at");
    if (cErr) throw new Error(cErr.message);

    const { data: usage, error: uErr } = await supabaseAdmin
      .from("tenant_ai_usage_month")
      .select("*");
    if (uErr) console.warn("[ai-creds] view erro:", uErr.message);

    const byTenant: Record<string, any> = {};
    for (const t of tenants ?? []) byTenant[t.id] = { ...t, credentials: [], usage: null };
    for (const c of creds ?? []) byTenant[c.tenant_id]?.credentials.push(c);
    for (const u of (usage as any[]) ?? []) {
      if (byTenant[u.tenant_id]) byTenant[u.tenant_id].usage = u;
    }
    return { tenants: Object.values(byTenant) };
  });

export const upsertTenantAiCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        tenantId: z.string().uuid(),
        provider: ProviderEnum.default("openai"),
        apiKey: z.string().min(20).max(500),
        modelDefault: z.string().min(1).max(100).default("gpt-4o-mini"),
        monthlyBudgetUsd: z.number().min(0).max(100000).default(10),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: id, error } = await supabaseAdmin.rpc("upsert_ai_credential", {
      _tenant_id: data.tenantId,
      _provider: data.provider,
      _api_key: data.apiKey,
      _model_default: data.modelDefault,
      _monthly_budget_usd: data.monthlyBudgetUsd,
    });
    if (error) throw new Error(error.message);
    return { id };
  });

export const toggleTenantAiCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), isActive: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("tenant_ai_credentials")
      .update({ is_active: data.isActive })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testTenantAiCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ tenantId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { getTenantAiKey } = await import("./ai-credentials.server");
    try {
      const resolved = await getTenantAiKey(data.tenantId, "openai");
      const r = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${resolved.apiKey}` },
      });
      if (r.status === 401) {
        return { ok: false, source: resolved.source, status: 401, message: "Chave inválida (401)" };
      }
      if (!r.ok) {
        return { ok: false, source: resolved.source, status: r.status, message: `OpenAI respondeu ${r.status}` };
      }
      return { ok: true, source: resolved.source, model: resolved.model, message: "Conexão OK" };
    } catch (e: any) {
      return { ok: false, source: "none", status: 0, message: e?.message ?? "Falha ao testar" };
    }
  });

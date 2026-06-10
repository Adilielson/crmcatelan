import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
export type BusinessHours = Record<DayKey, [string, string] | null>;

async function getTenantId(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("profiles").select("tenant_id").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.tenant_id) throw new Error("Usuário sem tenant");
  return data.tenant_id as string;
}

export const getBusinessHours = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const tenantId = await getTenantId(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("whatsapp_config")
      .select("business_hours, timezone")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      business_hours: (data?.business_hours as BusinessHours | null) ?? null,
      timezone: (data?.timezone as string | null) ?? "America/Sao_Paulo",
    };
  });

export const updateBusinessHours = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const i = input as { business_hours: BusinessHours; timezone?: string };
    if (!i || typeof i !== "object" || !i.business_hours) {
      throw new Error("business_hours obrigatório");
    }
    return i;
  })
  .handler(async ({ data, context }) => {
    const tenantId = await getTenantId(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("whatsapp_config")
      .update({
        business_hours: data.business_hours,
        timezone: data.timezone || "America/Sao_Paulo",
        updated_at: new Date().toISOString(),
      } as any)
      .eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

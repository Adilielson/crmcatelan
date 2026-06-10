import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
export type BusinessHours = Record<DayKey, [string, string] | null>;

const TENANT_ID = "tenant-1"; // mesmo identificador usado no webhook

export const getBusinessHours = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("whatsapp_config")
      .select("business_hours, timezone")
      .eq("tenant_id", TENANT_ID)
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
    const { error } = await context.supabase
      .from("whatsapp_config")
      .update({
        business_hours: data.business_hours,
        timezone: data.timezone || "America/Sao_Paulo",
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", TENANT_ID);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

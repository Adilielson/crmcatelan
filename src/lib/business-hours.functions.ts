import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
export type BusinessHours = Record<DayKey, [string, string] | null>;

/**
 * Update only the tenant timezone. Bypasses RLS (which restricts UPDATE
 * on `tenants` to super_admin) after verifying the caller is admin/manager
 * of their own tenant.
 */
export const updateTenantTimezone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const i = input as { timezone: string };
    if (!i?.timezone || typeof i.timezone !== "string") {
      throw new Error("timezone obrigatório");
    }
    return { timezone: i.timezone };
  })
  .handler(async ({ data, context }) => {
    const tenantId = await getTenantId(context.supabase, context.userId);

    // Authorize: only admin/manager/super_admin of this tenant
    const { data: profile, error: pErr } = await context.supabase
      .from("profiles")
      .select("role")
      .eq("id", context.userId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    const role = profile?.role as string | undefined;
    if (!role || !["admin", "manager", "super_admin"].includes(role)) {
      throw new Error("Permissão negada para alterar o fuso da loja");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("tenants")
      .update({ timezone: data.timezone, updated_at: new Date().toISOString() } as any)
      .eq("id", tenantId);
    if (error) throw new Error(error.message);
    return { ok: true, timezone: data.timezone };
  });

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

    const [wc, t] = await Promise.all([
      supabaseAdmin
        .from("whatsapp_config")
        .select("business_hours, timezone")
        .eq("tenant_id", tenantId)
        .maybeSingle(),
      supabaseAdmin
        .from("tenants")
        .select("settings")
        .eq("id", tenantId)
        .maybeSingle(),
    ]);

    if (wc.error) throw new Error(wc.error.message);
    if (t.error) throw new Error(t.error.message);

    const settings = (t.data?.settings as Record<string, unknown> | null) ?? {};
    return {
      business_hours: (wc.data?.business_hours as BusinessHours | null) ?? null,
      timezone: (wc.data?.timezone as string | null) ?? "America/Sao_Paulo",
      address: (settings.address as string | null) ?? null,
      instagram: (settings.instagram as string | null) ?? null,
      website: (settings.website as string | null) ?? null,
      facebook: (settings.facebook as string | null) ?? null,
    };
  });

export const updateBusinessHours = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const i = input as {
      business_hours: BusinessHours;
      timezone?: string;
      address?: string;
      instagram?: string;
      website?: string;
      facebook?: string;
    };
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

    const hasSocialUpdate =
      typeof data.address === "string" ||
      typeof data.instagram === "string" ||
      typeof data.website === "string" ||
      typeof data.facebook === "string";

    if (hasSocialUpdate) {
      const { data: t } = await supabaseAdmin
        .from("tenants")
        .select("settings")
        .eq("id", tenantId)
        .maybeSingle();
      const settings = ((t?.settings as Record<string, unknown> | null) ?? {});
      if (typeof data.address === "string") settings.address = data.address;
      if (typeof data.instagram === "string") settings.instagram = data.instagram;
      if (typeof data.website === "string") settings.website = data.website;
      if (typeof data.facebook === "string") settings.facebook = data.facebook;
      const { error: upErr } = await supabaseAdmin
        .from("tenants")
        .update({ settings, timezone: data.timezone || "America/Sao_Paulo", updated_at: new Date().toISOString() } as any)
        .eq("id", tenantId);
      if (upErr) throw new Error(upErr.message);
    }

    return { ok: true };
  });

/**
 * Resolve IANA timezone from a free-form address using public APIs:
 *  1) Nominatim (OpenStreetMap) -> lat/lng (with abbreviation expansion + fallbacks)
 *  2) timeapi.io -> IANA timezone
 * Helpers live in business-hours.server.ts so the server-fn split transform
 * doesn't strip them.
 */
export const resolveTimezoneFromAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const i = input as { address: string };
    if (!i?.address || typeof i.address !== "string" || i.address.trim().length < 5) {
      throw new Error("Endereço inválido");
    }
    return { address: i.address.trim() };
  })
  .handler(async ({ data }) => {
    const { geocodeAddress } = await import("./business-hours.server");
    const hit = await geocodeAddress(data.address);
    if (!hit) {
      throw new Error(
        `Endereço não encontrado no mapa. Tente incluir cidade e estado (ex.: "Rua X, 100, Campo Grande - MS").`,
      );
    }
    const { lat, lon, display_name } = hit;

    const tzUrl = `https://timeapi.io/api/TimeZone/coordinate?latitude=${lat}&longitude=${lon}`;
    const tzRes = await fetch(tzUrl, { headers: { Accept: "application/json" } });
    if (!tzRes.ok) throw new Error("Falha ao resolver fuso (timeapi.io)");
    const tz = (await tzRes.json()) as { timeZone?: string };
    if (!tz?.timeZone) throw new Error("Fuso não retornado pela API");

    return {
      timezone: tz.timeZone,
      lat: Number(lat),
      lon: Number(lon),
      display_name,
    };
  });



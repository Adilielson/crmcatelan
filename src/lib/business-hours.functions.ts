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
    };
  });

export const updateBusinessHours = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const i = input as { business_hours: BusinessHours; timezone?: string; address?: string };
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

    if (typeof data.address === "string") {
      const { data: t } = await supabaseAdmin
        .from("tenants")
        .select("settings")
        .eq("id", tenantId)
        .maybeSingle();
      const settings = ((t?.settings as Record<string, unknown> | null) ?? {});
      settings.address = data.address;
      const { error: upErr } = await supabaseAdmin
        .from("tenants")
        .update({ settings, timezone: data.timezone || "America/Sao_Paulo", updated_at: new Date().toISOString() } as any)
        .eq("id", tenantId);
      if (upErr) throw new Error(upErr.message);
    }

    return { ok: true };
  });

/**
 * Normalize common Brazilian address abbreviations for better Nominatim hits.
 */
function normalizeAddress(input: string): string {
  return input
    .replace(/\bR\.\s*/gi, "Rua ")
    .replace(/\bAv\.\s*/gi, "Avenida ")
    .replace(/\bAl\.\s*/gi, "Alameda ")
    .replace(/\bTv\.\s*/gi, "Travessa ")
    .replace(/\bPç\.\s*/gi, "Praça ")
    .replace(/\bJorn\.\s*/gi, "Jornalista ")
    .replace(/\bDr\.\s*/gi, "Doutor ")
    .replace(/\bDra\.\s*/gi, "Doutora ")
    .replace(/\bProf\.\s*/gi, "Professor ")
    .replace(/\bCel\.\s*/gi, "Coronel ")
    .replace(/\bCap\.\s*/gi, "Capitão ")
    .replace(/\bGen\.\s*/gi, "General ")
    .replace(/\bSto\.\s*/gi, "Santo ")
    .replace(/\bSta\.\s*/gi, "Santa ")
    .replace(/\bS\.\s*/gi, "São ")
    .replace(/\bConj\.\s*/gi, "")
    .replace(/\bJd\.\s*/gi, "Jardim ")
    .replace(/\bVl\.\s*/gi, "Vila ")
    .replace(/\bnº?\.?\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function nominatimSearch(params: Record<string, string>) {
  const qs = new URLSearchParams({
    format: "json",
    limit: "1",
    addressdetails: "1",
    ...params,
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${qs}`, {
    headers: {
      "User-Agent": "OticaCatelanCRM/1.0 (timezone-resolver)",
      "Accept-Language": "pt-BR",
    },
  });
  if (!res.ok) return [];
  const arr = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  return Array.isArray(arr) ? arr : [];
}

/**
 * Resolve IANA timezone from a free-form address using public APIs:
 *  1) Nominatim (OpenStreetMap) -> lat/lng (with abbreviation expansion + fallbacks)
 *  2) timeapi.io -> IANA timezone
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
    const normalized = normalizeAddress(data.address);

    // Attempt 1: full normalized free-form query
    let hits = await nominatimSearch({ q: normalized });

    // Attempt 2: strip CEP / postal code and try again
    if (hits.length === 0) {
      const noCep = normalized.replace(/,?\s*\d{5}-?\d{3}\b/g, "").trim();
      if (noCep !== normalized) hits = await nominatimSearch({ q: noCep });
    }

    // Attempt 3: try structured street/city/state parsing from the tail
    if (hits.length === 0) {
      // Heuristic: last comma-separated chunk contains "Cidade - UF"
      const parts = normalized.split(",").map((p) => p.trim()).filter(Boolean);
      const cityState = parts.find((p) => /-\s*[A-Z]{2}\b/.test(p));
      if (cityState) {
        const [city, uf] = cityState.split(/\s*-\s*/);
        const street = parts[0];
        hits = await nominatimSearch({
          street: street || "",
          city: (city || "").replace(/\d{5}-?\d{3}/, "").trim(),
          state: (uf || "").replace(/\d{5}-?\d{3}/, "").trim(),
          country: "Brazil",
        });
        // Attempt 4: just city + state
        if (hits.length === 0) {
          hits = await nominatimSearch({
            q: `${city}, ${uf}, Brasil`,
          });
        }
      }
    }

    if (hits.length === 0) {
      throw new Error(`Endereço não encontrado no mapa. Tente incluir cidade e estado (ex: "Rua X, 100, Campo Grande - MS").`);
    }

    const { lat, lon, display_name } = hits[0];

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


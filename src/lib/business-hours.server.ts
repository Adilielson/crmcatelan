/**
 * Server-only helpers for business-hours + address/timezone resolution.
 * Kept out of business-hours.functions.ts to avoid the TanStack server-fn
 * split transform stripping sibling module-scope declarations.
 */

/**
 * Normalize common Brazilian address abbreviations for better Nominatim hits.
 */
export function normalizeAddress(input: string): string {
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

export async function nominatimSearch(params: Record<string, string>) {
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
  if (!res.ok) return [] as Array<{ lat: string; lon: string; display_name: string }>;
  const arr = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  return Array.isArray(arr) ? arr : [];
}

export async function geocodeAddress(address: string) {
  const normalized = normalizeAddress(address);

  let hits = await nominatimSearch({ q: normalized });

  if (hits.length === 0) {
    const noCep = normalized.replace(/,?\s*\d{5}-?\d{3}\b/g, "").trim();
    if (noCep !== normalized) hits = await nominatimSearch({ q: noCep });
  }

  if (hits.length === 0) {
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
      if (hits.length === 0) {
        hits = await nominatimSearch({ q: `${city}, ${uf}, Brasil` });
      }
    }
  }

  return hits[0] ?? null;
}

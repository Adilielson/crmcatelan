// TODO(auth): substituir por requireSupabaseAuth + tenant do profile real
// quando o Supabase Auth for implementado. Hoje o app usa um auth mock
// (src/hooks/use-auth.ts) com DEV_TENANT_ID hardcoded.
//
// Em dev, SUPABASE_SERVICE_ROLE_KEY não está disponível no runtime do
// TanStack Start, então usamos a publishable key + policies anon
// restritas ao DEV_TENANT_ID (ver migração dev_anon_access_*).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const DEV_TENANT_ID = "00000000-0000-0000-0000-000000000001";

let _client: SupabaseClient<Database> | undefined;

export async function getDevSupabase(): Promise<SupabaseClient<Database>> {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase URL/Publishable Key ausentes no runtime do servidor (dev).",
    );
  }
  _client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

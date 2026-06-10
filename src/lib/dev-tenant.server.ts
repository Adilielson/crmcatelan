// TODO(auth): substituir por requireSupabaseAuth + tenant do profile real
// quando o Supabase Auth for implementado. Hoje o app usa um auth mock
// (src/hooks/use-auth.ts) com DEV_TENANT_ID hardcoded.
export const DEV_TENANT_ID = "00000000-0000-0000-0000-000000000001";

export async function getDevSupabase() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

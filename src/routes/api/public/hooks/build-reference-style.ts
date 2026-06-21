// Cron diário: reconstrói o style profile da Raiana (e demais referências) para cada tenant.
// Chamado por pg_cron com header apikey = anon key.
import { createFileRoute } from "@tanstack/react-router";
import { buildStyleProfileCore } from "@/lib/ai-style.functions";

export const Route = createFileRoute("/api/public/hooks/build-reference-style")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey") ?? "";
        const expected = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
        if (!expected || apiKey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Lista tenants que têm ao menos 1 agente-referência ativo
        const { data: refs, error } = await supabaseAdmin
          .from("profiles")
          .select("tenant_id")
          .eq("is_reference_agent", true)
          .eq("status", "active");
        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }
        const tenantIds = Array.from(new Set((refs ?? []).map((r: any) => r.tenant_id).filter(Boolean)));

        const results: Array<{ tenant_id: string; ok: boolean; reason?: string; sample_count?: number }> = [];
        for (const tid of tenantIds) {
          try {
            const r = await buildStyleProfileCore(tid as string, { force: true });
            results.push({ tenant_id: tid as string, ok: !!r.ok, reason: (r as any).reason, sample_count: (r as any).sample_count });
          } catch (e: any) {
            results.push({ tenant_id: tid as string, ok: false, reason: e?.message ?? "error" });
          }
        }

        return Response.json({ ok: true, processed: results.length, results });
      },
    },
  },
});

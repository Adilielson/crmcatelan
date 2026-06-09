// Edge Function: whatsapp-webhook
// Recebe eventos push da API uazapi (status de conexão, mensagens)
// URL: {SUPABASE_URL}/functions/v1/whatsapp-webhook?tenant_id=tenant-1

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  // Aceita GET para health check
  if (req.method === "GET") {
    return new Response(JSON.stringify({ ok: true, service: "whatsapp-webhook" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  try {
    const url = new URL(req.url);
    const tenantId = url.searchParams.get("tenant_id") || "tenant-1";

    const body = await req.json().catch(() => ({}));
    console.log(`[webhook] tenant=${tenantId} event=${body.event} connected=${body.connected}`);

    const isConnected =
      body.event === "connection" ||
      body.status === "CONNECTED" ||
      body.connected === true;

    const isDisconnected =
      body.event === "disconnected" ||
      body.status === "DISCONNECTED" ||
      (body.event === "connection" && body.connected === false);

    // Atualiza status de conexão no banco
    if (isConnected && !isDisconnected) {
      await adminClient
        .from("whatsapp_config")
        .update({ is_connected: true, updated_at: new Date().toISOString() })
        .eq("tenant_id", tenantId);
      console.log(`[webhook] ${tenantId} → connected`);
    } else if (isDisconnected) {
      await adminClient
        .from("whatsapp_config")
        .update({ is_connected: false, updated_at: new Date().toISOString() })
        .eq("tenant_id", tenantId);
      console.log(`[webhook] ${tenantId} → disconnected`);
    }

    // Log mensagens recebidas
    if (body.event === "messages" && body.data) {
      const msg = body.data;
      if (!msg.fromMe) {
        await adminClient.from("whatsapp_message_logs").insert({
          tenant_id: tenantId,
          recipient_phone: String(msg.from || msg.chatId || "unknown"),
          message_type: String(msg.type || "text"),
          status: "received",
          error_message: null,
        });
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[webhook] error:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});

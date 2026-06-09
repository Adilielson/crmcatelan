// Edge Function: whatsapp-webhook
// Recebe eventos push da API uazapi (status de conexão, mensagens)
// URL: {SUPABASE_URL}/functions/v1/whatsapp-webhook?tenant_id=tenant-1

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function boolish(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (["true", "connected", "open", "online", "logged", "logged_in", "authenticated"].includes(normalized)) return true;
    if (["false", "disconnected", "close", "closed", "offline", "logout", "logged_out"].includes(normalized)) return false;
  }
  return null;
}

function connectionState(payload: unknown): boolean | null {
  const body = asObject(payload);
  const data = asObject(body.data);
  const instance = asObject(body.instance ?? data.instance);
  return boolish(body.connected) ?? boolish(body.status) ?? boolish(body.state) ??
    boolish(data.connected) ?? boolish(data.status) ?? boolish(data.state) ??
    boolish(instance.connected) ?? boolish(instance.status) ?? boolish(instance.state);
}

function messagePayload(payload: unknown) {
  const body = asObject(payload);
  const data = asObject(body.data);
  const message = asObject(data.message ?? body.message ?? data);
  return { body, data, message };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Aceita GET para health check
  if (req.method === "GET") {
    return new Response(JSON.stringify({ ok: true, service: "whatsapp-webhook" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const tenantId = url.searchParams.get("tenant_id") || "tenant-1";

    const body = await req.json().catch(() => ({}));
    const { body: bodyObject, data, message } = messagePayload(body);
    const eventName = String(bodyObject.event ?? bodyObject.type ?? data.event ?? data.type ?? "").toLowerCase();
    const connected = connectionState(body);
    console.log(`[webhook] tenant=${tenantId} event=${eventName || "unknown"} connected=${connected}`);

    // Atualiza status de conexão no banco
    if (connected === true) {
      await adminClient
        .from("whatsapp_config")
        .update({
          is_connected: true,
          connected_phone: String(bodyObject.phone ?? data.phone ?? message.from ?? "") || null,
          connected_name: String(bodyObject.name ?? data.name ?? "") || null,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tenantId);
      console.log(`[webhook] ${tenantId} → connected`);
    } else if (connected === false) {
      await adminClient
        .from("whatsapp_config")
        .update({ is_connected: false, connected_phone: null, connected_name: null, updated_at: new Date().toISOString() })
        .eq("tenant_id", tenantId);
      console.log(`[webhook] ${tenantId} → disconnected`);
    }

    // Log mensagens recebidas
    if (["messages", "message", "message.received"].includes(eventName) || message.from || message.chatId) {
      if (message.fromMe !== true && bodyObject.fromMe !== true && data.fromMe !== true) {
        await adminClient.from("whatsapp_message_logs").insert({
          tenant_id: tenantId,
          recipient_phone: String(message.from || message.chatId || data.from || data.chatId || "unknown"),
          message_type: String(message.type || data.type || "text"),
          status: "received",
          error_message: null,
        });
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[webhook] error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

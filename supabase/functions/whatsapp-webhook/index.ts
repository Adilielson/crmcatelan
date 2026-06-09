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

function pickString(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
}

function extractText(msg: Record<string, unknown>): string | null {
  // Uazapi pode mandar text em vários formatos
  return pickString(
    msg.text,
    msg.body,
    msg.content,
    msg.caption,
    (asObject(msg.message) as any).conversation,
    (asObject(msg.message) as any).text,
    (asObject(asObject(msg.message).extendedTextMessage) as any).text,
  );
}

function digitsOnly(s: string | null): string | null {
  if (!s) return null;
  const d = s.replace(/\D+/g, "");
  return d || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
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
    let tenantId = url.searchParams.get("tenant_id") || "tenant-1";
    if (tenantId.includes("/")) tenantId = tenantId.split("/")[0];

    const body = await req.json().catch(() => ({}));
    const b = asObject(body);
    const eventType = String(b.EventType ?? b.event ?? b.type ?? "").toLowerCase();
    const chat = asObject(b.chat);
    const message = asObject(b.message);
    const owner = pickString(b.owner);

    console.log(`[webhook] tenant=${tenantId} event=${eventType} keys=${Object.keys(b).join(",")}`);

    // ── Connection events ──────────────────────────────────────────────────
    if (eventType.includes("connect") || eventType === "status") {
      const connected = String(b.status ?? b.state ?? "").toLowerCase();
      const isConn = ["connected", "open", "online", "logged_in"].includes(connected);
      const isDis = ["disconnected", "close", "closed", "offline", "logout"].includes(connected);
      if (isConn || isDis) {
        await adminClient
          .from("whatsapp_config")
          .update({ is_connected: isConn, updated_at: new Date().toISOString() })
          .eq("tenant_id", tenantId);
      }
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Message events ─────────────────────────────────────────────────────
    if (eventType.includes("message") || message.id || chat.id) {
      const fromMe = message.fromMe === true || b.fromMe === true;

      // Identifica remetente
      const senderRaw = pickString(
        message.sender,
        message.from,
        message.author,
        chat.id,
        chat.wa_chatid,
        b.sender,
      );
      const senderPhone = digitsOnly(senderRaw);
      const senderName = pickString(message.senderName, chat.name, chat.wa_name, chat.pushName, b.senderName) || senderPhone || "Desconhecido";
      const text = extractText(message) || extractText(b);
      const msgType = pickString(message.type, message.messageType, b.messageType) || "text";

      console.log(`[webhook] msg fromMe=${fromMe} from=${senderPhone} name=${senderName} type=${msgType} text=${(text || "").slice(0, 80)}`);

      if (!fromMe && senderPhone) {
        // Loga no whatsapp_message_logs (visível no CRM)
        const { error: logErr } = await adminClient.from("whatsapp_message_logs").insert({
          tenant_id: tenantId,
          recipient_phone: senderPhone,
          message_type: msgType,
          status: "received",
          error_message: text ? text.slice(0, 500) : null,
        });
        if (logErr) console.error("[webhook] log insert error:", logErr.message);
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

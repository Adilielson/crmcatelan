// Edge Function: whatsapp-manage
// Todas as chamadas ao uazapi passam por aqui (evita CORS no browser)
// Token nunca sai do servidor — lido do banco com service_role_key

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const UAZAPI_BASE_URL = "https://ipazua.uazapi.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getToken(tenantId: string): Promise<string> {
  const { data, error } = await adminClient
    .from("whatsapp_config")
    .select("instance_token")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(`DB: ${error.message}`);
  if (!data?.instance_token) throw new Error("Token não configurado. Salve o token primeiro.");
  return data.instance_token;
}

async function uazapiGet(path: string, token: string) {
  const res = await fetch(`${UAZAPI_BASE_URL}${path}`, {
    method: "GET",
    headers: { "Content-Type": "application/json", "token": token },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`uazapi${path}: HTTP ${res.status} — ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

async function uazapiPost(path: string, token: string, body?: unknown) {
  const res = await fetch(`${UAZAPI_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "token": token },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`uazapi${path}: HTTP ${res.status} — ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

async function uazapiDelete(path: string, token: string) {
  const res = await fetch(`${UAZAPI_BASE_URL}${path}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", "token": token },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`uazapi${path}: HTTP ${res.status} — ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, tenant_id } = body;

    if (!action) return json({ error: "Missing action" }, 400);
    if (!tenant_id) return json({ error: "Missing tenant_id" }, 400);

    const token = await getToken(tenant_id);

    // ── Verificar status da instância ──────────────────────────────────────
    if (action === "check-status") {
      const data = await uazapiGet("/instance/info", token);
      const connected =
        data.connected === true ||
        data.instance?.status === "connected" ||
        data.status === "connected";
      await adminClient
        .from("whatsapp_config")
        .update({ is_connected: connected, updated_at: new Date().toISOString() })
        .eq("tenant_id", tenant_id);
      return json({ connected, phone: data.phone ?? null, name: data.name ?? null });
    }

    // ── Obter QR Code ──────────────────────────────────────────────────────
    if (action === "qrcode") {
      // Tenta /instance/connect (retorna QR OU connected:true)
      const res = await fetch(`${UAZAPI_BASE_URL}/instance/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "token": token },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      const connected =
        data.connected === true || data.instance?.status === "connected";
      const qrcode = data.instance?.qrcode || data.qrcode || null;
      if (connected) {
        await adminClient
          .from("whatsapp_config")
          .update({ is_connected: true, updated_at: new Date().toISOString() })
          .eq("tenant_id", tenant_id);
      }
      return json({ connected, qrcode });
    }

    // ── Desconectar ────────────────────────────────────────────────────────
    if (action === "disconnect") {
      try {
        await uazapiDelete("/instance/logout", token);
      } catch (e) {
        console.warn("logout API ignorado:", e);
      }
      await adminClient
        .from("whatsapp_config")
        .update({ is_connected: false, updated_at: new Date().toISOString() })
        .eq("tenant_id", tenant_id);
      return json({ success: true });
    }

    // ── Registrar webhook ──────────────────────────────────────────────────
    if (action === "register-webhook") {
      const webhookUrl = `${SUPABASE_URL}/functions/v1/whatsapp-webhook?tenant_id=${tenant_id}`;
      try {
        await uazapiPost("/webhook", token, {
          url: webhookUrl,
          enabled: true,
          active: true,
          byApi: true,
          addUrlEvents: true,
          addUrlTypesMessages: true,
          excludeMessages: ["wasSentByApi", "isGroupYes"],
          events: ["connection", "messages", "messages_update", "presence"],
        });
        await adminClient
          .from("whatsapp_config")
          .update({ webhook_registered: true, updated_at: new Date().toISOString() })
          .eq("tenant_id", tenant_id);
      } catch (e) {
        console.warn("register-webhook error:", e);
        return json({ success: false, error: String(e) });
      }
      return json({ success: true, webhookUrl });
    }

    // ── Enviar texto ───────────────────────────────────────────────────────
    if (action === "send-text") {
      const { phone, message } = body;
      if (!phone || !message) return json({ error: "phone e message são obrigatórios" }, 400);
      const data = await uazapiPost("/message/sendText", token, {
        number: phone,
        text: message,
      });
      return json(data);
    }

    // ── Enviar imagem ──────────────────────────────────────────────────────
    if (action === "send-image") {
      const { phone, imageUrl, caption } = body;
      if (!phone || !imageUrl) return json({ error: "phone e imageUrl são obrigatórios" }, 400);
      const data = await uazapiPost("/message/sendImage", token, {
        number: phone,
        imageUrl,
        caption: caption ?? "",
      });
      return json(data);
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("whatsapp-manage error:", msg);
    return json({ error: msg }, 500);
  }
});

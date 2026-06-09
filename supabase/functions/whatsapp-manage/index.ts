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

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function normalizeConnected(payload: unknown): boolean {
  const data = asObject(payload);
  const instance = asObject(data.instance);
  const statusObj = asObject(data.status);
  const instanceStatusObj = asObject(instance.status);

  if (data.connected === true || instance.connected === true) return true;
  if (statusObj.connected === true || statusObj.loggedIn === true) return true;
  if (instanceStatusObj.connected === true || instanceStatusObj.loggedIn === true) return true;

  const candidates = [
    typeof data.status === "string" ? data.status : null,
    typeof data.state === "string" ? data.state : null,
    typeof data.connection === "string" ? data.connection : null,
    typeof instance.status === "string" ? instance.status : null,
    typeof instance.state === "string" ? instance.state : null,
  ].filter((v): v is string => !!v).map((v) => v.toLowerCase());

  const connectedStates = ["connected", "open", "online", "logged", "logged_in", "authenticated"];
  return candidates.some((s) => connectedStates.includes(s));
}

function normalizeQRCode(payload: unknown): string | null {
  const data = asObject(payload);
  const instance = asObject(data.instance);
  const qrcode = data.qrcode ?? data.qrCode ?? data.qr ?? data.base64 ?? instance.qrcode ?? instance.qrCode ?? instance.qr;

  if (!qrcode) return null;
  if (typeof qrcode === "string") return qrcode;

  const qrObject = asObject(qrcode);
  const base64 = qrObject.base64 ?? qrObject.code ?? qrObject.data;
  return typeof base64 === "string" ? base64 : null;
}

function normalizeInstanceInfo(payload: unknown) {
  const data = asObject(payload);
  const instance = asObject(data.instance);
  return {
    phone: String(data.phone ?? data.number ?? instance.phone ?? instance.number ?? "") || null,
    name: String(data.name ?? instance.name ?? "") || null,
  };
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

async function parseUazapiResponse(path: string, res: Response) {
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!res.ok) {
    const body = typeof data === "object" && data ? JSON.stringify(data) : text;
    throw new Error(`uazapi${path}: HTTP ${res.status} — ${body.slice(0, 500)}`);
  }

  return data ?? {};
}

async function uazapiGet(path: string, token: string) {
  const res = await fetch(`${UAZAPI_BASE_URL}${path}`, {
    method: "GET",
    headers: { "Content-Type": "application/json", "token": token },
  });
  return parseUazapiResponse(path, res);
}

async function uazapiPost(path: string, token: string, body?: unknown) {
  const res = await fetch(`${UAZAPI_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "token": token },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  return parseUazapiResponse(path, res);
}

async function uazapiDelete(path: string, token: string) {
  const res = await fetch(`${UAZAPI_BASE_URL}${path}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", "token": token },
  });
  return parseUazapiResponse(path, res);
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

    // ── Verificar status ───────────────────────────────────────────────────
    if (action === "check-status") {
      const data = await uazapiGet("/instance/status", token);
      const connected = normalizeConnected(data);
      const info = normalizeInstanceInfo(data);
      await adminClient
        .from("whatsapp_config")
        .update({
          is_connected: connected,
          connected_phone: connected ? info.phone : null,
          connected_name: connected ? info.name : null,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tenant_id);
      return json({ connected, ...info, raw_status: data });
    }

    // ── Conectar / QR Code ─────────────────────────────────────────────────
    if (action === "qrcode") {
      const data = await uazapiPost("/instance/connect", token);
      const connected = normalizeConnected(data);
      const qrcode = connected ? null : normalizeQRCode(data);
      const info = normalizeInstanceInfo(data);
      await adminClient
        .from("whatsapp_config")
        .update({
          is_connected: connected,
          connected_phone: connected ? info.phone : null,
          connected_name: connected ? info.name : null,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tenant_id);
      return json({ connected, qrcode, ...info });
    }

    // ── Desconectar ────────────────────────────────────────────────────────
    if (action === "disconnect") {
      try {
        await uazapiPost("/instance/disconnect", token, {});
      } catch (e) {
        console.warn("disconnect API ignorado:", e);
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
          addUrlEvents: true,
          events: ["connection", "messages", "qrcode"],
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
      const data = await uazapiPost("/send/text", token, {
        number: phone,
        text: message,
      });
      return json(data);
    }

    // ── Enviar imagem ──────────────────────────────────────────────────────
    if (action === "send-image") {
      const { phone, imageUrl, caption } = body;
      if (!phone || !imageUrl) return json({ error: "phone e imageUrl são obrigatórios" }, 400);
      const data = await uazapiPost("/send/media", token, {
        number: phone,
        type: "image",
        file: imageUrl,
        text: caption ?? "",
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

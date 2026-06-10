// Edge Function: whatsapp-webhook
// Recebe eventos push da API uazapi (status de conexão, mensagens)
// URL: {SUPABASE_URL}/functions/v1/whatsapp-webhook?tenant_id=tenant-1

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const UAZAPI_BASE_URL = "https://ipazua.uazapi.com";

const SDR_SYSTEM_PROMPT = `Você é a IA SDR de uma ótica brasileira. Seu papel é qualificar leads do WhatsApp de forma rápida, calorosa e profissional.

OBJETIVOS:
1. Cumprimentar e identificar o nome do cliente.
2. Descobrir a necessidade: óculos de grau, solar, lentes de contato, ajuste, conserto, ou exame de vista.
3. Se for grau/lentes, perguntar se tem receita recente (até 1 ano).
4. Sugerir agendar uma visita à loja ou consulta com optometrista.
5. Capturar telefone alternativo / e-mail só se o cliente oferecer.

ESTILO:
- Mensagens curtas (1 a 3 linhas no máximo).
- Tom humano, simpático, sem emojis exagerados (no máximo 1 por mensagem).
- Sempre em português do Brasil.
- Uma pergunta por vez.
- Nunca invente preços nem promessas. Se o cliente insistir em valor, diga que vai confirmar com a equipe.

Se a conversa já indicou que o cliente quer agendar, confirme dia/turno preferido e diga que um atendente humano dará sequência.`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ── Helpers de IA + envio ────────────────────────────────────────────────
async function generateSdrReply(history: { role: "user" | "assistant"; content: string }[]): Promise<string | null> {
  if (!LOVABLE_API_KEY) {
    console.error("[sdr] LOVABLE_API_KEY ausente");
    return null;
  }
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": LOVABLE_API_KEY,
        "X-Lovable-AIG-SDK": "edge-function",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SDR_SYSTEM_PROMPT },
          ...history,
        ],
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error(`[sdr] gateway ${res.status}: ${txt.slice(0, 300)}`);
      return null;
    }
    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content;
    return typeof reply === "string" && reply.trim() ? reply.trim() : null;
  } catch (e) {
    console.error("[sdr] erro chamando gateway:", e instanceof Error ? e.message : String(e));
    return null;
  }
}

async function sendWhatsAppText(token: string, phone: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(`${UAZAPI_BASE_URL}/send/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token },
      body: JSON.stringify({ number: phone, text }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[sdr] uazapi send ${res.status}: ${body.slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[sdr] erro enviando whatsapp:", e instanceof Error ? e.message : String(e));
    return false;
  }
}


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

// Limpa um identificador de WhatsApp (JID ou telefone) e devolve apenas o número.
// Retorna null se não for um telefone individual válido (10-13 dígitos).
function cleanPhone(raw: string | null): string | null {
  if (!raw) return null;
  // Descarta grupos (@g.us) e broadcast
  if (raw.includes("@g.us") || raw.includes("broadcast") || raw.includes("status@")) return null;
  // Remove sufixos JID e device-id: "5527...@s.whatsapp.net", "5527...:1@..."
  const noSuffix = raw.split("@")[0].split(":")[0];
  const d = noSuffix.replace(/\D+/g, "");
  if (d.length < 10 || d.length > 13) return null;
  return d;
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
    const sender = asObject(b.sender);

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
      const fromMe = message.fromMe === true || b.fromMe === true || chat.fromMe === true;

      // Tenta vários campos onde o telefone do contato pode estar.
      // Prioriza chat.id (que normalmente é o JID do contato real).
      const candidates = [
        chat.id, chat.wa_chatid, chat.jid, chat.remoteJid, chat.phone, chat.wa_id,
        sender.id, sender.jid, sender.phone, sender.wa_id,
        message.chatId, message.remoteJid, message.from, message.sender, message.author,
        b.sender, b.from, b.phone, b.chatId, b.remoteJid,
      ];
      let senderPhone: string | null = null;
      for (const c of candidates) {
        const cleaned = cleanPhone(pickString(c));
        if (cleaned) { senderPhone = cleaned; break; }
      }

      const senderName = pickString(
        chat.name, chat.wa_name, chat.pushName, chat.notifyName, chat.verifiedName,
        sender.name, sender.pushName, sender.notifyName,
        message.senderName, message.pushName, message.notifyName,
        b.senderName, b.pushName,
      );

      const senderAvatarUrl = pickString(
        chat.image, chat.imageUrl, chat.imgUrl, chat.profilePicUrl, chat.profilePicture,
        chat.picture, chat.avatar, chat.photo,
        sender.image, sender.imageUrl, sender.profilePicUrl, sender.avatar, sender.photo,
        b.image, b.profilePicUrl, b.avatar,
      );

      const text = extractText(message) || extractText(b);
      const msgType = pickString(message.type, message.messageType, b.messageType) || "text";

      console.log(`[webhook] msg fromMe=${fromMe} phone=${senderPhone} name=${senderName} avatar=${senderAvatarUrl ? "yes" : "no"} text=${(text || "").slice(0, 80)}`);

      if (!fromMe && senderPhone) {
        const { error: logErr } = await adminClient.from("whatsapp_message_logs").insert({
          tenant_id: tenantId,
          recipient_phone: senderPhone,
          message_type: msgType,
          status: "received",
          error_message: text ? text.slice(0, 500) : null,
          sender_name: senderName,
          sender_avatar_url: senderAvatarUrl,
        });
        if (logErr) console.error("[webhook] log insert error:", logErr.message);

        // ── IA SDR: gera e envia resposta automaticamente ────────────────
        if (text && text.trim()) {
          try {
            // 1) Busca token da instância
            const { data: cfg } = await adminClient
              .from("whatsapp_config")
              .select("instance_token, is_connected")
              .eq("tenant_id", tenantId)
              .maybeSingle();

            if (!cfg?.instance_token || !cfg.is_connected) {
              console.log("[sdr] pulado: whatsapp não conectado ou sem token");
            } else {
              // 2) Carrega últimas 10 mensagens dessa conversa pra contexto
              const { data: hist } = await adminClient
                .from("whatsapp_message_logs")
                .select("status, error_message, sent_at")
                .eq("tenant_id", tenantId)
                .eq("recipient_phone", senderPhone)
                .order("sent_at", { ascending: false })
                .limit(10);

              const history = (hist ?? [])
                .reverse()
                .filter((m) => m.error_message && m.error_message.trim())
                .map((m) => ({
                  role: m.status === "sent" ? ("assistant" as const) : ("user" as const),
                  content: m.error_message as string,
                }));

              // 3) Chama Lovable AI Gateway
              const reply = await generateSdrReply(history);
              if (reply) {
                // 4) Envia pelo WhatsApp
                const sent = await sendWhatsAppText(cfg.instance_token, senderPhone, reply);
                // 5) Loga a resposta da IA
                await adminClient.from("whatsapp_message_logs").insert({
                  tenant_id: tenantId,
                  recipient_phone: senderPhone,
                  message_type: "text",
                  status: sent ? "sent" : "failed",
                  error_message: reply.slice(0, 500),
                  sender_name: "IA SDR",
                });
                console.log(`[sdr] resposta ${sent ? "enviada" : "falhou"} para ${senderPhone}`);
              }
            }
          } catch (e) {
            console.error("[sdr] erro:", e instanceof Error ? e.message : String(e));
          }
        }
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

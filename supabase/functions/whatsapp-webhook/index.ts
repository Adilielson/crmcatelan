// Edge Function: whatsapp-webhook
// Recebe eventos push da API uazapi (status de conexão, mensagens)
// URL: {SUPABASE_URL}/functions/v1/whatsapp-webhook?tenant_id=00000000-0000-0000-0000-000000000001

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AGENT_TOOLS, executeToolCall, listAvailableSlots } from "./agent-tools.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const UAZAPI_BASE_URL = "https://ipazua.uazapi.com";
const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";

const FALLBACK_SYSTEM_PROMPT = `Você é a IA SDR de uma ótica brasileira. Seja breve, humano, em português do BR. Uma pergunta por vez. Nunca invente preços.`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ── Monta o system prompt a partir do ai_configs ────────────────────────
// Regras vivem em ./prompt-rules.ts para serem cobertas por testes de regressão.
import { composeBehaviorRules, validateOutgoingReply } from "./prompt-rules.ts";
function buildSystemFromConfig(cfg: any, knowledgeTexts: string[]): string {
  const parts: string[] = [cfg?.prompt_system?.trim() || FALLBACK_SYSTEM_PROMPT];

  // Regras: núcleo imutável de fábrica + ajustes do tenant (ADITIVO).
  // Antes o campo do banco SUBSTITUÍA as regras de fábrica quando tinha mais
  // de 20 caracteres — um "seja mais simpática" apagava as 14 regras.
  parts.push(composeBehaviorRules(typeof cfg?.behavior_rules === "string" ? cfg.behavior_rules : null));

  if (cfg?.goal) {
    const goalMap: Record<string, string> = {
      appointment: "agendar exame de vista com nosso profissional",
      qualification: "qualificar o lead",
      support: "dar suporte",
    };
    parts.push(`Objetivo principal: ${goalMap[cfg.goal] ?? cfg.goal}.`);
  }
  if (cfg?.scheduling_link) parts.push(`Link de agendamento: ${cfg.scheduling_link}`);

  if (cfg?.knowledge_base_faq?.trim()) parts.push(`FAQ:\n${cfg.knowledge_base_faq}`);
  if (knowledgeTexts.length) parts.push(`DOCUMENTOS DE REFERÊNCIA:\n${knowledgeTexts.join("\n---\n").slice(0, 6000)}`);
  if (cfg?.sample_scripts?.trim()) parts.push(`EXEMPLOS DE ATENDIMENTO:\n${cfg.sample_scripts}`);
  const qs = Array.isArray(cfg?.qualification_questions) ? cfg.qualification_questions : [];
  if (qs.length) parts.push(`PERGUNTAS DE QUALIFICAÇÃO (faça uma por vez, na ordem):\n${qs.map((q: string, i: number) => `${i + 1}. ${q}`).join("\n")}`);
  if (cfg?.rejection_instructions?.trim()) parts.push(`O QUE NÃO FAZER:\n${cfg.rejection_instructions}`);
  const r = Array.isArray(cfg?.response_restrictions) ? cfg.response_restrictions : [];
  if (r.length) parts.push(`Restrições: ${r.join(", ")}`);

  // Sem bloco "REGRAS MESTRAS": as regras já são únicas e não se contradizem.
  return parts.join("\n\n");
}


// ── Helpers de IA + envio ────────────────────────────────────────────────
// Resolve provider: prioridade para credencial OpenAI do tenant (BYO key).
// Fallback: Lovable AI Gateway (LOVABLE_API_KEY).
type AiEndpoint = { url: string; headers: Record<string, string>; model: string; provider: "openai" | "lovable" };
async function resolveAiEndpoint(tenantId: string | null): Promise<AiEndpoint | null> {
  if (tenantId) {
    try {
      const { data, error } = await adminClient.rpc("get_active_ai_credential", {
        _tenant_id: tenantId,
        _provider: "openai",
      });
      const row = Array.isArray(data) ? data[0] : data;
      if (!error && row?.api_key) {
        return {
          url: "https://api.openai.com/v1/chat/completions",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${row.api_key}`,
          },
          model: row.model_default || "gpt-4o-mini",
          provider: "openai",
        };
      }
    } catch (e) {
      console.warn("[sdr] falha ao buscar credencial do tenant:", e instanceof Error ? e.message : String(e));
    }
  }
  if (!LOVABLE_API_KEY) return null;
  return {
    url: "https://ai.gateway.lovable.dev/v1/chat/completions",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": LOVABLE_API_KEY,
      "X-Lovable-AIG-SDK": "edge-function",
    },
    model: "openai/gpt-5-mini",
    provider: "lovable",
  };
}

async function generateSdrReply(
  systemPrompt: string,
  history: { role: "user" | "assistant"; content: string }[],
  contextNote: string | undefined,
  temperature: number,
  toolCtx: { tenantId: string; leadId: string | null; leadName: string | null; leadPhone: string } | null,
): Promise<string | null> {
  const endpoint = await resolveAiEndpoint(toolCtx?.tenantId ?? null);
  if (!endpoint) {
    console.error("[sdr] nenhum provedor de IA disponível (sem credencial do tenant e sem LOVABLE_API_KEY)");
    return null;
  }
  console.log(`[sdr] provider=${endpoint.provider} model=${endpoint.model}`);
  try {
    const systemMessages: { role: "system"; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];
    if (contextNote) systemMessages.push({ role: "system", content: contextNote });

    // Loop de function-calling — máx 4 iterações
    const messages: any[] = [...systemMessages, ...history];
    const useTools = !!toolCtx;
    let repaired = false;

    for (let iter = 0; iter < 6; iter++) {
      // gpt-5* / o1 / o3 só aceitam temperature=1
      const fixedTempModel = /(gpt-5|o1|o3)/i.test(endpoint.model);
      const body: Record<string, unknown> = {
        model: endpoint.model,
        messages,
        temperature: fixedTempModel ? 1 : temperature,
      };
      if (useTools) {
        body.tools = AGENT_TOOLS;
        body.tool_choice = "auto";
      }

      const res = await fetch(endpoint.url, {
        method: "POST",
        headers: endpoint.headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const txt = await res.text();
        console.error(`[sdr] ${endpoint.provider} ${res.status}: ${txt.slice(0, 300)}`);
        return null;
      }
      const data = await res.json();
      const msg = data?.choices?.[0]?.message;
      const toolCalls = msg?.tool_calls;

      if (Array.isArray(toolCalls) && toolCalls.length > 0 && useTools) {
        // Anexa a mensagem do assistant (com tool_calls) e resultados
        messages.push(msg);
        for (const tc of toolCalls) {
          const name = tc?.function?.name;
          const argsJson = tc?.function?.arguments ?? "{}";
          console.log(`[sdr:tool] iter=${iter} lead=${toolCtx!.leadId} call=${name} args=${String(argsJson).slice(0, 200)}`);
          const result = await executeToolCall(adminClient, toolCtx!, name, argsJson);
          console.log(`[sdr:tool] iter=${iter} result=${result.slice(0, 200)}`);
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: result,
          });
        }
        continue; // pede a próxima geração à IA com os resultados
      }

      const raw = msg?.content;
      const reply = typeof raw === "string" && raw.trim() ? raw.trim() : null;
      if (!reply) return null;

      // Guarda-corpo de runtime: valida a resposta antes de enviar.
      const check = validateOutgoingReply(reply);
      if (check.ok) return reply;

      console.warn(`[sdr] resposta violou regras: ${check.reasons.join(" | ")}`);
      if (repaired) return reply; // já tentamos uma vez — envia mesmo assim (nunca silêncio)
      repaired = true;
      messages.push(msg);
      messages.push({
        role: "system",
        content:
          `Sua última resposta violou as regras obrigatórias: ${check.reasons.join("; ")}. ` +
          "Reescreva a mesma mensagem corrigindo essas violações, mantendo o tom e o objetivo. " +
          "Máximo UMA pergunta, sem termos proibidos, sem perguntas genéricas.",
      });
      continue;
    }
    console.warn("[sdr] loop de tools esgotou as iterações");
    return null;
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

// Hand-off silencioso: se um atendente humano enviou qualquer mensagem para
// este número nos últimos 30 min, a IA não intervém — a conversa está sendo
// conduzida por uma pessoa. Considera "humano" qualquer outbound cujo
// sender_name NÃO seja "IA SDR".
const HUMAN_ACTIVE_WINDOW_MS = 30 * 60_000;
async function humanRecentlyActive(
  admin: ReturnType<typeof createClient>,
  tenantId: string,
  phone: string,
): Promise<boolean> {
  try {
    const since = new Date(Date.now() - HUMAN_ACTIVE_WINDOW_MS).toISOString();
    const { data } = await admin
      .from("whatsapp_message_logs")
      .select("sender_name")
      .eq("tenant_id", tenantId)
      .eq("recipient_phone", phone)
      .eq("status", "sent")
      .gte("sent_at", since)
      .order("sent_at", { ascending: false })
      .limit(5);
    return (data ?? []).some((r: any) => {
      const s = String(r?.sender_name ?? "").trim();
      return s.length > 0 && s !== "IA SDR";
    });
  } catch (e) {
    // Fail-CLOSED: na dúvida, a IA não responde (evita atropelar atendente humano).
    console.warn("[sdr] humanRecentlyActive falhou (fail-closed, IA não responde):", e instanceof Error ? e.message : String(e));
    return true;
  }
}


// ── Horário de expediente ─────────────────────────────────────────────────
type BusinessHours = Record<string, [string, string] | null>;
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_LABEL_PT: Record<string, string> = {
  sun: "domingo", mon: "segunda", tue: "terça", wed: "quarta",
  thu: "quinta", fri: "sexta", sat: "sábado",
};

function getLocalDayAndMinutes(date: Date, timezone: string): { dayKey: string; minutes: number } {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
    });
    const parts = fmt.formatToParts(date);
    const wk = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
    const hh = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
    const mm = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
    const map: Record<string, string> = { Sun: "sun", Mon: "mon", Tue: "tue", Wed: "wed", Thu: "thu", Fri: "fri", Sat: "sat" };
    return { dayKey: map[wk] ?? "mon", minutes: hh * 60 + mm };
  } catch {
    const d = date.getUTCDay();
    return { dayKey: DAY_KEYS[d], minutes: date.getUTCHours() * 60 + date.getUTCMinutes() };
  }
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

function buildHoursContext(hours: BusinessHours | null, timezone: string): string {
  if (!hours) return "";
  const now = new Date();
  const { dayKey, minutes } = getLocalDayAndMinutes(now, timezone);
  const today = hours[dayKey];
  const isOpen = !!today && minutes >= toMin(today[0]) && minutes < toMin(today[1]);

  let nextLabel = "em breve";
  for (let i = 0; i < 7; i++) {
    const idx = (DAY_KEYS.indexOf(dayKey) + i) % 7;
    const k = DAY_KEYS[idx];
    const slot = hours[k];
    if (!slot) continue;
    if (i === 0 && minutes < toMin(slot[0])) { nextLabel = `hoje às ${slot[0]}`; break; }
    if (i > 0) { nextLabel = `${DAY_LABEL_PT[k]} às ${slot[0]}`; break; }
  }

  const todayStr = today ? `${today[0]}–${today[1]}` : "fechado";
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  const dateParts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(now);
  const nowLabel = `AGORA é ${dateParts}, ${hh}:${mm} (${DAY_LABEL_PT[dayKey] ?? dayKey}, fuso ${timezone}). Use ESTA DATA E ESTE ANO para calcular agendamentos e quanto falta antes de oferecer lembretes ou orientações temporais.`;
  if (isOpen) {
    return `${nowLabel}\nCONTEXTO DE HORÁRIO: estamos DENTRO do expediente. Horário de hoje: ${todayStr}. Você PODE oferecer transferir para um atendente humano.`;
  }
  return `${nowLabel}\nCONTEXTO DE HORÁRIO: estamos FORA do expediente. Horário de hoje: ${todayStr}. Próxima abertura: ${nextLabel}. NÃO ofereça transferir para atendente humano agora. Em vez disso, ofereça agendar exame de vista com nosso profissional ou diga que a equipe responderá no próximo horário útil.`;
}



function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

/** Mascara telefone: mantém só os 4 últimos dígitos. */
function maskPhone(v: unknown): string | null {
  const s = typeof v === "string" || typeof v === "number" ? String(v) : "";
  const digits = s.replace(/\D/g, "");
  if (!digits) return null;
  return `***${digits.slice(-4)}`;
}

/**
 * Log de debug sem PII: só metadados do evento. Nunca grava o corpo da
 * mensagem nem o telefone completo.
 */
function maskWebhookPayload(b: Record<string, unknown>): Record<string, unknown> {
  const chat = asObject(b.chat);
  const message = asObject(b.message);
  const sender = asObject(b.sender);
  const text = typeof message.text === "string" ? message.text : "";
  return {
    keys: Object.keys(b),
    event_type: b.EventType ?? b.event ?? b.type ?? null,
    message_type: message.messageType ?? message.type ?? null,
    message_id: message.id ?? message.messageid ?? null,
    from_me: message.fromMe ?? null,
    has_media: !!(message.mediaUrl ?? message.file ?? message.content),
    text_length: text.length,
    chat_id: maskPhone(chat.id ?? chat.wa_chatid ?? message.chatid),
    sender_id: maskPhone(sender.id ?? message.sender),
    status: b.status ?? b.state ?? null,
  };
}



function pickString(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
}

function extractText(msg: Record<string, unknown>): string | null {
  // uazapi às vezes envia `content` como string JSON: '{"text":"...","contextInfo":...}'
  // — extrai o `text` interno quando for o caso.
  const tryParseContent = (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    const trimmed = v.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("{") && trimmed.includes('"text"')) {
      try {
        const parsed = JSON.parse(trimmed) as Record<string, unknown>;
        const inner = pickString(parsed.text, parsed.body, parsed.caption,
          (asObject(parsed.message) as any)?.conversation);
        if (inner) return inner;
      } catch { /* fallthrough */ }
    }
    return trimmed;
  };
  const msgMsg = asObject(msg.message);
  const ext = asObject(msgMsg.extendedTextMessage);
  return (
    pickString(msg.text, msg.body, msg.caption) ||
    tryParseContent(msg.content) ||
    pickString(
      msgMsg.conversation,
      msgMsg.text,
      msgMsg.body,
      msgMsg.caption,
      ext.text,
      (asObject(msgMsg.imageMessage) as any).caption,
      (asObject(msgMsg.videoMessage) as any).caption,
      (asObject(msgMsg.documentMessage) as any).caption,
    )
  );
}

function extractMedia(msg: Record<string, unknown>, root: Record<string, unknown>): { url: string | null; mime: string | null; kind: string | null } {
  const m = asObject(msg.message);
  const content = asObject(msg.content); // uazapi: message.content.{URL,mimetype}
  const url = pickString(
    (content as any).URL, (content as any).url,
    msg.mediaUrl, msg.media_url, msg.fileUrl, msg.file_url, msg.url,
    (msg as any).imageUrl, (msg as any).audioUrl, (msg as any).videoUrl,
    root.mediaUrl, root.media_url, root.fileUrl, root.file_url,
    (m as any).url, (m as any).mediaUrl,
    (asObject(m.imageMessage) as any).url,
    (asObject(m.audioMessage) as any).url,
    (asObject(m.videoMessage) as any).url,
    (asObject(m.documentMessage) as any).url,
  );
  const mime = pickString(
    (content as any).mimetype,
    msg.mimetype, msg.mime, msg.contentType,
    root.mimetype, root.mime,
    (asObject(m.imageMessage) as any).mimetype,
    (asObject(m.audioMessage) as any).mimetype,
    (asObject(m.videoMessage) as any).mimetype,
    (asObject(m.documentMessage) as any).mimetype,
  );
  // uazapi: mediaType = "image" | "ptt" | "audio" | "video" | "document" | "sticker"
  const mediaType = (pickString(msg.mediaType, msg.messageType) || "").toLowerCase();
  let kind: string | null = null;
  if (mediaType.includes("ptt") || mediaType.includes("audio")) kind = "audio";
  else if (mediaType.includes("sticker") || mediaType.includes("image")) kind = "image";
  else if (mediaType.includes("video")) kind = "video";
  else if (mediaType.includes("document")) kind = "document";
  if (!kind && mime) {
    const base = mime.split(";")[0].trim();
    if (base.startsWith('image/')) kind = 'image';
    else if (base.startsWith('audio/')) kind = 'audio';
    else if (base.startsWith('video/')) kind = 'video';
    else kind = 'document';
  }
  return { url, mime, kind };
}

// Extrai contexto de anúncio (Click-to-WhatsApp) do payload ───────────
// A uazapi propaga o referral do Meta em variações como:
//   message.contextInfo.externalAdReply
//   message.ctwaContext / message.adReply
//   b.ctwaContext / b.referral
// Quando o lead vem de um anúncio do Meta com botão "Enviar mensagem",
// esses campos trazem id do anúncio, título, thumb, sourceUrl e ctwa_clid.
type AdContext = {
  ad_id: string | null;
  ad_name: string | null;
  ad_headline: string | null;
  ad_body: string | null;
  ad_thumbnail_url: string | null;
  ad_source_url: string | null;
  ad_media_type: string | null;
  ctwa_clid: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
};

function parseUtmsFromUrl(url: string | null): Partial<AdContext> {
  if (!url) return {};
  try {
    const u = new URL(url);
    const g = (k: string) => u.searchParams.get(k);
    return {
      utm_source: g("utm_source"),
      utm_medium: g("utm_medium"),
      utm_campaign: g("utm_campaign"),
      utm_content: g("utm_content"),
      utm_term: g("utm_term"),
    };
  } catch {
    return {};
  }
}

function extractAdContext(message: Record<string, unknown>, root: Record<string, unknown>): AdContext | null {
  const ctxInfo = asObject((message as any).contextInfo ?? (message as any).context);
  const ear = asObject((ctxInfo as any).externalAdReply);
  const ctwa = asObject(
    (message as any).ctwaContext ?? (message as any).adReply ??
    (message as any).referral ?? (message as any).referralMessage ??
    (root as any).ctwaContext ?? (root as any).referral ?? (root as any).adReply ??
    (root as any).referralMessage ?? (root as any).source,
  );

  const ad_id = pickString(
    (ear as any).sourceId, (ear as any).source_id,
    (ctwa as any).sourceId, (ctwa as any).source_id,
    (ctwa as any).ad_id, (ctwa as any).adId, (ctwa as any).source_id,
    (root as any).ad_id, (root as any).adId,
  );
  const ad_name = pickString(
    (ear as any).sourceName, (ctwa as any).sourceName,
    (ear as any).title, (ctwa as any).title,
    (ctwa as any).ad_name, (ctwa as any).adName,
    (root as any).ad_name, (root as any).adName,
  );
  const ad_headline = pickString((ear as any).title, (ctwa as any).headline);
  const ad_body = pickString((ear as any).body, (ctwa as any).body, (ctwa as any).description);
  const ad_thumbnail_url = pickString(
    (ear as any).thumbnailUrl, (ear as any).thumbnail_url, (ear as any).thumbnail,
    (ctwa as any).thumbnailUrl, (ctwa as any).thumbnail_url, (ctwa as any).image_url,
    (ctwa as any).media_url,
  );
  const ad_source_url = pickString(
    (ear as any).sourceUrl, (ear as any).source_url,
    (ctwa as any).sourceUrl, (ctwa as any).source_url, (ctwa as any).url,
  );
  const ad_media_type = pickString(
    (ear as any).mediaType, (ear as any).media_type,
    (ctwa as any).mediaType, (ctwa as any).media_type,
    (ear as any).sourceType, (ctwa as any).sourceType,
  );
  const ctwa_clid = pickString(
    (ctwa as any).ctwa_clid, (ctwa as any).ctwaClid, (ctwa as any).clid,
    (ear as any).ctwa_clid, (root as any).ctwa_clid,
  );

  const utms = parseUtmsFromUrl(ad_source_url);
  const utm_source = pickString((root as any).utm_source, (message as any).utm_source, (ctwa as any).utm_source) ?? utms.utm_source ?? null;
  const utm_medium = pickString((root as any).utm_medium, (message as any).utm_medium, (ctwa as any).utm_medium) ?? utms.utm_medium ?? null;
  const utm_campaign = pickString((root as any).utm_campaign, (message as any).utm_campaign, (ctwa as any).utm_campaign) ?? utms.utm_campaign ?? null;
  const utm_content = pickString((root as any).utm_content, (message as any).utm_content, (ctwa as any).utm_content) ?? utms.utm_content ?? null;
  const utm_term = pickString((root as any).utm_term, (message as any).utm_term, (ctwa as any).utm_term) ?? utms.utm_term ?? null;

  const hasAny = ad_id || ad_name || ad_headline || ad_source_url || ad_thumbnail_url || ctwa_clid ||
    utm_source || utm_medium || utm_campaign || utm_content || utm_term;
  if (!hasAny) return null;

  return {
    ad_id, ad_name, ad_headline, ad_body, ad_thumbnail_url, ad_source_url, ad_media_type, ctwa_clid,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
  };
}

// Baixa/descriptografa mídia via uazapi (URLs mmg.whatsapp.net são criptografadas
// e não abrem no navegador). Retorna uma URL pública utilizável ou null.
async function downloadMediaViaUazapi(instanceToken: string, messageId: string): Promise<string | null> {
  try {
    const res = await fetch(`${UAZAPI_BASE_URL}/message/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token: instanceToken },
      body: JSON.stringify({ id: messageId, return_base64: false }),
    });
    if (!res.ok) {
      console.error(`[media] download ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return null;
    }
    const data = asObject(await res.json().catch(() => ({})));
    return pickString(
      (data as any).fileURL, (data as any).fileUrl, (data as any).url,
      (data as any).link, (data as any).mediaUrl,
      (asObject((data as any).file) as any).url,
    );
  } catch (e) {
    console.error("[media] download erro:", e instanceof Error ? e.message : String(e));
    return null;
  }
}

// ── Persistência de mídia no Storage (histórico permanente) ─────────────
const MEDIA_BUCKET = "whatsapp-media";
let bucketEnsured = false;
async function ensureMediaBucket(): Promise<void> {
  if (bucketEnsured) return;
  try {
    const { data } = await adminClient.storage.getBucket(MEDIA_BUCKET);
    if (!data) {
      await adminClient.storage.createBucket(MEDIA_BUCKET, {
        public: false,
        fileSizeLimit: 50 * 1024 * 1024,
      });
      console.log(`[storage] bucket ${MEDIA_BUCKET} criado`);
    }
    bucketEnsured = true;
  } catch (e) {
    console.error("[storage] ensureBucket erro:", e instanceof Error ? e.message : String(e));
  }
}

function extFromMime(mime: string | null | undefined): string {
  if (!mime) return "bin";
  const m = mime.split(";")[0].trim().toLowerCase();
  const map: Record<string, string> = {
    "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp",
    "image/gif": "gif", "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a",
    "audio/aac": "aac", "audio/wav": "wav", "video/mp4": "mp4", "video/webm": "webm",
    "video/quicktime": "mov", "application/pdf": "pdf",
  };
  if (map[m]) return map[m];
  const slash = m.indexOf("/");
  return slash > 0 ? (m.slice(slash + 1).replace(/[^a-z0-9]+/g, "") || "bin") : "bin";
}

// Baixa a mídia da URL temporária e salva permanentemente no Storage.
async function persistMediaToStorage(
  tenantId: string,
  mediaUrl: string,
  mime: string | null,
): Promise<{ path: string; mime: string } | null> {
  try {
    await ensureMediaBucket();
    const res = await fetch(mediaUrl);
    if (!res.ok) {
      console.error(`[storage] fetch mídia ${res.status}`);
      return null;
    }
    const finalMime = mime || res.headers.get("content-type") || "application/octet-stream";
    const bytes = new Uint8Array(await res.arrayBuffer());
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    const id = crypto.randomUUID();
    const path = `${tenantId}/${yyyy}/${mm}/${id}.${extFromMime(finalMime)}`;
    const { error } = await adminClient.storage.from(MEDIA_BUCKET).upload(path, bytes, {
      contentType: finalMime,
      upsert: false,
    });
    if (error) {
      console.error("[storage] upload erro:", error.message);
      return null;
    }
    console.log(`[storage] mídia salva: ${path} (${bytes.length} bytes)`);
    return { path, mime: finalMime };
  } catch (e) {
    console.error("[storage] persistMedia erro:", e instanceof Error ? e.message : String(e));
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Transcrição de áudio (voice notes / audio messages) ──────────
// Usamos Google Gemini via chat/completions com input_audio (aceita ogg
// nativamente); openai/gpt-4o-mini-transcribe rejeita OGG/Opus.
// ─────────────────────────────────────────────────────────────────────────
function audioFormatFromMime(mime: string | null | undefined): string | null {
  if (!mime) return null;
  const m = mime.split(";")[0].trim().toLowerCase();
  if (m.startsWith("audio/ogg") || m.includes("opus")) return "ogg";
  if (m === "audio/mpeg" || m === "audio/mp3") return "mp3";
  if (m === "audio/wav" || m === "audio/x-wav") return "wav";
  if (m === "audio/mp4" || m === "audio/m4a" || m === "audio/x-m4a") return "m4a";
  if (m === "audio/webm") return "webm";
  if (m === "audio/aac") return "aac";
  if (m === "audio/flac") return "flac";
  return null;
}

async function transcribeAudioFromUrl(
  mediaUrl: string,
  mime: string | null | undefined,
): Promise<string | null> {
  if (!LOVABLE_API_KEY) {
    console.warn("[stt] LOVABLE_API_KEY ausente — pulando transcrição");
    return null;
  }
  const fmt = audioFormatFromMime(mime);
  if (!fmt) {
    console.warn(`[stt] formato de áudio não suportado: ${mime}`);
    return null;
  }
  try {
    const res = await fetch(mediaUrl);
    if (!res.ok) {
      console.warn(`[stt] fetch áudio falhou: ${res.status}`);
      return null;
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length < 512) {
      console.warn("[stt] áudio muito curto/vazio");
      return null;
    }
    // Cap ~15 MiB pra evitar payloads absurdos
    if (bytes.length > 15 * 1024 * 1024) {
      console.warn("[stt] áudio > 15MiB, pulando");
      return null;
    }
    // base64 em chunks (evita stack overflow com apply)
    let bin = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    const b64 = btoa(bin);

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Lovable-API-Key": LOVABLE_API_KEY,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Transcreva literalmente o áudio a seguir para português do Brasil. Retorne SOMENTE o texto falado, sem comentários, sem introdução, sem timestamps." },
              { type: "input_audio", input_audio: { data: b64, format: fmt } },
            ],
          },
        ],
        temperature: 0,
      }),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      console.error(`[stt] gateway ${resp.status}: ${body.slice(0, 300)}`);
      return null;
    }
    const j = await resp.json();
    const text = String(j?.choices?.[0]?.message?.content ?? "").trim();
    if (!text) return null;
    console.log(`[stt] transcrição ok (${text.length} chars): ${text.slice(0, 120)}`);
    return text;
  } catch (e) {
    console.error("[stt] erro:", e instanceof Error ? e.message : String(e));
    return null;
  }
}

// Busca foto de perfil do contato via uazapi (POST /chat/GetNameAndImageURL).
// Retorna URL pública (CDN da uazapi/WhatsApp). Pode retornar null se o contato
// não tiver foto, se a privacidade impedir, ou se o endpoint falhar.
async function fetchUazapiContactImage(
  instanceToken: string,
  phone: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${UAZAPI_BASE_URL}/chat/GetNameAndImageURL`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token: instanceToken,
      },
      body: JSON.stringify({ number: phone, preview: false }),
    });
    if (!res.ok) {
      console.warn(`[avatar] uazapi ${res.status} para ${phone}`);
      return null;
    }
    const data = await res.json().catch(() => ({}));
    const url = pickString(
      data?.image, data?.imageUrl, data?.imgUrl, data?.profilePicUrl,
      data?.picture, data?.url, data?.result?.image, data?.result?.imageUrl,
    );
    return url || null;
  } catch (e) {
    console.warn("[avatar] fetch erro:", e instanceof Error ? e.message : String(e));
    return null;
  }
}

// Baixa a foto de perfil e salva permanentemente no Storage (bucket whatsapp-media)
// em avatars/{tenantId}/{phone}.{ext}. Devolve o storage path.
async function persistAvatarToStorage(
  tenantId: string,
  phone: string,
  imageUrl: string,
): Promise<{ path: string; mime: string } | null> {
  try {
    await ensureMediaBucket();
    const res = await fetch(imageUrl);
    if (!res.ok) return null;
    const mime = res.headers.get("content-type") || "image/jpeg";
    const bytes = new Uint8Array(await res.arrayBuffer());
    const path = `avatars/${tenantId}/${phone}.${extFromMime(mime)}`;
    const { error } = await adminClient.storage
      .from(MEDIA_BUCKET)
      .upload(path, bytes, { contentType: mime, upsert: true });
    if (error) {
      console.error("[avatar] upload erro:", error.message);
      return null;
    }
    return { path, mime };
  } catch (e) {
    console.warn("[avatar] persist erro:", e instanceof Error ? e.message : String(e));
    return null;
  }
}


// Limpa um identificador de WhatsApp (JID ou telefone) e devolve apenas o número.
// Retorna null se não for um telefone individual válido (10-13 dígitos).
function cleanPhone(raw: string | null): string | null {
  if (!raw) return null;
  // Descarta grupos (@g.us) e broadcast
  if (raw.includes("@g.us") || raw.includes("broadcast") || raw.includes("status@")) return null;
  // Remove sufixos JID e device-id: "5527...@s.whatsapp.net", "5527...:1@..."
  const noSuffix = raw.split("@")[0].split(":")[0];
  // Rejeita identificadores internos da uazapi como "r1c11cee3080708" —
  // ao remover letras, resultam em uma sequência de dígitos que pode ter
  // 10-13 caracteres e ser erroneamente tratada como telefone brasileiro.
  // Um telefone real só contém dígitos e caracteres de formatação
  // ( +, -, espaço, parênteses e ponto).
  if (/[a-zA-Z]/.test(noSuffix)) return null;
  let d = noSuffix.replace(/\D+/g, "");
  if (d.length < 10 || d.length > 13) return null;
  // Normaliza para sempre ter DDI 55 (BR) quando o número vier sem código de país.
  // 10 dígitos = DDD + fixo; 11 dígitos = DDD + celular. Ambos sem DDI → prepend 55.
  if ((d.length === 10 || d.length === 11) && !d.startsWith("55")) {
    d = "55" + d;
  }
  return d;
}

// Termos que indicam nome COMERCIAL / de empresa (não é primeiro nome de pessoa).
// Se o pushName do WhatsApp contém qualquer um destes, tratamos como lixo e
// forçamos a IA a perguntar o nome real do cliente na conversa.
const BUSINESS_NAME_TERMS = [
  /\bborracharia\b/i, /\blava\s*(motos|jato|r[áa]pido|car)?\b/i, /\boficina\b/i,
  /\bmec[âa]nica\b/i, /\bmercado\b/i, /\bmercadinho\b/i, /\bloja\b/i, /\blojas\b/i,
  /\brestaurante\b/i, /\blanchonete\b/i, /\bpizzaria\b/i, /\bpadaria\b/i,
  /\bfarm[áa]cia\b/i, /\bcl[íi]nica\b/i, /\bcons[óo]rcio\b/i, /\bimobili[áa]ria\b/i,
  /\bpet\s*shop\b/i, /\bhotel\b/i, /\bpousada\b/i, /\bsal[ãa]o\b/i, /\bbarbearia\b/i,
  /\bacademia\b/i, /\bescrit[óo]rio\b/i, /\bcompanhia\b/i, /\bempresa\b/i,
  /\bltda\b/i, /\bltd\b/i, /\bs\/?a\b/i, /\beireli\b/i, /\bmei\b/i, /\bme\b/i,
  /\bcomercial\b/i, /\bcom[ée]rcio\b/i, /\bdistribuidora\b/i, /\brevendedora?\b/i,
  /\bautopeças?\b/i, /\bauto\s+peças?\b/i, /\bposto\b/i, /\bsupermercado\b/i,
  /\btransporte[s]?\b/i, /\bconstrutora\b/i, /\bengenharia\b/i, /\bcontabilidade\b/i,
];

function looksLikeBusinessName(name: string | null): boolean {
  if (!name) return false;
  return BUSINESS_NAME_TERMS.some((rx) => rx.test(name));
}

// Valida se um "nome" enviado pelo WhatsApp parece um nome real
// (não é só dígitos, não é o próprio telefone, não é JID, não é nome de empresa).
function isValidContactName(name: string | null, phone: string | null): boolean {
  if (!name) return false;
  const n = name.trim();
  if (n.length < 2 || n.length > 80) return false;
  if (/^\d+$/.test(n)) return false;
  if (n.includes("@")) return false;
  if (phone && n.replace(/\D+/g, "") === phone) return false;
  // Precisa ter pelo menos uma vogal — descarta lixo tipo "hhhdh", "kkk", "zzzz".
  if (!/[aeiouáéíóúâêôãõà]/i.test(n)) return false;
  // Descarta sequências de 5+ consoantes seguidas (nomes reais raramente têm isso).
  if (/[bcdfghjklmnpqrstvwxyzç]{5,}/i.test(n)) return false;
  // Descarta nomes de empresa (Borracharia, Lava Motos, Oficina, etc).
  if (looksLikeBusinessName(n)) return false;
  return true;
}

// Detecta se um nome já salvo parece lixo/placeholder (ex: pushName ruim do WhatsApp).
// Usado para permitir sobrescrever quando o cliente disser o nome real na conversa.
function looksLikeJunkName(name: string | null): boolean {
  if (!name) return true;
  const n = name.trim();
  if (n.length < 3) return true;
  if (!/[aeiouáéíóúâêôãõà]/i.test(n)) return true;
  if (/[bcdfghjklmnpqrstvwxyzç]{4,}/i.test(n)) return true;
  // Tudo em uma letra repetida (hhh, kkkk)
  if (/^(.)\1+$/i.test(n.replace(/\s+/g, ""))) return true;
  // Nome de empresa também é lixo para tratamento pessoal.
  if (looksLikeBusinessName(n)) return true;
  return false;
}


// Extrai o primeiro nome de uma string completa
function firstName(full: string | null | undefined): string | null {
  if (!full) return null;
  const t = full.trim().split(/\s+/)[0];
  return t || null;
}

// Pede para a IA extrair o nome de uma mensagem curta do lead.
// Retorna null se não conseguir identificar com confiança.
async function extractNameFromMessage(message: string): Promise<string | null> {
  if (!LOVABLE_API_KEY) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": LOVABLE_API_KEY,
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          {
            role: "system",
            content:
              'Extraia o nome próprio do remetente da mensagem. Responda APENAS com JSON no formato {"name": "Fulano"} ou {"name": null} se não houver nome claro. Não inclua sobrenomes inventados, saudações ou texto extra.',
          },
          { role: "user", content: message.slice(0, 300) },
        ],
        temperature: 1,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (typeof raw !== "string") return null;
    const parsed = JSON.parse(raw);
    const name = typeof parsed?.name === "string" ? parsed.name.trim() : null;
    if (!name || name.length < 2 || name.length > 60) return null;
    if (/^\d+$/.test(name)) return null;
    return name;
  } catch (e) {
    console.error("[sdr] extractNameFromMessage erro:", e instanceof Error ? e.message : String(e));
    return null;
  }
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

  // Shared-secret check — uazapi não assina HMAC, então usamos token
  // configurável via WHATSAPP_WEBHOOK_SECRET (querystring `secret` ou header
  // `x-webhook-secret`). Sem isso, qualquer um pode forjar mensagens.
  const expectedSecret = Deno.env.get("WHATSAPP_WEBHOOK_SECRET");
  if (!expectedSecret) {
    console.error("[webhook] WHATSAPP_WEBHOOK_SECRET ausente");
    return new Response(JSON.stringify({ error: "Webhook not configured" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const url = new URL(req.url);
  const providedSecret =
    url.searchParams.get("secret") || req.headers.get("x-webhook-secret") || "";
  if (providedSecret !== expectedSecret) {
    console.warn("[webhook] secret inválido");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    let tenantId = url.searchParams.get("tenant_id") || DEFAULT_TENANT_ID;
    if (tenantId.includes("/")) tenantId = tenantId.split("/")[0];

    const body = await req.json().catch(() => ({}));
    const b = asObject(body);
    const eventType = String(b.EventType ?? b.event ?? b.type ?? "").toLowerCase();
    const chat = asObject(b.chat);
    const message = asObject(b.message);
    const sender = asObject(b.sender);

    console.log(`[webhook] tenant=${tenantId} event=${eventType} keys=${Object.keys(b).join(",")}`);

    // ── DEBUG: metadados do evento (sem PII; retenção 7 dias via cron) ────
    try {
      await adminClient.from("webhook_debug_logs").insert({
        tenant_id: tenantId,
        event_type: eventType,
        payload: maskWebhookPayload(b),
        received_at: new Date().toISOString(),
      });
    } catch {
      // tabela pode não existir ainda — ignora
    }


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

    // ── Lead events (uazapi "Leads" event) ───────────────────────────────
    // Quando um contato é identificado como lead de anúncio, a uazapi envia
    // um evento separado com dados do perfil e possivelmente do anúncio.
    if (eventType === "lead" || eventType === "leads") {
      const leadPhone = cleanPhone(pickString(b.phone, b.wa_id, b.jid, b.number, b.id));
      const leadName = pickString(b.name, b.pushName, b.notifyName, b.verifiedName);
      const leadAvatar = pickString(b.image, b.imageUrl, b.profilePicUrl, b.avatar, b.photo);
      const leadData = asObject(b.lead ?? b.data ?? b.contact ?? b);

      if (leadPhone) {
        // Tenta capturar contexto de anúncio do payload do lead
        const adCtx = extractAdContext(leadData, b);
        console.log(`[webhook] lead event phone=${leadPhone} name=${leadName} ad_id=${adCtx?.ad_id ?? "-"}`);

        // Localiza ou cria lead
        const { data: existing } = await adminClient
          .from("leads")
          .select("id, full_name, source, ad_id, ctwa_clid")
          .eq("tenant_id", tenantId)
          .eq("phone", leadPhone)
          .maybeSingle();

        if (existing) {
          const updates: Record<string, unknown> = {};
          if (!existing.full_name && isValidContactName(leadName, leadPhone)) updates.full_name = leadName;
          if (leadAvatar) updates.avatar_url = leadAvatar;
          if (adCtx && (!existing.ad_id || !existing.ctwa_clid)) {
            Object.assign(updates, adCtx, { ad_captured_at: new Date().toISOString() });
            if (!existing.source || existing.source === "whatsapp") updates.source = "ctwa_ads";
          }
          if (Object.keys(updates).length) {
            await adminClient.from("leads").update(updates).eq("id", existing.id);
            console.log(`[webhook] lead ${existing.id} atualizado via evento lead`);
          }
        } else {
          const insert: Record<string, unknown> = {
            tenant_id: tenantId,
            phone: leadPhone,
            full_name: isValidContactName(leadName, leadPhone) ? leadName : null,
            status: "open",
            source: adCtx ? "ctwa_ads" : "whatsapp",
            first_contact_at: new Date().toISOString(),
            avatar_url: leadAvatar || null,
          };
          if (adCtx) Object.assign(insert, adCtx, { ad_captured_at: new Date().toISOString() });
          await adminClient.from("leads").insert(insert);
          console.log(`[webhook] lead criado via evento lead: ${leadPhone}`);
        }
      }
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Message events ─────────────────────────────────────────────────────
    if (eventType.includes("message") || message.id || chat.id) {
      const fromMe = message.fromMe === true || b.fromMe === true || chat.fromMe === true;

      // Tenta vários campos onde o telefone do contato pode estar.
      // Prioriza chat.id (que normalmente é o JID do contato real).
      // Prioriza campos que sempre são JIDs reais do WhatsApp
      // (wa_chatid, message.chatid, remoteJid). O `chat.id` da uazapi pode
      // ser um identificador interno alfanumérico ("r1c11cee3080708") e vai
      // por último como fallback.
      const candidates = [
        chat.wa_chatid, chat.jid, chat.remoteJid, chat.phone, chat.wa_id,
        message.chatId, message.chatid, message.remoteJid, message.from, message.sender, message.author,
        sender.id, sender.jid, sender.phone, sender.wa_id,
        b.sender, b.from, b.phone, b.chatId, b.remoteJid,
        chat.id,
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

      let text = extractText(message) || extractText(b);
      const media = extractMedia(message, b);
      const msgType = media.kind || pickString(message.type, message.messageType, b.messageType) || "text";

      console.log(`[webhook] msg fromMe=${fromMe} phone=${senderPhone} name=${senderName} type=${msgType} media=${media.url ? "yes" : "no"} text=${(text || "").slice(0, 80)}`);

      // URLs do WhatsApp (mmg.whatsapp.net) são criptografadas — baixa via uazapi
      let mediaUrl = media.url;
      if (mediaUrl && /whatsapp\.net/.test(mediaUrl)) {
        const instanceToken = pickString(b.token);
        const messageId = pickString(message.messageid, message.id);
        if (instanceToken && messageId) {
          const downloaded = await downloadMediaViaUazapi(instanceToken, messageId);
          if (downloaded) {
            mediaUrl = downloaded;
            console.log(`[media] download ok: ${downloaded.slice(0, 120)}`);
          } else {
            console.warn("[media] download falhou, mantendo URL original");
          }
        }
      }

      // ── Mensagem ENVIADA manualmente pelo atendente humano (fromMe) ──
      // Logamos para que a IA tenha visão completa da conversa quando o
      // "Modo de Aprendizado" estiver ligado (observa atendimentos humanos)
      // E, principalmente, para que o CRM reflita em tempo real qualquer
      // resposta que a atendente digitou no celular (SLA / "Parado em
      // Leads Prontos há Xh" precisa zerar a contagem nesses casos).
      if (fromMe && senderPhone) {
        try {
          // 1) DEFESA EM PROFUNDIDADE: atualiza diretamente o lead.
          //    Mesmo que a inserção no log seja deduplicada ou falhe, o
          //    cronômetro de SLA precisa ser zerado imediatamente — caso
          //    contrário o CRM mostra "lead parado há Xh" mesmo após a
          //    atendente já ter respondido pelo WhatsApp.
          const nowIso = new Date().toISOString();
          const { data: leadRow } = await adminClient
            .from("leads")
            .select("id, status, last_outbound_at")
            .eq("tenant_id", tenantId)
            .eq("phone", senderPhone)
            .maybeSingle();
          if (leadRow) {
            const leadUpdate: Record<string, unknown> = {
              last_outbound_at: nowIso,
              updated_at: nowIso,
            };
            // Se ainda estava em "Leads Prontos" (open), move para
            // "Em Atendimento" — humana já assumiu a conversa.
            if (leadRow.status === "open") {
              leadUpdate.status = "in_progress";
              leadUpdate.custom_column_id = null;
            }
            const { error: leadErr } = await adminClient
              .from("leads")
              .update(leadUpdate)
              .eq("id", leadRow.id);
            if (leadErr) {
              console.error("[webhook] fromMe lead update erro:", leadErr.message);
            } else {
              console.log(`[webhook] fromMe → lead ${leadRow.id} sincronizado (last_outbound_at)`);
            }
          }

          // 2) Loga a mensagem (para a IA enxergar o histórico humano).
          //    Sem dedupe por texto: é mais seguro registrar duplicado do que
          //    silenciar a mensagem do atendente. Dedupe apenas por
          //    whatsapp_message_id quando ele existir.
          if (text && text.trim()) {
            const waMsgId = pickString(message.messageid, message.id);
            let dup = false;
            if (waMsgId) {
              const { data: existing } = await adminClient
                .from("whatsapp_message_logs")
                .select("id")
                .eq("tenant_id", tenantId)
                .eq("whatsapp_message_id", waMsgId)
                .limit(1);
              dup = !!(existing && existing.length);
            }
            if (!dup) {
              const { error: insErr } = await adminClient
                .from("whatsapp_message_logs")
                .insert({
                  tenant_id: tenantId,
                  recipient_phone: senderPhone,
                  message_type: msgType,
                  status: "sent",
                  whatsapp_message_id: waMsgId,
                  body: text,
                  sender_name: "Atendente",
                });
              if (insErr) {
                console.error("[webhook] fromMe log insert erro:", insErr.message);
              }
            }
          }
        } catch (e) {
          console.error("[webhook] fromMe erro:", e instanceof Error ? e.message : String(e));
        }
      }

      // ── IDEMPOTÊNCIA por whatsapp_message_id ──────────────────────────
      // O uazapi reentrega eventos. Sem isso, a mesma mensagem virava duas
      // gerações concorrentes e o lead recebia respostas duplicadas que se
      // ignoravam. Substitui a antiga comparação de texto em janela de 5 min.
      const inboundWamid = pickString(message.messageid, message.id);
      let duplicateInbound = false;
      if (!fromMe && senderPhone && inboundWamid) {
        const { data: seen } = await adminClient
          .from("whatsapp_message_logs")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("whatsapp_message_id", inboundWamid)
          .limit(1);
        duplicateInbound = !!(seen && seen.length);
        if (duplicateInbound) {
          console.log(`[webhook] mensagem duplicada ignorada wamid=${inboundWamid}`);
        }
      }

      if (!fromMe && senderPhone && !duplicateInbound) {
        // Persiste a mídia no Storage (histórico permanente) ─────────────
        let mediaStoragePath: string | null = null;
        let finalMime: string | null = media.mime;
        if (mediaUrl) {
          const saved = await persistMediaToStorage(tenantId, mediaUrl, media.mime);
          if (saved) {
            mediaStoragePath = saved.path;
            finalMime = saved.mime;
          }
        }

        // ── Transcrição de áudio (voice notes / audio messages) ──────────
        // Se veio áudio, transcreve com Gemini e mescla no texto pra que:
        //  1) o chat mostre "🎙️ Áudio: <transcrição>"
        //  2) a IA SDR receba o conteúdo falado no histórico (não só "áudio")
        let effectiveText = text;
        if ((media.kind === "audio") && mediaUrl) {
          const transcript = await transcribeAudioFromUrl(mediaUrl, finalMime);
          if (transcript) {
            const prefix = "🎙️ Áudio: ";
            effectiveText = effectiveText && effectiveText.trim()
              ? `${effectiveText.trim()}\n${prefix}${transcript}`
              : `${prefix}${transcript}`;
          }
        }

        // Não polui o histórico com mensagens vazias (sem texto e sem mídia) —
        // geralmente são eventos de status/notificação mal classificados.
        const hasText = !!(effectiveText && effectiveText.trim());
        const hasMedia = !!(mediaUrl || mediaStoragePath);
        if (!hasText && !hasMedia) {
          console.log(`[webhook] ignorando msg sem texto/mídia phone=${senderPhone} type=${msgType}`);
        } else {
          const { error: logErr } = await adminClient.from("whatsapp_message_logs").insert({
            tenant_id: tenantId,
            recipient_phone: senderPhone,
            message_type: msgType,
            status: "received",
            whatsapp_message_id: inboundWamid,
            body: hasText ? effectiveText : null,
            sender_name: senderName,
            sender_avatar_url: senderAvatarUrl,
            media_url: mediaUrl,
            media_mime: finalMime,
            media_storage_path: mediaStoragePath,
          });
          if (logErr) console.error("[webhook] log insert error:", logErr.message);
        }

        // Propaga a transcrição pro fluxo da IA SDR abaixo (histórico, nome, etc.)
        text = effectiveText;



        // ── Lead: localiza/cria e captura nome do contato quando possível ─
        let leadId: string | null = null;
        let leadName: string | null = null;
        let leadAssignedUserId: string | null = null;
        let leadIaSummary: string | null = null;
        let leadIaProfile: string | null = null;
        let leadIaSentiment: string | null = null;
        let leadIaUrgency: string | null = null;
        let leadPatientName: string | null = null;
        let leadPatientRelation: string | null = null;
        let leadPatientAge: number | null = null;
        let leadSchedulePrefs: Record<string, unknown> | null = null;

        try {
          const { data: existingLead } = await adminClient
            .from("leads")
            .select("id, full_name, assigned_user_id, status, updated_at, ia_summary, ia_profile, ia_sentiment, ia_urgency, patient_name, patient_relation, patient_age, schedule_preferences")

            .eq("tenant_id", tenantId)
            .eq("phone", senderPhone)
            .maybeSingle();

          if (existingLead) {
            leadId = existingLead.id as string;
            leadName = (existingLead.full_name as string | null) ?? null;
            leadAssignedUserId = (existingLead.assigned_user_id as string | null) ?? null;
            leadIaSummary = ((existingLead as any).ia_summary as string | null) ?? null;
            leadIaProfile = ((existingLead as any).ia_profile as string | null) ?? null;
            leadIaSentiment = ((existingLead as any).ia_sentiment as string | null) ?? null;
            leadIaUrgency = ((existingLead as any).ia_urgency as string | null) ?? null;
            leadPatientName = ((existingLead as any).patient_name as string | null) ?? null;
            leadPatientRelation = ((existingLead as any).patient_relation as string | null) ?? null;
            leadPatientAge = ((existingLead as any).patient_age as number | null) ?? null;
            leadSchedulePrefs = ((existingLead as any).schedule_preferences as Record<string, unknown> | null) ?? null;



            // ── REATIVAÇÃO AUTOMÁTICA (30 dias) ──────────────────────────
            // Se o lead está em status terminal (lost/showed_up) e o cliente
            // voltou a falar após +30 dias, reabre preservando 100% do histórico.
            const status = existingLead.status as string | null;
            const updatedAt = existingLead.updated_at as string | null;
            if (status && updatedAt && (status === "lost" || status === "showed_up")) {
              const daysInactive = Math.floor(
                (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24)
              );
              if (daysInactive >= 30) {
                const { data: reactivated, error: reactErr } = await adminClient
                  .rpc("reactivate_lead_if_stale", { _lead_id: leadId, _stale_days: 30 });
                if (reactErr) {
                  console.error("[lead] erro reativação:", reactErr.message);
                } else if (reactivated) {
                  console.log(`[lead] ${leadId} reativado após ${daysInactive} dias`);
                }
              }
            }
          } else {
            const initialName = isValidContactName(senderName, senderPhone) ? senderName : null;
            const adCtx = extractAdContext(message, b);
            const insertPayload: Record<string, unknown> = {
              tenant_id: tenantId,
              phone: senderPhone,
              full_name: initialName,
              status: "open",
              source: adCtx ? "ctwa_ads" : "whatsapp",
              first_contact_at: new Date().toISOString(),
            };
            if (adCtx) {
              Object.assign(insertPayload, adCtx, { ad_captured_at: new Date().toISOString() });
              console.log(`[lead] CTWA capturado ad_id=${adCtx.ad_id ?? "-"} campaign=${adCtx.utm_campaign ?? "-"}`);
            }
            const { data: newLead } = await adminClient
              .from("leads")
              .insert(insertPayload)
              .select("id, full_name, assigned_user_id")
              .single();
            if (newLead) {
              leadId = newLead.id as string;
              leadName = (newLead.full_name as string | null) ?? null;
              leadAssignedUserId = (newLead.assigned_user_id as string | null) ?? null;
            }
          }

          // Se o lead existe mas ainda não tem nome, e o WhatsApp trouxe um nome válido, grava
          if (leadId && !leadName && isValidContactName(senderName, senderPhone)) {
            await adminClient.from("leads").update({ full_name: senderName }).eq("id", leadId);
            leadName = senderName;
          }

          // Lead pré-existente sem origem de anúncio ainda? Captura se este evento trouxer.
          if (leadId) {
            const adCtxExisting = extractAdContext(message, b);
            if (adCtxExisting && (adCtxExisting.ad_id || adCtxExisting.ctwa_clid || adCtxExisting.utm_campaign)) {
              const { data: cur } = await adminClient
                .from("leads")
                .select("ad_id, ctwa_clid, utm_campaign")
                .eq("id", leadId)
                .maybeSingle();
              const hasOrigin = cur && (cur.ad_id || cur.ctwa_clid || cur.utm_campaign);
              if (!hasOrigin) {
                await adminClient
                  .from("leads")
                  .update({ ...adCtxExisting, ad_captured_at: new Date().toISOString() })
                  .eq("id", leadId);
                console.log(`[lead] origem de anúncio gravada em lead existente ${leadId}`);
              }
            }
          }

          // ── Foto de perfil ────────────────────────────────────────────
          // Se o webhook trouxe avatar, usa direto. Caso contrário, busca
          // ativamente via uazapi (só se o lead ainda não tem foto ou se
          // a foto tem mais de 30 dias). Persiste no Storage (privado) — a
          // URL bruta do WhatsApp expira; o storage não.
          try {
            if (leadId) {
              const { data: curAvatar } = await adminClient
                .from("leads")
                .select("avatar_url, avatar_updated_at")
                .eq("id", leadId)
                .maybeSingle();
              const ageMs = curAvatar?.avatar_updated_at
                ? Date.now() - new Date(curAvatar.avatar_updated_at as string).getTime()
                : Infinity;
              const STALE_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias
              const needsAvatar = !curAvatar?.avatar_url || ageMs > STALE_MS;
              if (needsAvatar) {
                let avatarSourceUrl = senderAvatarUrl;
                if (!avatarSourceUrl) {
                  const instanceToken = pickString(b.token);
                  if (instanceToken) {
                    avatarSourceUrl = await fetchUazapiContactImage(instanceToken, senderPhone);
                  }
                }
                if (avatarSourceUrl) {
                  const saved = await persistAvatarToStorage(tenantId, senderPhone, avatarSourceUrl);
                  if (saved) {
                    await adminClient.from("leads").update({
                      avatar_url: saved.path,
                      avatar_updated_at: new Date().toISOString(),
                    }).eq("id", leadId);
                    console.log(`[avatar] lead ${leadId} atualizado (${saved.path})`);
                  }
                }
              }
            }
          } catch (e) {
            console.warn("[avatar] erro:", e instanceof Error ? e.message : String(e));
          }

        } catch (e) {
          console.error("[lead] erro localizar/criar:", e instanceof Error ? e.message : String(e));
        }



        // ── Confirmação/cancelamento: NÃO é mais decidido por regex ──────
        // Antes, um "ok" em qualquer contexto marcava a consulta como
        // confirmada sem a IA saber (dois cérebros decidindo). Agora quem
        // decide é a IA, pelas tools 'confirmar_agendamento' e
        // 'cancelar_agendamento', que enxergam o contexto da conversa.


        // ── IA SDR: gera e envia resposta automaticamente ────────────────
        if (text && text.trim()) {
          // Guard 1: se um atendente humano assumiu o lead, NÃO responde
          if (leadAssignedUserId) {
            console.log(`[sdr] pulado: lead ${leadId} atribuído a atendente humano (${leadAssignedUserId})`);
          } else if (await humanRecentlyActive(adminClient, tenantId, senderPhone)) {
            // Guard 2: hand-off silencioso — se um humano enviou mensagem
            // nos últimos 30 min, a IA não intervém, mesmo sem "assumir" o lead.
            console.log(`[sdr] pulado: humano ativo recentemente na conversa com ${senderPhone}`);
          } else
          try {
            // 1) Busca token da instância
            const { data: cfg } = await adminClient
              .from("whatsapp_config")
              .select("instance_token, is_connected, business_hours, timezone")
              .eq("tenant_id", tenantId)
              .maybeSingle();

            if (!cfg?.instance_token || !cfg.is_connected) {
              console.log("[sdr] pulado: whatsapp não conectado ou sem token");
            } else {
              // 2) Carrega últimas 20 mensagens REAIS dessa conversa (inbound + outbound)
              //    Fonte: whatsapp_message_logs.body (texto completo); status='received' = cliente,
              //    'sent' = IA/atendente. Antes lia error_message (só respostas truncadas da IA) —
              //    por isso ela respondia sem contexto nenhum.
              const { data: hist } = await adminClient
                .from("whatsapp_message_logs")
                .select("status, body, transcription, sent_at")
                .eq("tenant_id", tenantId)
                .eq("recipient_phone", senderPhone)
                .order("sent_at", { ascending: false })
                .limit(20);

              const history = (hist ?? [])
                .reverse()
                .map((m: any) => {
                  const content = (m.body && String(m.body).trim())
                    || (m.transcription && String(m.transcription).trim())
                    || "";
                  return content
                    ? {
                        role: m.status === "sent" ? ("assistant" as const) : ("user" as const),
                        content,
                      }
                    : null;
                })
                .filter((x): x is { role: "user" | "assistant"; content: string } => !!x);


              // 2b) Se ainda não temos nome — OU o nome atual parece lixo (pushName ruim
              // do WhatsApp tipo "hhhdh") — tenta extrair da mensagem atual do lead.
              if (leadId && (!leadName || looksLikeJunkName(leadName))) {
                const extracted = await extractNameFromMessage(text);
                if (extracted && isValidContactName(extracted, senderPhone) && !looksLikeJunkName(extracted)) {
                  await adminClient.from("leads").update({ full_name: extracted }).eq("id", leadId);
                  console.log(`[lead] nome ${leadName ? `sobrescrito (${leadName} → ${extracted})` : `capturado`} da mensagem`);
                  leadName = extracted;
                }
              }


              // 3) Carrega ai_configs + documentos
              const { data: aiCfg } = await adminClient
                .from("ai_configs")
                .select("*")
                .eq("tenant_id", tenantId)
                .maybeSingle();

              // Guard: apenas Piloto Automático controla se a IA responde.
              // Modo Aprendizado é sempre-observador (não bloqueia respostas) —
              // a extração de aprendizado acontece em pipeline separado, offline.
              if ((aiCfg as any)?.autopilot_enabled === false) {
                console.log(`[sdr] pulado: piloto automático desligado (tenant=${tenantId})`);
              } else {
              const { data: docs } = await adminClient
                .from("ai_knowledge_documents")
                .select("name, content")
                .eq("tenant_id", tenantId)
                .eq("status", "ready");
              const knowledgeTexts = (docs ?? [])
                .filter((d: any) => d.content && d.content.trim())
                .map((d: any) => `[${d.name}]\n${(d.content as string).slice(0, 3000)}`);
              const systemPrompt = buildSystemFromConfig(aiCfg, knowledgeTexts);
              const temperature = Number((aiCfg as any)?.model_temperature) || 0.7;

              // Marcador de versão do prompt (auditoria em runtime — não há cache no webhook)
              try {
                const rawPs = String((aiCfg as any)?.prompt_system ?? "");
                let h = 0;
                for (let i = 0; i < rawPs.length; i++) h = ((h << 5) - h + rawPs.charCodeAt(i)) | 0;
                const promptHash = (h >>> 0).toString(16).padStart(8, "0");
                console.log(
                  `[ai_configs] tenant=${tenantId} updated_at=${(aiCfg as any)?.updated_at ?? "?"} prompt_len=${rawPs.length} prompt_hash=${promptHash}`,
                );
              } catch (_) { /* noop */ }

              // 4) Monta contexto de horário + nome do lead
              const hoursCtx = buildHoursContext(
                (cfg as any).business_hours as BusinessHours | null,
                ((cfg as any).timezone as string) || "America/Sao_Paulo",
              );
              const nameCtx = leadName
                ? `O cliente se chama ${leadName}. Use o primeiro nome dele (${firstName(leadName)}) naturalmente nas respostas, sem repetir em toda mensagem.`
                : `Você ainda NÃO sabe o nome do cliente. Antes de qualquer qualificação, pergunte o nome dele de forma curta e cordial (uma frase). Quando ele responder, use o primeiro nome dele nas próximas mensagens.`;
              const iaParts: string[] = [];
              if (leadIaSummary?.trim()) iaParts.push(`- Resumo do comportamento anterior: ${leadIaSummary.trim()}`);
              if (leadIaProfile?.trim()) iaParts.push(`- Perfil comportamental: ${leadIaProfile.trim()}`);
              if (leadIaSentiment?.trim()) iaParts.push(`- Sentimento do cliente: ${leadIaSentiment.trim()}`);
              if (leadIaUrgency?.trim()) iaParts.push(`- Urgência detectada: ${leadIaUrgency.trim()}`);
              const iaCtx = iaParts.length
                ? `CONTEXTO COMPORTAMENTAL DO LEAD (use para personalizar o tom e a abordagem, sem citar literalmente ao cliente):\n${iaParts.join("\n")}`
                : "";

              // CONTEXTO DE PACIENTE (quando o paciente do exame ≠ contato do WhatsApp)
              const patientParts: string[] = [];
              if (leadPatientName?.trim()) {
                const rel = leadPatientRelation?.trim() ? ` (${leadPatientRelation.trim()} de ${leadName ?? "quem está falando"})` : "";
                const age = leadPatientAge ? `, ${leadPatientAge} anos` : "";
                patientParts.push(
                  `IMPORTANTE — QUEM VAI FAZER O EXAME NÃO É QUEM ESTÁ FALANDO: o paciente é **${leadPatientName.trim()}**${rel}${age}. Você está conversando com ${leadName ?? "o contato"}, que está agendando PARA essa pessoa. Refira-se ao paciente pelo nome (${firstName(leadPatientName)}) — nunca trate ${leadName ?? "o contato"} como o paciente. Nas perguntas, use "seu ${leadPatientRelation?.trim() || "familiar"}" ou o nome. No agendamento, o nome que aparecerá na agenda será o do paciente.`,
                );
              }
              const prefHorario = (leadSchedulePrefs && (leadSchedulePrefs as any).preferencia_horario) ? String((leadSchedulePrefs as any).preferencia_horario) : "";
              const restrAgenda = (leadSchedulePrefs && (leadSchedulePrefs as any).restricoes_agenda) ? String((leadSchedulePrefs as any).restricoes_agenda) : "";
              if (prefHorario) {
                patientParts.push(
                  `PREFERÊNCIA DE HORÁRIO já declarada pelo cliente: "${prefHorario}". OBEDEÇA essa preferência ao oferecer horários — se o cliente disse "último horário do dia", ofereça o slot mais tarde disponível. Se disse "de manhã", só ofereça manhã. Nunca ignore essa preferência para propor um horário mais cedo/conveniente.`,
                );
              }
              if (restrAgenda) {
                patientParts.push(
                  `RESTRIÇÕES DE AGENDA declaradas: "${restrAgenda}". NÃO ofereça horários que violem essa restrição. Se a restrição eliminar todas as opções do dia, pule para o próximo dia útil.`,
                );
              }
              const patientCtx = patientParts.length ? patientParts.join("\n\n") : "";

              // Instruções de FERRAMENTAS apenas — sem repetir regras de
              // comportamento (elas vivem em prompt-rules.ts, fonte única).
              const toolsInstructions =
                "CONTEXTO DO NEGÓCIO: você atende para uma ÓTICA (não é clínica, não trabalha com convênio — atendimento sempre particular). Vende óculos, lentes e agenda exame de vista com nosso profissional.\n\n" +
                "FERRAMENTAS DISPONÍVEIS:\n" +
                "1) atualizar_qualificacao_lead — chame sempre que o cliente disser algo relevante (nome, idade, uso de óculos, paciente, preferência de horário, objeção). Campo a campo, nunca invente.\n" +
                "2) listar_horarios_disponiveis — obrigatória antes de propor qualquer horário. Não passe 'tipo_exame'.\n" +
                "3) criar_agendamento — só para agendamento NOVO.\n" +
                "4) remarcar_agendamento — quando já existe agendamento e o cliente quer mudar. Nunca use criar_agendamento nesse caso.\n" +
                "5) confirmar_agendamento — quando o cliente confirmar presença no agendamento existente.\n" +
                "6) cancelar_agendamento — quando pedir explicitamente para cancelar/desmarcar.\n" +
                "7) transferir_para_humano — reclamação, dúvida clínica complexa, pedido de atendente, ou pergunta de preço sem valor cadastrado.";



              // Contexto de agendamento ativo — evita a IA perguntar "está tudo certo pra sua consulta?"
              // quando o lead NÃO tem nada marcado (bug reportado: 15/07 com Adilielson).
              let apptCtx = "";
              try {
                if (leadId) {
                  const nowIso = new Date().toISOString();
                  const { data: nextAppt } = await adminClient
                    .from("appointments")
                    .select("scheduled_at, status, type_exam")
                    .eq("lead_id", leadId)
                    .in("status", ["pending", "confirmed"])
                    .gt("scheduled_at", nowIso)
                    .order("scheduled_at", { ascending: true })
                    .limit(1)
                    .maybeSingle();
                  const { data: lastAppt } = await adminClient
                    .from("appointments")
                    .select("scheduled_at, status, type_exam")
                    .eq("lead_id", leadId)
                    .order("scheduled_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();
                  if (nextAppt) {
                    apptCtx = `AGENDAMENTO ATIVO DESTE LEAD: exame de vista com nosso profissional em ${new Date(nextAppt.scheduled_at as string).toLocaleString("pt-BR", { timeZone: (cfg as any).timezone || "America/Sao_Paulo" })} (status: ${nextAppt.status}). Você PODE se referir a esta consulta.`;
                  } else if (lastAppt) {
                    apptCtx = `ATENÇÃO: Este lead NÃO tem agendamento futuro. Último registro: ${lastAppt.status} em ${new Date(lastAppt.scheduled_at as string).toLocaleString("pt-BR", { timeZone: (cfg as any).timezone || "America/Sao_Paulo" })}. NÃO pergunte "está tudo certo para sua consulta" nem invente compromissos.`;
                  } else {
                    apptCtx = `ATENÇÃO: Este lead NUNCA agendou nada. NÃO faça perguntas do tipo "está tudo certo para sua consulta/agendamento" — não existe. Trate como lead novo e descubra o interesse dele.`;
                  }
                }
              } catch (_) { /* noop */ }

              // Resumo dos próximos slots livres — ajuda a IA a não afirmar "não tem horário"
              // sem consultar a tool. Fonte de verdade continua sendo listar_horarios_disponiveis.
              let slotsCtx = "";
              try {
                const slots = await listAvailableSlots(adminClient as any, tenantId, {});
                if (slots.length > 0) {
                  const preview = slots.slice(0, 6).map((s) => s.label).join(" • ");
                  slotsCtx = `PRÓXIMOS HORÁRIOS LIVRES (prévia — sempre confirme via listar_horarios_disponiveis antes de ofertar): ${preview}.`;
                } else {
                  slotsCtx = `PRÉVIA DE HORÁRIOS: nenhum slot livre encontrado nos próximos dias pela agenda. Antes de dizer isso ao cliente, chame 'listar_horarios_disponiveis' para reconfirmar.`;
                }
              } catch (_) { /* noop */ }

              const contextNote = [toolsInstructions, hoursCtx, nameCtx, patientCtx, iaCtx, apptCtx, slotsCtx].filter(Boolean).join("\n\n");
              const reply = await generateSdrReply(
                systemPrompt,
                history,
                contextNote || undefined,
                temperature,
                leadId ? { tenantId, leadId, leadName, leadPhone: senderPhone } : null,
              );
              // Fallback audível: o lead NUNCA pode ficar sem resposta.
              // Se o provedor falhou / estourou iterações, manda uma mensagem
              // neutra e avisa a equipe para assumir a conversa.
              let finalReply = reply;
              if (!finalReply) {
                finalReply =
                  "Recebi sua mensagem! 😊 Já estou verificando aqui e te retorno em instantes.";
                console.error(`[sdr] fallback acionado para ${senderPhone} — IA não retornou resposta`);
                try {
                  await adminClient.from("notifications").insert({
                    tenant_id: tenantId,
                    title: "IA não conseguiu responder um lead",
                    message: `Assuma a conversa com ${leadName ?? senderPhone} — a IA falhou ao gerar resposta.`,
                    category: "system_error",
                    link: "/chat",
                  });
                } catch (_) { /* noop */ }
              }
              {
                const reply = finalReply;
                // 4) Envia pelo WhatsApp
                const sent = await sendWhatsAppText(cfg.instance_token, senderPhone, reply);
                // 5) Loga a resposta da IA
                await adminClient.from("whatsapp_message_logs").insert({
                  tenant_id: tenantId,
                  recipient_phone: senderPhone,
                  message_type: "text",
                  status: sent ? "sent" : "failed",
                  body: reply,
                  sender_name: "IA SDR",
                });
                console.log(`[sdr] resposta ${sent ? "enviada" : "falhou"} para ${senderPhone}`);
              }
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

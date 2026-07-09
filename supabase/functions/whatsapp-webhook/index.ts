// Edge Function: whatsapp-webhook
// Recebe eventos push da API uazapi (status de conexão, mensagens)
// URL: {SUPABASE_URL}/functions/v1/whatsapp-webhook?tenant_id=00000000-0000-0000-0000-000000000001

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AGENT_TOOLS, executeToolCall } from "./agent-tools.ts";

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
const CORE_BEHAVIOR_RULES = `REGRAS OBRIGATÓRIAS DE ATENDIMENTO (nunca ignore):

1) APRESENTAÇÃO E RAPPORT (primeira mensagem da conversa):
   - Sempre se apresente pelo nome (ex: "Oi, aqui é a Ana da Ótica Catelan 👋").
   - Pergunte o nome do lead se ainda não souber e use o primeiro nome nas respostas seguintes.
   - Crie rapport: seja acolhedora, valide o que a pessoa disse ("entendo", "imagino como é chato...") ANTES de partir para agenda ou qualificação.
   - Só passe para agendamento depois de entender o motivo/dor.

2) HORÁRIOS DE ATENDIMENTO — REGRA DE OURO:
   - NUNCA proponha um horário sem antes chamar a ferramenta 'listar_horarios_disponiveis' informando o 'tipo_exame' que o cliente pediu (Optometrista ou Oftalmológica).
   - Cada exame tem sua própria grade cadastrada em Agenda → Programação → "Horários por Exame". A ferramenta já cruza: horário da loja + janela do exame + bloqueios + recorrência de sábado + exceções por data.
   - Ofereça APENAS os horários retornados pela ferramenta. Nunca invente "08:30, 09:10, 09:50...".
   - Se o cliente pedir um horário e ele não aparecer na resposta da ferramenta, diga com clareza que nesse horário não há atendimento para aquele exame e ofereça o que a ferramenta retornou (ou tente 'listar_horarios_disponiveis' com data_preferida).
   - Não repita janelas fixas de memória. Toda oferta vem da ferramenta, sempre.

3) DIAGNÓSTICO CONSULTIVO (priorize antes de agendar):
   - Se o lead relatar dificuldade para enxergar de PERTO:
     a) Pergunte se já usa óculos.
     b) Se JÁ USA óculos: diga que muito provavelmente é um caso de grau vencido/desatualizado, e que uma consulta com ajuste correto resolve.
     c) Se NÃO usa óculos: pergunte a idade. Se tiver 40 anos ou mais, explique de forma simples que a partir dessa idade é comum desenvolver PRESBIOPIA (a famosa "vista cansada"), e que um óculos bem ajustado por um profissional resolve muito bem.
   - Se relatar dificuldade para enxergar de LONGE: sugira que pode ser miopia/astigmatismo e que a consulta identifica o grau correto.
   - Sempre traga a solução (consulta + óculos ajustado por profissional) ANTES de oferecer o link/horário.

4) ESTILO:
   - Mensagens curtas, uma pergunta por vez, tom humano brasileiro. Nunca soe como robô. Nunca invente preços nem convênios.
`;

function buildSystemFromConfig(cfg: any, knowledgeTexts: string[]): string {
  const parts: string[] = [cfg?.prompt_system?.trim() || FALLBACK_SYSTEM_PROMPT];
  parts.push(CORE_BEHAVIOR_RULES);
  if (cfg?.goal) {
    const goalMap: Record<string, string> = {
      appointment: "agendar uma consulta oftalmológica",
      qualification: "qualificar o lead",
      support: "dar suporte",
    };
    parts.push(`Objetivo principal: ${goalMap[cfg.goal] ?? cfg.goal}.`);
  }
  if (cfg?.scheduling_link) parts.push(`Link de agendamento: ${cfg.scheduling_link}`);

  // Sábados disponíveis do oftalmologista (revezamento)
  const saturdays = Array.isArray(cfg?.ophthalmologist_saturdays) ? cfg.ophthalmologist_saturdays as string[] : [];
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = saturdays.filter((d) => d >= today).sort().slice(0, 8);
  if (upcoming.length) {
    const fmt = upcoming.map((d) => { const [y,m,day] = d.split("-"); return `${day}/${m}/${y}`; }).join(", ");
    parts.push(`SÁBADOS DISPONÍVEIS DO OFTALMOLOGISTA (próximos): ${fmt}. Só ofereça sábado para oftalmologista nessas datas.`);
  } else {
    parts.push(`OFTALMOLOGISTA NO SÁBADO: nenhuma data disponível no momento. Ofereça apenas quarta-feira (15h-17h) com o oftalmologista, ou optometrista de segunda a domingo a partir das 14h.`);
  }

  if (cfg?.knowledge_base_faq?.trim()) parts.push(`FAQ:\n${cfg.knowledge_base_faq}`);
  if (knowledgeTexts.length) parts.push(`DOCUMENTOS DE REFERÊNCIA:\n${knowledgeTexts.join("\n---\n").slice(0, 6000)}`);
  if (cfg?.sample_scripts?.trim()) parts.push(`EXEMPLOS DE ATENDIMENTO:\n${cfg.sample_scripts}`);
  const qs = Array.isArray(cfg?.qualification_questions) ? cfg.qualification_questions : [];
  if (qs.length) parts.push(`PERGUNTAS DE QUALIFICAÇÃO (faça uma por vez, na ordem):\n${qs.map((q: string, i: number) => `${i + 1}. ${q}`).join("\n")}`);
  if (cfg?.rejection_instructions?.trim()) parts.push(`O QUE NÃO FAZER:\n${cfg.rejection_instructions}`);
  const r = Array.isArray(cfg?.response_restrictions) ? cfg.response_restrictions : [];
  if (r.length) parts.push(`Restrições: ${r.join(", ")}`);
  return parts.join("\n\n");
}

// ── Helpers de IA + envio ────────────────────────────────────────────────
async function generateSdrReply(
  systemPrompt: string,
  history: { role: "user" | "assistant"; content: string }[],
  contextNote: string | undefined,
  temperature: number,
  toolCtx: { tenantId: string; leadId: string | null; leadName: string | null; leadPhone: string } | null,
): Promise<string | null> {
  if (!LOVABLE_API_KEY) {
    console.error("[sdr] LOVABLE_API_KEY ausente");
    return null;
  }
  try {
    const systemMessages: { role: "system"; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];
    if (contextNote) systemMessages.push({ role: "system", content: contextNote });

    // Loop de function-calling — máx 4 iterações
    const messages: any[] = [...systemMessages, ...history];
    const useTools = !!toolCtx;

    for (let iter = 0; iter < 4; iter++) {
      const model = "openai/gpt-5-mini";
      // gpt-5* / o1 / o3 no gateway só aceitam temperature=1
      const fixedTempModel = /^openai\/(gpt-5|o1|o3)/i.test(model);
      const body: Record<string, unknown> = {
        model,
        messages,
        temperature: fixedTempModel ? 1 : temperature,
      };
      if (useTools) {
        body.tools = AGENT_TOOLS;
        body.tool_choice = "auto";
      }

      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": LOVABLE_API_KEY,
          "X-Lovable-AIG-SDK": "edge-function",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const txt = await res.text();
        console.error(`[sdr] gateway ${res.status}: ${txt.slice(0, 300)}`);
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

      const reply = msg?.content;
      return typeof reply === "string" && reply.trim() ? reply.trim() : null;
    }
    console.warn("[sdr] loop de tools esgotou 4 iterações");
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
  if (isOpen) {
    return `CONTEXTO DE HORÁRIO (fuso ${timezone}): estamos DENTRO do expediente. Horário de hoje: ${todayStr}. Você PODE oferecer transferir para um atendente humano.`;
  }
  return `CONTEXTO DE HORÁRIO (fuso ${timezone}): estamos FORA do expediente. Horário de hoje: ${todayStr}. Próxima abertura: ${nextLabel}. NÃO ofereça transferir para atendente humano agora. Em vez disso, ofereça agendar uma consulta oftalmológica ou diga que a equipe responderá no próximo horário útil.`;
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

// ── Extrai contexto de anúncio (Click-to-WhatsApp) do payload ───────────
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
// Transcrição de áudio (voice notes WhatsApp são OGG/Opus).
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

// Valida se um "nome" enviado pelo WhatsApp parece um nome real
// (não é só dígitos, não é o próprio telefone, não é JID).
function isValidContactName(name: string | null, phone: string | null): boolean {
  if (!name) return false;
  const n = name.trim();
  if (n.length < 2 || n.length > 80) return false;
  if (/^\d+$/.test(n)) return false;
  if (n.includes("@")) return false;
  if (phone && n.replace(/\D+/g, "") === phone) return false;
  return true;
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

    // ── DEBUG: loga payload bruto de eventos desconhecidos (7 dias) ──────
    try {
      await adminClient.from("webhook_debug_logs").insert({
        tenant_id: tenantId,
        event_type: eventType,
        payload: body,
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
                .eq("recipient_phone", senderPhone)
                .eq("status", "sent")
                .gte("sent_at", new Date(Date.now() - 5 * 60_000).toISOString())
                .eq("error_message", text.slice(0, 500))
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
                  error_message: text.slice(0, 500),
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

      if (!fromMe && senderPhone) {
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
            error_message: hasText ? effectiveText!.slice(0, 500) : null,
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
        try {
          const { data: existingLead } = await adminClient
            .from("leads")
            .select("id, full_name, assigned_user_id, status, updated_at, ia_summary, ia_profile, ia_sentiment, ia_urgency")
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



        // ── Detecta resposta de confirmação de agendamento ───────────────
        try {
          if (leadId && text && text.trim()) {
            const norm = text.toLowerCase().trim();
            const isConfirm = /\b(sim|confirmo|confirmado|confirmada|ok|okay|pode\s*ser|t[áa]|tudo\s*certo|claro|com\s*certeza|👍|✅)\b/i.test(norm);
            const isCancel = /\b(n[aã]o\s*posso|cancelar|desmarcar|remarcar|n[aã]o\s*vou|n[aã]o\s*consigo)\b/i.test(norm);

            if (isConfirm || isCancel) {
              const { data: nextAppt } = await adminClient
                .from("appointments")
                .select("id, status, scheduled_at")
                .eq("lead_id", leadId)
                .in("status", ["pending", "confirmed"])
                .gt("scheduled_at", new Date().toISOString())
                .order("scheduled_at", { ascending: true })
                .limit(1)
                .maybeSingle();

              if (nextAppt) {
                if (isConfirm && nextAppt.status !== "confirmed") {
                  await adminClient
                    .from("appointments")
                    .update({ status: "confirmed", updated_at: new Date().toISOString() })
                    .eq("id", nextAppt.id);
                  console.log(`[appt] lead ${leadId} confirmou agendamento ${nextAppt.id}`);
                } else if (isCancel) {
                  // Não cancela automaticamente — gera notificação para o atendente
                  await adminClient.from("notifications").insert({
                    tenant_id: tenantId,
                    title: "Lead pediu para remarcar/cancelar",
                    body: `Mensagem: "${text.slice(0, 140)}"`,
                    type: "appointment_attention",
                  }).then(() => {}, () => {});
                  console.log(`[appt] lead ${leadId} sinalizou cancelamento — atenção do atendente`);
                }
              }
            }
          }
        } catch (e) {
          console.error("[appt-confirm] erro:", e instanceof Error ? e.message : String(e));
        }

        // ── IA SDR: gera e envia resposta automaticamente ────────────────
        if (text && text.trim()) {
          // Guard: se um atendente humano assumiu o lead, NÃO responde
          if (leadAssignedUserId) {
            console.log(`[sdr] pulado: lead ${leadId} atribuído a atendente humano (${leadAssignedUserId})`);
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

              // 2b) Se ainda não temos nome, tenta extrair da mensagem atual do lead
              if (leadId && !leadName) {
                const extracted = await extractNameFromMessage(text);
                if (extracted && isValidContactName(extracted, senderPhone)) {
                  await adminClient.from("leads").update({ full_name: extracted }).eq("id", leadId);
                  leadName = extracted;
                  console.log(`[lead] nome capturado da mensagem: ${extracted}`);
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
              const toolsInstructions =
                "CONTEXTO DO NEGÓCIO: você atende para uma ÓTICA. O foco é vender óculos (armações, lentes multifocais/monofocais, óculos de sol, transitions, lentes de contato) e agendar exames de vista quando fizer sentido. NÃO é clínica: NUNCA pergunte sobre plano de saúde/convênio — atendimento é sempre particular. O agendamento é UM dos caminhos, não o único: se o cliente quer comprar óculos, tirar dúvida sobre armação, lente, preço, tratamento, promoção — conduza a conversa nesse rumo e só ofereça exame se ele precisar de receita atualizada.\n\n" +
                "AÇÕES QUE VOCÊ PODE EXECUTAR:\n" +
                "1) atualizar_qualificacao_lead — CHAME SEMPRE que o cliente responder algo relevante (nome, idade, uso de óculos, tipo de armação/lente que procura, dificuldade visual, último exame, receita, objeção, urgência). Salve campo a campo, sem esperar ter tudo. Nunca invente dados — só salve o que o cliente REALMENTE disse.\n" +
                "2) listar_horarios_disponiveis — use apenas quando o cliente sinalizou querer marcar EXAME. Os slots retornados são SUGESTÕES, não uma grade rígida.\n" +
                "3) criar_agendamento — chame APENAS para criar um agendamento NOVO, quando o lead ainda não tem outro pendente/confirmado.\n" +
                "4) remarcar_agendamento — chame SEMPRE que o cliente pedir para 'remarcar', 'mudar o horário', 'trocar o dia' de um agendamento que JÁ EXISTE. NUNCA chame criar_agendamento nesse caso: isso cria duplicata. Só passe o novo_horario_iso; o sistema encontra o agendamento a atualizar.\n" +
                "5) cancelar_agendamento — chame quando o cliente pedir explicitamente para cancelar/desmarcar.\n" +
                "6) transferir_para_humano — use em reclamação, dúvida clínica complexa, pedido de 'falar com atendente' ou algo fora do escopo.\n\n" +
                "FLUXO DE CONVERSA (MUITO IMPORTANTE):\n" +
                "• Descubra primeiro o INTERESSE do cliente: quer comprar óculos? tirar dúvida? marcar exame? Só depois qualifique o resto.\n" +
                "• Faça UMA pergunta por vez, no tom da persona.\n" +
                "• Ao receber a resposta, PRIMEIRO chame atualizar_qualificacao_lead para salvar, DEPOIS responda ao cliente.\n" +
                "• Se o cliente quer PRODUTO (óculos/lente/armação): fale sobre modelos, materiais, tratamentos, valores e convide para visitar a loja OU marcar exame caso precise de receita nova. Não force agendamento.\n" +
                "• Se o cliente quer EXAME: qualifique (dor + uso atual + urgência) antes de propor horário.\n\n" +
                "REGRA DE FLEXIBILIDADE DE HORÁRIO (quando agendar exame): o atendimento é rápido e admite paralelismo. SEMPRE priorize o horário que o cliente PODE. Se ele pedir 15h e você tinha oferecido 14h, agende 15h. Se ele pedir 15h05 ou 15h10, agende exatamente esse horário — pode marcar em qualquer minuto (ex.: 14:20, 15:10, 16:35). NUNCA diga que 'esse horário está ocupado' — não recuse por conflito com outro agendamento. Só recuse se estiver fora do horário comercial, em dia bloqueado ou no passado.";


              const contextNote = [toolsInstructions, hoursCtx, nameCtx, iaCtx].filter(Boolean).join("\n\n");
              const reply = await generateSdrReply(
                systemPrompt,
                history,
                contextNote || undefined,
                temperature,
                leadId ? { tenantId, leadId, leadName, leadPhone: senderPhone } : null,
              );
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

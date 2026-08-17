// Edge Function: whatsapp-webhook
// Recebe eventos push da API uazapi (status de conexão, mensagens)
// URL: {SUPABASE_URL}/functions/v1/whatsapp-webhook?tenant_id=00000000-0000-0000-0000-000000000001

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildSdrSystemPrompt } from "../_shared/ai-prompt-core.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const UAZAPI_BASE_URL = "https://ipazua.uazapi.com";
const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ── Agendamento: lista horários disponíveis ─────────────────────────────────
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

async function listAvailableSlots(tenantId: string, timezone: string): Promise<string> {
  const now = new Date();
  const lookAheadDays = 14;
  const maxSlots = 18;

  const [typesRes, bizRes, blockedRes, apptsRes] = await Promise.all([
    adminClient.from("consultation_types").select("id, name").eq("tenant_id", tenantId).eq("is_active", true),
    adminClient.from("agenda_business_hours").select("weekday, is_open, open_time, close_time, lunch_start, lunch_end").eq("tenant_id", tenantId),
    adminClient.from("agenda_blocked_dates")
      .select("blocked_date, all_day")
      .eq("tenant_id", tenantId)
      .gte("blocked_date", now.toISOString().split("T")[0])
      .lte("blocked_date", new Date(now.getTime() + lookAheadDays * 86400000).toISOString().split("T")[0]),
    adminClient.from("appointments")
      .select("scheduled_at, consultation_type_id")
      .eq("tenant_id", tenantId)
      .in("status", ["pending", "confirmed"])
      .gte("scheduled_at", now.toISOString())
      .lte("scheduled_at", new Date(now.getTime() + lookAheadDays * 86400000).toISOString()),
  ]);

  const types = typesRes.data ?? [];
  if (!types.length) return "Não há tipos de consulta configurados.";

  const typeIds = types.map((t: any) => t.id);
  const { data: typeHours } = await adminClient
    .from("consultation_type_hours")
    .select("consultation_type_id, weekday, is_active, start_time, end_time, slot_minutes, saturday_recurrence")
    .in("consultation_type_id", typeIds);

  const bizMap = new Map((bizRes.data ?? []).map((h: any) => [h.weekday as number, h]));
  const blockedDays = new Set((blockedRes.data ?? []).filter((b: any) => b.all_day).map((b: any) => b.blocked_date as string));

  // Booked slots as "YYYY-MM-DDTHH:MM" in local timezone
  const booked = new Set(
    (apptsRes.data ?? []).map((a: any) => {
      const localStr = new Intl.DateTimeFormat("sv-SE", {
        timeZone: timezone, hour12: false,
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit",
      }).format(new Date(a.scheduled_at as string));
      return localStr.replace(" ", "T").slice(0, 16);
    }),
  );

  const slots: { typeName: string; label: string }[] = [];

  for (let dayOff = 0; dayOff < lookAheadDays && slots.length < maxSlots; dayOff++) {
    const dayUtc = new Date(now.getTime() + dayOff * 86400000);
    const localDateStr = new Intl.DateTimeFormat("sv-SE", { timeZone: timezone }).format(dayUtc);
    if (blockedDays.has(localDateStr)) continue;

    const localWeekday = new Date(`${localDateStr}T12:00:00.000-03:00`).getUTCDay();
    const bh = bizMap.get(localWeekday) as any;
    if (!bh?.is_open) continue;

    for (const type of types as any[]) {
      if (slots.length >= maxSlots) break;
      const th = (typeHours ?? []).find(
        (h: any) => h.consultation_type_id === type.id && h.weekday === localWeekday,
      ) as any;
      if (!th?.is_active || !th.start_time || !th.end_time) continue;

      // Saturday recurrence check
      if (localWeekday === 6) {
        const weekNum = getISOWeek(new Date(`${localDateStr}T12:00:00.000-03:00`));
        const rec: string = th.saturday_recurrence ?? "all";
        if (rec === "none") continue;
        if (rec === "even" && weekNum % 2 !== 0) continue;
        if (rec === "odd" && weekNum % 2 === 0) continue;
      }

      const [sh, sm] = (th.start_time as string).split(":").map(Number);
      const [eh, em] = (th.end_time as string).split(":").map(Number);
      const slotMin: number = th.slot_minutes ?? 30;
      const endMin = eh * 60 + em;

      for (let m = sh * 60 + sm; m + slotMin <= endMin && slots.length < maxSlots; m += slotMin) {
        const h = Math.floor(m / 60);
        const min = m % 60;
        const timeStr = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
        const iso = `${localDateStr}T${timeStr}`;
        const slotUtc = new Date(`${localDateStr}T${timeStr}:00.000-03:00`);
        if (slotUtc <= now) continue;
        if (booked.has(iso)) continue;

        const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
        const [, mo, d] = localDateStr.split("-");
        slots.push({ typeName: type.name as string, label: `${dayNames[localWeekday]} ${d}/${mo} às ${timeStr}` });
      }
    }
  }

  if (!slots.length) return "Não encontrei horários disponíveis nos próximos 14 dias. Entre em contato diretamente.";

  const byType = new Map<string, string[]>();
  for (const s of slots) {
    if (!byType.has(s.typeName)) byType.set(s.typeName, []);
    byType.get(s.typeName)!.push(s.label);
  }
  return [...byType.entries()].map(([t, ls]) => `${t}: ${ls.join(", ")}`).join("\n");
}

// ── Agendamento: cria consulta ───────────────────────────────────────────────
async function bookAppointment(
  tenantId: string,
  leadId: string | null,
  consultationTypeName: string,
  dateTimeStr: string, // "YYYY-MM-DDTHH:MM" in São Paulo time
  timezone: string,
): Promise<string> {
  let scheduledUtc: Date;
  try {
    scheduledUtc = new Date(`${dateTimeStr.trim()}:00.000-03:00`);
    if (isNaN(scheduledUtc.getTime())) throw new Error("invalid");
  } catch {
    return "Data/hora inválida. Informe no formato YYYY-MM-DDTHH:MM (ex: 2026-08-18T14:00).";
  }
  if (scheduledUtc <= new Date()) return "Não é possível agendar no passado.";

  const { data: ctypes } = await adminClient
    .from("consultation_types")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .ilike("name", `%${consultationTypeName.trim()}%`)
    .limit(1);

  if (!ctypes?.length) return `Tipo de consulta '${consultationTypeName}' não encontrado. Use listar_horarios_disponiveis para ver as opções.`;
  const ctype = ctypes[0] as any;

  // Get slot_minutes for this type on this weekday
  const localWeekday = (() => {
    const wk = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(scheduledUtc);
    return ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[wk] ?? 1;
  })();

  const { data: th } = await adminClient
    .from("consultation_type_hours")
    .select("slot_minutes")
    .eq("consultation_type_id", ctype.id)
    .eq("weekday", localWeekday)
    .maybeSingle();

  const slotMinutes = (th as any)?.slot_minutes ?? 30;
  const endAt = new Date(scheduledUtc.getTime() + slotMinutes * 60 * 1000);

  // Conflict check
  const { data: conflicts } = await adminClient
    .from("appointments")
    .select("id")
    .eq("tenant_id", tenantId)
    .in("status", ["pending", "confirmed"])
    .gte("scheduled_at", scheduledUtc.toISOString())
    .lt("scheduled_at", endAt.toISOString())
    .limit(1);

  if (conflicts?.length) return "Esse horário já está ocupado. Use listar_horarios_disponiveis para ver outros horários disponíveis.";

  // Get first unit for this tenant
  const { data: unit } = await adminClient
    .from("units")
    .select("id")
    .eq("tenant_id", tenantId)
    .limit(1)
    .maybeSingle();

  const { error: insErr } = await adminClient.from("appointments").insert({
    tenant_id: tenantId,
    lead_id: leadId,
    unit_id: (unit as any)?.id ?? null,
    consultation_type_id: ctype.id,
    scheduled_at: scheduledUtc.toISOString(),
    end_at: endAt.toISOString(),
    status: "pending",
    created_by_ai: true,
    type_exam: ctype.name,
  });

  if (insErr) {
    console.error("[bookAppt] erro:", insErr.message);
    return "Erro ao criar agendamento. Por favor, tente novamente ou fale com a equipe.";
  }

  const formattedDate = scheduledUtc.toLocaleString("pt-BR", {
    timeZone: timezone,
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return `Agendamento criado com sucesso! ${ctype.name} em ${formattedDate}. Em breve a equipe confirma.`;
}

// ── IA SDR com tool calling ──────────────────────────────────────────────────
const SDR_TOOLS = [
  {
    type: "function",
    function: {
      name: "listar_horarios_disponiveis",
      description: "Use sempre que o cliente perguntar sobre horários disponíveis ou quiser saber quando pode agendar. Retorna os próximos horários livres.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_agendamento",
      description: "Use quando o cliente confirmar um horário específico para agendar. Cria o agendamento no sistema.",
      parameters: {
        type: "object",
        properties: {
          tipo_consulta: { type: "string", description: "Nome do tipo de consulta (ex: Optometrista, Oftalmologista)." },
          data_hora: { type: "string", description: "Data e hora no formato YYYY-MM-DDTHH:MM no fuso de São Paulo (ex: 2026-08-18T14:00)." },
        },
        required: ["tipo_consulta", "data_hora"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "transferir_para_humano",
      description: "Use quando o cliente pedir explicitamente para falar com um atendente humano.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
];

async function callLovableGateway(payload: Record<string, unknown>): Promise<Response> {
  return fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": LOVABLE_API_KEY,
      "X-Lovable-AIG-SDK": "edge-function",
    },
    body: JSON.stringify(payload),
  });
}

async function generateSdrReply(
  systemPrompt: string,
  history: { role: "user" | "assistant"; content: string }[],
  temperature: number,
  tenantId: string,
  leadId: string | null,
  timezone: string,
): Promise<string | null> {
  if (!LOVABLE_API_KEY) {
    console.error("[sdr] LOVABLE_API_KEY ausente");
    return null;
  }

  const baseMessages = [{ role: "system", content: systemPrompt }, ...history];

  try {
    const res1 = await callLovableGateway({
      model: "google/gemini-3-flash-preview",
      messages: baseMessages,
      temperature,
      tools: SDR_TOOLS,
      tool_choice: "auto",
    });

    if (!res1.ok) {
      const txt = await res1.text();
      console.error(`[sdr] gateway ${res1.status}: ${txt.slice(0, 300)}`);
      return null;
    }

    const data1 = await res1.json();
    const choice1 = data1?.choices?.[0];
    const msg1 = choice1?.message;

    // If model called a tool, execute it and make a second call
    if (choice1?.finish_reason === "tool_calls" && msg1?.tool_calls?.length > 0) {
      const toolMessages: unknown[] = [msg1];

      for (const toolCall of msg1.tool_calls) {
        const fnName: string = toolCall?.function?.name ?? "";
        let args: Record<string, string> = {};
        try { args = JSON.parse(toolCall?.function?.arguments ?? "{}"); } catch { /* */ }

        let result = "";
        if (fnName === "listar_horarios_disponiveis") {
          result = await listAvailableSlots(tenantId, timezone);
        } else if (fnName === "criar_agendamento") {
          result = await bookAppointment(tenantId, leadId, args.tipo_consulta ?? "", args.data_hora ?? "", timezone);
        } else if (fnName === "transferir_para_humano") {
          await adminClient.from("notifications").insert({
            tenant_id: tenantId,
            title: "Cliente pediu atendente humano",
            body: "A IA SDR transferiu o cliente para atendimento humano.",
            type: "appointment_attention",
          }).then(() => {}, () => {});
          result = "ok: notificação enviada à equipe";
        } else {
          result = "ferramenta desconhecida";
        }

        console.log(`[sdr-tool] ${fnName} → ${result.slice(0, 120)}`);
        toolMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      }

      const res2 = await callLovableGateway({
        model: "google/gemini-3-flash-preview",
        messages: [...baseMessages, ...toolMessages],
        temperature,
      });

      if (!res2.ok) {
        const txt = await res2.text();
        console.error(`[sdr] gateway2 ${res2.status}: ${txt.slice(0, 300)}`);
        return null;
      }
      const data2 = await res2.json();
      const reply = data2?.choices?.[0]?.message?.content;
      return typeof reply === "string" && reply.trim() ? reply.trim() : null;
    }

    // No tool calls — direct reply
    const reply = msg1?.content;
    return typeof reply === "string" && reply.trim() ? reply.trim() : null;
  } catch (e) {
    console.error("[sdr] erro chamando gateway:", e instanceof Error ? e.message : String(e));
    return null;
  }
}

const SDR_FALLBACK_REPLY =
  "Tive uma instabilidade aqui, mas ja deixei sua mensagem registrada. A equipe vai te responder assim que possivel.";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

async function acquireConversationLock(tenantId: string, phone: string, ttlSeconds = 45): Promise<boolean> {
  try {
    const { data, error } = await adminClient.rpc("acquire_whatsapp_processing_lock", {
      _tenant_id: tenantId,
      _recipient_phone: phone,
      _ttl_seconds: ttlSeconds,
    });
    if (error) {
      console.error("[sdr-lock] acquire erro:", error.message);
      return true;
    }
    return data === true;
  } catch (e) {
    console.error("[sdr-lock] acquire exception:", e instanceof Error ? e.message : String(e));
    return true;
  }
}

async function releaseConversationLock(tenantId: string, phone: string): Promise<void> {
  try {
    const { error } = await adminClient.rpc("release_whatsapp_processing_lock", {
      _tenant_id: tenantId,
      _recipient_phone: phone,
    });
    if (error) console.error("[sdr-lock] release erro:", error.message);
  } catch (e) {
    console.error("[sdr-lock] release exception:", e instanceof Error ? e.message : String(e));
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
  return `CONTEXTO DE HORÁRIO (fuso ${timezone}): estamos FORA do expediente. Horário de hoje: ${todayStr}. Próxima abertura: ${nextLabel}. NÃO ofereça transferir para atendente humano agora. Em vez disso, ofereça agendar uma consulta ou diga que a equipe responderá no próximo horário útil.`;
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

function extractMedia(msg: Record<string, unknown>, root: Record<string, unknown>): { url: string | null; mime: string | null; kind: string | null } {
  const m = asObject(msg.message);
  const content = asObject(msg.content);
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
    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
  };
}

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

function cleanPhone(raw: string | null): string | null {
  if (!raw) return null;
  if (raw.includes("@g.us") || raw.includes("broadcast") || raw.includes("status@")) return null;
  const noSuffix = raw.split("@")[0].split(":")[0];
  let d = noSuffix.replace(/\D+/g, "");
  if (d.length < 10 || d.length > 13) return null;
  if ((d.length === 10 || d.length === 11) && !d.startsWith("55")) {
    d = "55" + d;
  }
  return d;
}

function isValidContactName(name: string | null, phone: string | null): boolean {
  if (!name) return false;
  const n = name.trim();
  if (n.length < 2 || n.length > 80) return false;
  if (/^\d+$/.test(n)) return false;
  if (n.includes("@")) return false;
  if (phone && n.replace(/\D+/g, "") === phone) return false;
  return true;
}

function firstName(full: string | null | undefined): string | null {
  if (!full) return null;
  const t = full.trim().split(/\s+/)[0];
  return t || null;
}

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
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              'Extraia o nome próprio do remetente da mensagem. Responda APENAS com JSON no formato {"name": "Fulano"} ou {"name": null} se não houver nome claro. Não inclua sobrenomes inventados, saudações ou texto extra.',
          },
          { role: "user", content: message.slice(0, 300) },
        ],
        temperature: 0,
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

    // ── Lead events ───────────────────────────────────────────────────────
    if (eventType === "lead" || eventType === "leads") {
      const leadPhone = cleanPhone(pickString(b.phone, b.wa_id, b.jid, b.number, b.id));
      const leadName = pickString(b.name, b.pushName, b.notifyName, b.verifiedName);
      const leadAvatar = pickString(b.image, b.imageUrl, b.profilePicUrl, b.avatar, b.photo);
      const leadData = asObject(b.lead ?? b.data ?? b.contact ?? b);

      if (leadPhone) {
        const adCtx = extractAdContext(leadData, b);
        console.log(`[webhook] lead event phone=${leadPhone} name=${leadName} ad_id=${adCtx?.ad_id ?? "-"}`);

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
        }
      }
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Message events ─────────────────────────────────────────────────────
    if (eventType.includes("message") || message.id || chat.id) {
      const fromMe = message.fromMe === true || b.fromMe === true || chat.fromMe === true;

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
      const media = extractMedia(message, b);
      const msgType = media.kind || pickString(message.type, message.messageType, b.messageType) || "text";

      console.log(`[webhook] msg fromMe=${fromMe} phone=${senderPhone} name=${senderName} type=${msgType} text=${(text || "").slice(0, 80)}`);

      let mediaUrl = media.url;
      if (mediaUrl && /whatsapp\.net/.test(mediaUrl)) {
        const instanceToken = pickString(b.token);
        const messageId = pickString(message.messageid, message.id);
        if (instanceToken && messageId) {
          const downloaded = await downloadMediaViaUazapi(instanceToken, messageId);
          if (downloaded) {
            mediaUrl = downloaded;
          } else {
            console.warn("[media] download falhou, mantendo URL original");
          }
        }
      }

      // ── Mensagem ENVIADA pelo atendente humano (fromMe) ──
      if (fromMe && senderPhone && text && text.trim()) {
        try {
          const { data: recent } = await adminClient
            .from("whatsapp_message_logs")
            .select("id, body, sent_at")
            .eq("tenant_id", tenantId)
            .eq("recipient_phone", senderPhone)
            .eq("status", "sent")
            .gte("sent_at", new Date(Date.now() - 30_000).toISOString())
            .order("sent_at", { ascending: false })
            .limit(5);
          const dup = (recent ?? []).some((r: any) => (r.body ?? "").trim() === text.trim());
          if (!dup) {
            await adminClient.from("whatsapp_message_logs").insert({
              tenant_id: tenantId,
              recipient_phone: senderPhone,
              message_type: msgType,
              status: "sent",
              body: text.slice(0, 500),
              sender_name: "Atendente",
            });
          }
        } catch (e) {
          console.error("[webhook] log fromMe erro:", e instanceof Error ? e.message : String(e));
        }
      }

      if (!fromMe && senderPhone) {
        let mediaStoragePath: string | null = null;
        let finalMime: string | null = media.mime;
        if (mediaUrl) {
          const saved = await persistMediaToStorage(tenantId, mediaUrl, media.mime);
          if (saved) {
            mediaStoragePath = saved.path;
            finalMime = saved.mime;
          }
        }

        const { error: logErr } = await adminClient.from("whatsapp_message_logs").insert({
          tenant_id: tenantId,
          recipient_phone: senderPhone,
          message_type: msgType,
          status: "received",
          body: text ? text.slice(0, 500) : null,
          sender_name: senderName,
          sender_avatar_url: senderAvatarUrl,
          media_url: mediaUrl,
          media_mime: finalMime,
          media_storage_path: mediaStoragePath,
        });
        if (logErr) console.error("[webhook] log insert error:", logErr.message);

        // ── Lead: localiza/cria ─────────────────────────────────────────
        let leadId: string | null = null;
        let leadName: string | null = null;
        let leadAssignedUserId: string | null = null;
        try {
          const { data: existingLead } = await adminClient
            .from("leads")
            .select("id, full_name, assigned_user_id, status, updated_at")
            .eq("tenant_id", tenantId)
            .eq("phone", senderPhone)
            .maybeSingle();

          if (existingLead) {
            leadId = existingLead.id as string;
            leadName = (existingLead.full_name as string | null) ?? null;
            leadAssignedUserId = (existingLead.assigned_user_id as string | null) ?? null;

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

          if (leadId && !leadName && isValidContactName(senderName, senderPhone)) {
            await adminClient.from("leads").update({ full_name: senderName }).eq("id", leadId);
            leadName = senderName;
          }

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
              }
            }
          }
        } catch (e) {
          console.error("[lead] erro localizar/criar:", e instanceof Error ? e.message : String(e));
        }

        // ── Detecta pedido de cancelamento/remarcação ────────────────────
        try {
          if (leadId && text && text.trim()) {
            const isCancel = /\b(n[aã]o\s*posso|cancelar|desmarcar|remarcar|n[aã]o\s*vou|n[aã]o\s*consigo)\b/i.test(text);
            if (isCancel) {
              const { data: nextAppt } = await adminClient
                .from("appointments")
                .select("id")
                .eq("lead_id", leadId)
                .in("status", ["pending", "confirmed"])
                .gt("scheduled_at", new Date().toISOString())
                .order("scheduled_at", { ascending: true })
                .limit(1)
                .maybeSingle();
              if (nextAppt) {
                await adminClient.from("notifications").insert({
                  tenant_id: tenantId,
                  title: "Lead pediu para remarcar/cancelar",
                  body: `Mensagem: "${text.slice(0, 140)}"`,
                  type: "appointment_attention",
                }).then(() => {}, () => {});
              }
            }
          }
        } catch (e) {
          console.error("[appt-confirm] erro:", e instanceof Error ? e.message : String(e));
        }

        // ── IA SDR ───────────────────────────────────────────────────────
        if (text && text.trim()) {
          if (leadAssignedUserId) {
            console.log(`[sdr] pulado: lead ${leadId} atribuído a atendente humano`);
          } else {
            try {
              const { data: cfg } = await adminClient
                .from("whatsapp_config")
                .select("instance_token, is_connected, business_hours, timezone")
                .eq("tenant_id", tenantId)
                .maybeSingle();

              if (!cfg?.instance_token || !cfg.is_connected) {
                console.log("[sdr] pulado: whatsapp não conectado ou sem token");
              } else {
                const timezone: string = ((cfg as any).timezone as string) || "America/Sao_Paulo";

                const { data: hist } = await adminClient
                  .from("whatsapp_message_logs")
                  .select("status, body, sent_at")
                  .eq("tenant_id", tenantId)
                  .eq("recipient_phone", senderPhone)
                  .order("sent_at", { ascending: false })
                  .limit(10);

                const history = (hist ?? [])
                  .reverse()
                  .filter((m: any) => m.body && (m.body as string).trim())
                  .map((m: any) => ({
                    role: m.status === "sent" ? ("assistant" as const) : ("user" as const),
                    content: m.body as string,
                  }));

                if (leadId && !leadName) {
                  const extracted = await extractNameFromMessage(text);
                  if (extracted && isValidContactName(extracted, senderPhone)) {
                    await adminClient.from("leads").update({ full_name: extracted }).eq("id", leadId);
                    leadName = extracted;
                  }
                }

                const { data: aiCfg } = await adminClient
                  .from("ai_configs")
                  .select("*")
                  .eq("tenant_id", tenantId)
                  .maybeSingle();

                if ((aiCfg as any)?.training_mode === true) {
                  console.log(`[sdr] pulado: modo de aprendizado ativo`);
                } else {
                  const { data: docs } = await adminClient
                    .from("ai_knowledge_documents")
                    .select("name, content")
                    .eq("tenant_id", tenantId)
                    .eq("status", "ready");
                  const knowledgeTexts = (docs ?? [])
                    .filter((d: any) => d.content && d.content.trim())
                    .map((d: any) => `[${d.name}]\n${(d.content as string).slice(0, 3000)}`);
                  const systemPrompt = buildSdrSystemPrompt(aiCfg, knowledgeTexts, {
                    hoursContext: buildHoursContext(
                      (cfg as any).business_hours as BusinessHours | null,
                      timezone,
                    ),
                    leadName,
                    leadFirstName: leadName ? firstName(leadName) : null,
                  }, timezone);
                  const temperature = Number((aiCfg as any)?.model_temperature) || 0.7;

                  const reply = await generateSdrReply(systemPrompt, history, temperature, tenantId, leadId, timezone);
                  const outboundText = reply || SDR_FALLBACK_REPLY;

                  const sent = await sendWhatsAppText(cfg.instance_token, senderPhone, outboundText);
                  await adminClient.from("whatsapp_message_logs").insert({
                    tenant_id: tenantId,
                    recipient_phone: senderPhone,
                    message_type: "text",
                    status: sent ? "sent" : "failed",
                    body: outboundText.slice(0, 500),
                    failure_reason: sent ? null : "Falha ao enviar via WhatsApp",
                    sender_name: reply ? "IA SDR" : "IA SDR (fallback)",
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

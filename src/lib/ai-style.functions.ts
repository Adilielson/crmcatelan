// Perfil de estilo da "atendente referência" (ex.: Raiana).
// A IA Sombra extrai o jeito de atender dos agentes marcados como referência
// e devolve um style_prompt + métricas usadas pelo prompt da IA SDR.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const REBUILD_DEBOUNCE_MS = 60 * 60 * 1000; // 1h

const POSITIVE_OUTCOMES = new Set(["scheduled", "checked_in", "showed_up", "negotiating"]);

async function getTenantAndRole(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("tenant_id, role")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.tenant_id) throw new Error("Tenant não encontrado");
  return { tenantId: data.tenant_id as string, role: data.role as string };
}

function ensureAdmin(role: string) {
  if (!["admin", "super_admin"].includes(role)) {
    throw new Error("Apenas administradores podem alterar referências de atendimento");
  }
}

// ---------- Helpers de extração determinística ----------
function analyzeMessages(texts: string[]) {
  const clean = texts.map((t) => (t ?? "").trim()).filter((t) => t.length > 0);
  if (clean.length === 0) {
    return {
      sample_count: 0,
      avg_msg_length: 0,
      pct_with_question: 0,
      pct_with_emoji: 0,
      pct_uses_client_name: 0,
      avg_sentences_per_msg: 0,
      top_openings: [] as string[],
    };
  }
  const lengths = clean.map((t) => t.length);
  const avgLen = Math.round(lengths.reduce((a, b) => a + b, 0) / clean.length);
  const emojiRx = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  const sentenceRx = /[.!?…]+/g;
  const pctQuestion = Math.round((clean.filter((t) => t.includes("?")).length / clean.length) * 100);
  const pctEmoji = Math.round((clean.filter((t) => emojiRx.test(t)).length / clean.length) * 100);
  const sentencesAvg =
    clean.reduce((sum, t) => sum + Math.max(1, (t.match(sentenceRx) ?? []).length), 0) / clean.length;
  // openings: primeiras 2-3 palavras
  const opens = new Map<string, number>();
  for (const t of clean) {
    const first = t.split(/\s+/).slice(0, 2).join(" ").toLowerCase().replace(/[^\wáéíóúâêôãõç ]/gi, "");
    if (first.length > 1) opens.set(first, (opens.get(first) ?? 0) + 1);
  }
  const topOpenings = [...opens.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([k]) => k);
  return {
    sample_count: clean.length,
    avg_msg_length: avgLen,
    pct_with_question: pctQuestion,
    pct_with_emoji: pctEmoji,
    pct_uses_client_name: 0, // calculado fora (precisa do nome do cliente)
    avg_sentences_per_msg: Math.round(sentencesAvg * 10) / 10,
    top_openings: topOpenings,
  };
}

// ---------- Núcleo: reconstrói o style profile ----------
export async function buildStyleProfileCore(tenantId: string, opts?: { force?: boolean }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // 1. Debounce
  if (!opts?.force) {
    const { data: existing } = await supabaseAdmin
      .from("ai_reference_style_profiles")
      .select("last_built_at")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (existing?.last_built_at) {
      const age = Date.now() - new Date(existing.last_built_at).getTime();
      if (age < REBUILD_DEBOUNCE_MS) {
        return { ok: true, skipped: true, reason: "debounced", ageMs: age };
      }
    }
  }

  // 2. Agentes-referência
  const { data: refs } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name")
    .eq("tenant_id", tenantId)
    .eq("is_reference_agent", true)
    .eq("status", "active");

  if (!refs || refs.length === 0) {
    return { ok: false, reason: "no_reference_agents", sample_count: 0 };
  }
  const refIds = refs.map((r: any) => r.id);
  const refNames = refs
    .map((r: any) => (r.full_name ?? "").trim())
    .filter((n: string) => n.length > 1);
  const nameMatchers = refNames.map((n: string) => n.split(/\s+/)[0].toLowerCase());

  // 3. Leads atendidos por essas referências que terminaram bem (últimos 90 dias)
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: leads } = await supabaseAdmin
    .from("leads")
    .select("id, full_name, phone, status, updated_at")
    .eq("tenant_id", tenantId)
    .in("assigned_user_id", refIds)
    .in("status", ["scheduled", "checked_in", "showed_up", "negotiating"])
    .gte("updated_at", since)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (!leads || leads.length === 0) {
    return { ok: false, reason: "no_successful_leads", sample_count: 0 };
  }

  // 4. Coleta mensagens outbound dessas conversas (que vieram dos refs)
  const allOutbound: string[] = [];
  let usesClientNameHits = 0;
  let usesClientNameTotal = 0;

  for (const lead of leads) {
    if (!lead.phone) continue;
    const { data: logs } = await supabaseAdmin
      .from("whatsapp_message_logs")
      .select("status, sender_name, error_message")
      .eq("tenant_id", tenantId)
      .eq("recipient_phone", lead.phone)
      .order("sent_at", { ascending: true })
      .limit(80);
    if (!logs) continue;
    const outboundFromRef = logs.filter((m: any) => {
      if (m.status !== "sent") return false;
      const sender = String(m.sender_name ?? "").toLowerCase().trim();
      if (sender === "ia sdr") return false;
      if (!sender) return false;
      return nameMatchers.some((n) => sender.includes(n));
    });
    const firstClientName = (lead.full_name ?? "").trim().split(/\s+/)[0]?.toLowerCase();
    for (const m of outboundFromRef) {
      const text = String(m.error_message ?? "").trim();
      if (text.length < 2) continue;
      allOutbound.push(text);
      if (firstClientName && firstClientName.length > 2) {
        usesClientNameTotal++;
        if (text.toLowerCase().includes(firstClientName)) usesClientNameHits++;
      }
    }
  }

  if (allOutbound.length < 10) {
    return { ok: false, reason: "not_enough_messages", sample_count: allOutbound.length };
  }

  // 5. Métricas determinísticas
  const metrics = analyzeMessages(allOutbound);
  metrics.pct_uses_client_name =
    usesClientNameTotal > 0 ? Math.round((usesClientNameHits / usesClientNameTotal) * 100) : 0;

  // 6. Amostra para a IA descrever o estilo
  const sample = allOutbound
    .slice(0, 80)
    .map((t, i) => `${i + 1}. ${t.slice(0, 240)}`)
    .join("\n");

  const { getTenantAiKey, logAiUsage } = await import("./ai-credentials.server");
  const cred = await getTenantAiKey(tenantId, "openai");

  const refLabel = refNames.join(", ") || "atendente de referência";
  const metaPrompt = `Você é um analista de comunicação. Abaixo estão ${allOutbound.length} mensagens reais enviadas via WhatsApp pela atendente de referência (${refLabel}) em conversas que terminaram em agendamento ou venda.

Sua tarefa: descrever o ESTILO de atendimento dela em até 8 bullets curtos e diretos, em português. Foque em:
- comprimento típico das mensagens
- ritmo (quantas perguntas, se faz uma de cada vez)
- tom (formal/informal, cordial, direto, consultivo)
- uso de emoji, gírias, sinais de pontuação
- gatilhos que ela usa para avançar a conversa
- o que ela NÃO faz (vícios da IA a evitar)

Responda APENAS o texto dos bullets, sem cabeçalho, sem markdown.

Métricas observadas:
- ${metrics.sample_count} mensagens analisadas
- média de ${metrics.avg_msg_length} caracteres por mensagem
- ${metrics.pct_with_question}% têm pergunta
- ${metrics.pct_with_emoji}% têm emoji
- ${metrics.pct_uses_client_name}% usam o nome do cliente
- aberturas frequentes: ${metrics.top_openings.slice(0, 4).join(", ") || "—"}

Mensagens:
${sample}`;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cred.apiKey}`,
    },
    body: JSON.stringify({
      model: cred.model || "gpt-4o-mini",
      temperature: 0.3,
      messages: [{ role: "user", content: metaPrompt.slice(0, 14000) }],
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`OpenAI ${resp.status}: ${txt.slice(0, 200)}`);
  }
  const json = await resp.json();
  const stylePrompt = (json?.choices?.[0]?.message?.content ?? "").trim();
  const usage = json?.usage ?? {};
  await logAiUsage({
    tenantId,
    provider: "openai",
    model: cred.model,
    tokensInput: Number(usage.prompt_tokens || 0),
    tokensOutput: Number(usage.completion_tokens || 0),
    usedFallback: cred.source === "master",
    source: cred.source,
    feature: "ai-style-profile",
  });

  if (!stylePrompt) throw new Error("IA não retornou descrição de estilo");

  // 7. Upsert
  await supabaseAdmin.from("ai_reference_style_profiles").upsert(
    {
      tenant_id: tenantId,
      style_guide: { ...metrics, reference_names: refNames },
      style_prompt: stylePrompt,
      sample_count: allOutbound.length,
      reference_agent_ids: refIds,
      last_built_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id" },
  );

  return {
    ok: true,
    sample_count: allOutbound.length,
    metrics,
    style_prompt: stylePrompt,
  };
}

// Disparo "fire-and-forget" usado por triggers internos (não awaitado pelo caller)
export async function maybeRebuildStyleProfile(tenantId: string) {
  try {
    await buildStyleProfileCore(tenantId);
  } catch (e: any) {
    console.error("[ai-style] rebuild silencioso falhou:", e?.message ?? e);
  }
}

// Carrega o bloco pronto pra colar no system prompt da IA SDR
export async function loadStyleBlockForPrompt(tenantId: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("ai_reference_style_profiles")
    .select("style_prompt, style_guide, sample_count")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!data?.style_prompt) return "";
  const g = (data.style_guide ?? {}) as any;
  const lines: string[] = [];
  lines.push("=== ESTILO DE ATENDIMENTO DA REFERÊNCIA (siga rigorosamente) ===");
  lines.push(data.style_prompt);
  lines.push("");
  lines.push("Métricas a respeitar:");
  if (g.avg_msg_length) lines.push(`- Mensagens curtas: alvo ~${g.avg_msg_length} caracteres (no máx 1.5x isso).`);
  lines.push(`- No máximo 1 pergunta por mensagem.`);
  lines.push(
    g.pct_with_emoji && g.pct_with_emoji >= 30
      ? "- Emoji ocasional (1 no máximo, e só quando combinar com o tom)."
      : "- Sem emojis.",
  );
  if (g.pct_uses_client_name && g.pct_uses_client_name >= 30) {
    lines.push("- Use o primeiro nome do cliente quando souber.");
  }
  lines.push("- Não soe como bot: nada de frases prontas, listas numeradas, ou tom corporativo.");
  return lines.join("\n");
}

// ---------- Server fns expostos ao front ----------
export const getReferenceStyleProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { tenantId } = await getTenantAndRole(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("ai_reference_style_profiles")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    const { data: refs } = await context.supabase
      .from("profiles")
      .select("id, full_name")
      .eq("tenant_id", tenantId)
      .eq("is_reference_agent", true);
    return {
      profile: data ?? null,
      reference_agents: refs ?? [],
    };
  });

export const rebuildReferenceStyleProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { tenantId, role } = await getTenantAndRole(context.supabase, context.userId);
    ensureAdmin(role);
    return buildStyleProfileCore(tenantId, { force: true });
  });

export const toggleReferenceAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const i = input as { profileId?: string; value?: boolean };
    if (!i?.profileId) throw new Error("profileId obrigatório");
    return { profileId: i.profileId, value: !!i.value };
  })
  .handler(async ({ data, context }) => {
    const { tenantId, role } = await getTenantAndRole(context.supabase, context.userId);
    ensureAdmin(role);
    const { error } = await context.supabase
      .from("profiles")
      .update({ is_reference_agent: data.value })
      .eq("id", data.profileId)
      .eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export { POSITIVE_OUTCOMES };

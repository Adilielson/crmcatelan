// IA Sombra — analisa conversas manuais para extrair aprendizado.
// Triggered manualmente ou após mudança de status do lead.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getUserTenantAndRole(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("tenant_id, role")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.tenant_id) throw new Error("Tenant não encontrado");
  return { tenantId: data.tenant_id as string, role: data.role as string };
}

const ALLOWED_ROLES = ["admin", "super_admin", "manager", "marketing_partner"];

function ensureCanRead(role: string) {
  if (!ALLOWED_ROLES.includes(role)) {
    throw new Error("Sem permissão para visualizar insights de IA");
  }
}

// ── Núcleo de análise (reutilizável: chamado manualmente ou pelo Modo Aprendizado) ──
async function runLeadAnalysisCore(tenantId: string, leadId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Lead
  const { data: lead, error: leadErr } = await supabaseAdmin
    .from("leads")
    .select("id, tenant_id, full_name, status, assigned_user_id, phone")
    .eq("id", leadId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (leadErr) throw new Error(leadErr.message);
  if (!lead) throw new Error("Lead não encontrado");
  if (!lead.phone) throw new Error("Lead sem telefone — sem conversa para analisar");

  // Mensagens (whatsapp_message_logs é a fonte real do sistema)
  const { data: logs, error: logsErr } = await supabaseAdmin
    .from("whatsapp_message_logs")
    .select("status, sender_name, error_message, sent_at")
    .eq("tenant_id", tenantId)
    .eq("recipient_phone", lead.phone)
    .order("sent_at", { ascending: true })
    .limit(200);
  if (logsErr) throw new Error(logsErr.message);

  const filtered = (logs ?? []).filter(
    (m: any) => typeof m.error_message === "string" && m.error_message.trim().length > 0,
  );
  if (filtered.length < 4) {
    throw new Error("Conversa sem mensagens suficientes para análise (mínimo 4)");
  }

  // Precisamos de pelo menos uma mensagem do atendente HUMANO (não IA SDR)
  const hasHuman = filtered.some(
    (m: any) => m.status === "sent" && (m.sender_name ?? "") !== "IA SDR",
  );

  const transcript = filtered
    .map((m: any) => {
      const who =
        m.status === "received"
          ? "CLIENTE"
          : (m.sender_name ?? "") === "IA SDR"
          ? "IA"
          : "ATENDENTE";
      return `[${who}] ${m.error_message}`;
    })
    .join("\n");

  const { getTenantAiKey, logAiUsage } = await import("./ai-credentials.server");
  const cred = await getTenantAiKey(tenantId, "openai");

  const systemPrompt = `Você é um analista de atendimento ao cliente. Analise a conversa abaixo entre um cliente e um atendente humano de uma ótica/clínica${
    hasHuman ? "" : " (atendimento feito pela IA — analise mesmo assim)"
  }. Extraia aprendizados em JSON puro (sem markdown). Responda APENAS com o objeto:
{
  "summary": "resumo em 1-2 frases sobre o estado atual da negociação",
  "sentiment": "positive" | "neutral" | "negative",
  "urgency": "baixa" | "media" | "alta",
  "score": número inteiro de 0 a 100 (temperatura do lead — probabilidade de fechar),
  "intent": "intenção principal em poucas palavras",
  "interests": ["produto/serviço de interesse 1", "produto 2"],
  "frequent_questions": ["pergunta 1", "pergunta 2"],
  "objections": ["objeção 1"],
  "keywords": ["palavra1", "palavra2"],
  "successful_responses": ["frase do atendente humano que funcionou bem"]
}`;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cred.apiKey}`,
    },
    body: JSON.stringify({
      model: cred.model || "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: transcript.slice(0, 12000) },
      ],
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`OpenAI ${resp.status}: ${txt.slice(0, 200)}`);
  }

  const json = await resp.json();
  const content = json?.choices?.[0]?.message?.content ?? "{}";
  let parsed: any = {};
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("IA retornou JSON inválido");
  }
  const usage = json?.usage ?? {};
  const tokensIn = Number(usage.prompt_tokens || 0);
  const tokensOut = Number(usage.completion_tokens || 0);

  await logAiUsage({
    tenantId,
    provider: "openai",
    model: cred.model,
    tokensInput: tokensIn,
    tokensOutput: tokensOut,
    usedFallback: cred.source === "master",
    source: cred.source,
    feature: "ai-insights",
  });

  const insightPayload = {
    tenant_id: tenantId,
    lead_id: lead.id,
    conversation_id: null as any,
    summary: parsed.summary ?? null,
    sentiment: parsed.sentiment ?? null,
    intent: parsed.intent ?? null,
    frequent_questions: parsed.frequent_questions ?? [],
    objections: parsed.objections ?? [],
    keywords: parsed.keywords ?? [],
    successful_responses: parsed.successful_responses ?? [],
    outcome: lead.status,
    agent_id: lead.assigned_user_id,
    message_count: filtered.length,
    tokens_used: tokensIn + tokensOut,
    model: cred.model,
    updated_at: new Date().toISOString(),
  };

  await supabaseAdmin.from("ai_learning_insights").delete().eq("lead_id", lead.id);
  const { error: insErr } = await supabaseAdmin
    .from("ai_learning_insights")
    .insert(insightPayload);
  if (insErr) throw new Error(insErr.message);

  // Espelha o resultado nos campos visíveis do lead (painel SDR Insight)
  const sentimentoMap: Record<string, string> = {
    positive: "Positivo",
    neutral: "Neutro",
    negative: "Negativo",
  };
  const urgenciaMap: Record<string, string> = {
    baixa: "Baixa",
    media: "Média",
    alta: "Alta",
  };
  const rawScore = Number(parsed.score);
  const scoreIa = Number.isFinite(rawScore)
    ? Math.max(0, Math.min(100, Math.round(rawScore)))
    : null;
  const interesses = Array.isArray(parsed.interests)
    ? parsed.interests.filter((x: any) => typeof x === "string" && x.trim()).slice(0, 8)
    : Array.isArray(parsed.keywords)
    ? parsed.keywords.filter((x: any) => typeof x === "string" && x.trim()).slice(0, 8)
    : [];

  await supabaseAdmin
    .from("leads")
    .update({
      score_ia: scoreIa,
      ia_summary: parsed.summary ?? null,
      ia_sentimento: sentimentoMap[String(parsed.sentiment ?? "").toLowerCase()] ?? null,
      ia_urgencia: urgenciaMap[String(parsed.urgency ?? "").toLowerCase()] ?? null,
      ia_interesses: interesses,
    })
    .eq("id", lead.id)
    .eq("tenant_id", tenantId);

  await aggregatePatterns(supabaseAdmin, tenantId, parsed, lead.status);

  return { ok: true, insight: parsed, tokens: tokensIn + tokensOut, messageCount: filtered.length };
}

// =================== ANALISAR CONVERSA (manual via UI) ===================
export const analyzeLeadConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const i = input as { leadId?: string };
    if (!i?.leadId) throw new Error("leadId obrigatório");
    return { leadId: i.leadId };
  })
  .handler(async ({ data, context }) => {
    const { tenantId } = await getUserTenantAndRole(context.supabase, context.userId);
    return runLeadAnalysisCore(tenantId, data.leadId);
  });

// =================== MODO DE APRENDIZADO ===================
// Observa conversas reais entre atendentes humanos e clientes e extrai
// aprendizados automaticamente. Pode ser disparado pela UI (botão) ou por
// um cron público (/api/public/hooks/ai-training-observer).
export const processTrainingObservations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { tenantId, role } = await getUserTenantAndRole(context.supabase, context.userId);
    ensureCanRead(role);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) tenant precisa ter Modo de Aprendizado ligado
    const { data: cfg } = await supabaseAdmin
      .from("ai_configs")
      .select("training_mode")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!cfg?.training_mode) {
      return { ok: false, analyzed: 0, skipped: 0, reason: "Modo de Aprendizado está desligado" };
    }

    // 2) leads atendidos por humanos nos últimos 14 dias
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: leads, error: lErr } = await supabaseAdmin
      .from("leads")
      .select("id, phone, updated_at, assigned_user_id")
      .eq("tenant_id", tenantId)
      .not("assigned_user_id", "is", null)
      .not("phone", "is", null)
      .gte("updated_at", since)
      .order("updated_at", { ascending: false })
      .limit(25);
    if (lErr) throw new Error(lErr.message);

    let analyzed = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const lead of leads ?? []) {
      try {
        // pula se já temos insight recente (últimas 2h ou mais novo que última msg)
        const { data: existing } = await supabaseAdmin
          .from("ai_learning_insights")
          .select("updated_at")
          .eq("lead_id", lead.id)
          .maybeSingle();
        if (existing?.updated_at) {
          const age = Date.now() - new Date(existing.updated_at).getTime();
          if (age < 2 * 60 * 60 * 1000) {
            skipped++;
            continue;
          }
        }
        await runLeadAnalysisCore(tenantId, lead.id);
        analyzed++;
      } catch (e: any) {
        skipped++;
        errors.push(`${lead.id}: ${e?.message ?? String(e)}`);
      }
    }

    return { ok: true, analyzed, skipped, errors: errors.slice(0, 5) };
  });



async function aggregatePatterns(
  admin: any,
  tenantId: string,
  parsed: any,
  outcome: string | null,
) {
  type Item = { type: string; content: string };
  const items: Item[] = [];
  (parsed.frequent_questions || []).forEach((q: string) =>
    items.push({ type: "frequent_question", content: String(q).trim() }),
  );
  (parsed.objections || []).forEach((o: string) =>
    items.push({ type: "objection", content: String(o).trim() }),
  );
  (parsed.keywords || []).forEach((k: string) =>
    items.push({ type: "keyword", content: String(k).trim() }),
  );
  (parsed.successful_responses || []).forEach((s: string) =>
    items.push({ type: "winning_phrase", content: String(s).trim() }),
  );

  for (const it of items) {
    if (!it.content || it.content.length < 2) continue;
    const truncated = it.content.slice(0, 500);
    // Upsert por (tenant, type, content)
    const { data: existing } = await admin
      .from("ai_knowledge_patterns")
      .select("id, occurrences")
      .eq("tenant_id", tenantId)
      .eq("pattern_type", it.type)
      .eq("content", truncated)
      .maybeSingle();

    if (existing?.id) {
      await admin
        .from("ai_knowledge_patterns")
        .update({
          occurrences: existing.occurrences + 1,
          last_seen_at: new Date().toISOString(),
          related_outcome: outcome,
        })
        .eq("id", existing.id);
    } else {
      await admin.from("ai_knowledge_patterns").insert({
        tenant_id: tenantId,
        pattern_type: it.type,
        content: truncated,
        occurrences: 1,
        related_outcome: outcome,
      });
    }
  }
}

// =================== DASHBOARD ===================
export const getInsightsDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { tenantId, role } = await getUserTenantAndRole(
      context.supabase,
      context.userId,
    );
    ensureCanRead(role);

    const [patternsRes, recentRes, countsRes] = await Promise.all([
      context.supabase
        .from("ai_knowledge_patterns")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("occurrences", { ascending: false })
        .limit(200),
      context.supabase
        .from("ai_learning_insights")
        .select("id, lead_id, summary, sentiment, intent, outcome, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(20),
      context.supabase
        .from("ai_learning_insights")
        .select("sentiment, outcome", { count: "exact" })
        .eq("tenant_id", tenantId),
    ]);

    if (patternsRes.error) throw new Error(patternsRes.error.message);
    if (recentRes.error) throw new Error(recentRes.error.message);

    const patterns = patternsRes.data || [];
    const top = (type: string, n = 10) =>
      patterns.filter((p: any) => p.pattern_type === type).slice(0, n);

    const all = countsRes.data || [];
    const sentimentBreakdown = all.reduce(
      (acc: Record<string, number>, r: any) => {
        const s = r.sentiment || "unknown";
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      },
      {},
    );

    return {
      totalAnalyzed: all.length,
      sentimentBreakdown,
      topQuestions: top("frequent_question"),
      topObjections: top("objection"),
      topKeywords: top("keyword", 20),
      winningPhrases: top("winning_phrase"),
      recentInsights: recentRes.data || [],
    };
  });

// =================== INLINE — insight do lead atual ===================
export const getLeadInsight = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const i = input as { leadId?: string };
    if (!i?.leadId) throw new Error("leadId obrigatório");
    return { leadId: i.leadId };
  })
  .handler(async ({ data, context }) => {
    const { tenantId } = await getUserTenantAndRole(
      context.supabase,
      context.userId,
    );
    const { data: row } = await context.supabase
      .from("ai_learning_insights")
      .select("summary, sentiment, intent, frequent_questions, objections, successful_responses, updated_at")
      .eq("tenant_id", tenantId)
      .eq("lead_id", data.leadId)
      .maybeSingle();
    return row;
  });

// =================== SUGERIR RESPOSTA (inline no composer) ===================
export const suggestReplyForLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const i = input as { leadId?: string; hint?: string };
    if (!i?.leadId) throw new Error("leadId obrigatório");
    return { leadId: i.leadId, hint: typeof i.hint === "string" ? i.hint : "" };
  })
  .handler(async ({ data, context }) => {
    const { tenantId } = await getUserTenantAndRole(context.supabase, context.userId);

    const { data: lead, error: leadErr } = await context.supabase
      .from("leads")
      .select("id, tenant_id, full_name, status")
      .eq("id", data.leadId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (leadErr) throw new Error(leadErr.message);
    if (!lead) throw new Error("Lead não encontrado");

    const { data: conv } = await context.supabase
      .from("conversations")
      .select("id")
      .eq("lead_id", lead.id)
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!conv) throw new Error("Nenhuma conversa encontrada para este lead");

    const { data: messages, error: msgErr } = await context.supabase
      .from("messages")
      .select("direction, content, created_at")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (msgErr) throw new Error(msgErr.message);
    if (!messages || messages.length === 0) {
      throw new Error("Sem mensagens para gerar sugestão");
    }

    const transcript = [...messages]
      .reverse()
      .map((m: any) => {
        const who = m.direction === "incoming" ? "CLIENTE" : "ATENDENTE";
        return `[${who}] ${m.content ?? "(sem texto)"}`;
      })
      .join("\n");

    // Contexto extra: top objeções/perguntas frequentes do tenant para enriquecer sugestão
    const { data: patterns } = await context.supabase
      .from("ai_knowledge_patterns")
      .select("pattern_type, content")
      .eq("tenant_id", tenantId)
      .in("pattern_type", ["winning_phrase", "objection"])
      .order("occurrences", { ascending: false })
      .limit(20);

    const winning = (patterns || []).filter((p: any) => p.pattern_type === "winning_phrase").map((p: any) => `- ${p.content}`).join("\n");
    const objections = (patterns || []).filter((p: any) => p.pattern_type === "objection").map((p: any) => `- ${p.content}`).join("\n");

    const { getTenantAiKey, logAiUsage } = await import("./ai-credentials.server");
    const cred = await getTenantAiKey(tenantId, "openai");

    const systemPrompt = `Você é um atendente humano de uma ótica/clínica conversando via WhatsApp em português brasileiro. Gere UMA sugestão de resposta para a próxima mensagem do atendente, baseada na conversa abaixo.
Regras:
- Tom natural, humano, cordial, curto (até 2-3 frases).
- Sem markdown, sem emojis exagerados (no máx 1).
- Não invente preços, horários ou produtos que não foram mencionados.
- Se o cliente fez pergunta, responda direto. Se está em dúvida, ajude a avançar.
- Retorne APENAS o texto da mensagem sugerida, sem aspas, sem prefixos como "Atendente:".

${winning ? `Frases que costumam funcionar bem com nossos clientes:\n${winning}\n` : ""}
${objections ? `Objeções comuns para considerar:\n${objections}\n` : ""}
${data.hint ? `Direcionamento do atendente: ${data.hint}` : ""}`;

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cred.apiKey}`,
      },
      body: JSON.stringify({
        model: cred.model || "gpt-4o-mini",
        temperature: 0.6,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: transcript.slice(0, 8000) },
        ],
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`OpenAI ${resp.status}: ${txt.slice(0, 200)}`);
    }

    const json = await resp.json();
    const suggestion = (json?.choices?.[0]?.message?.content ?? "").trim();
    const usage = json?.usage ?? {};
    const tokensIn = Number(usage.prompt_tokens || 0);
    const tokensOut = Number(usage.completion_tokens || 0);

    await logAiUsage({
      tenantId,
      provider: "openai",
      model: cred.model,
      tokensInput: tokensIn,
      tokensOutput: tokensOut,
      usedFallback: cred.source === "master",
      source: cred.source,
      feature: "ai-suggest-reply",
    });

    if (!suggestion) throw new Error("IA não retornou sugestão");
    return { suggestion, tokens: tokensIn + tokensOut };
  });

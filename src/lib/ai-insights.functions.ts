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

// =================== ANALISAR CONVERSA ===================
export const analyzeLeadConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const i = input as { leadId?: string };
    if (!i?.leadId) throw new Error("leadId obrigatório");
    return { leadId: i.leadId };
  })
  .handler(async ({ data, context }) => {
    const { tenantId } = await getUserTenantAndRole(context.supabase, context.userId);

    // Busca lead
    const { data: lead, error: leadErr } = await context.supabase
      .from("leads")
      .select("id, tenant_id, full_name, status, assigned_user_id")
      .eq("id", data.leadId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (leadErr) throw new Error(leadErr.message);
    if (!lead) throw new Error("Lead não encontrado");

    // Busca conversa + mensagens
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
      .order("created_at", { ascending: true })
      .limit(200);
    if (msgErr) throw new Error(msgErr.message);
    if (!messages || messages.length < 2) {
      throw new Error("Conversa sem mensagens suficientes para análise");
    }

    // Monta transcript
    const transcript = messages
      .map((m: any) => {
        const who = m.direction === "incoming" ? "CLIENTE" : "ATENDENTE";
        return `[${who}] ${m.content ?? "(sem texto)"}`;
      })
      .join("\n");

    // Resolve credencial IA (reusa helper existente)
    const { getTenantAiKey, logAiUsage } = await import("./ai-credentials.server");
    const cred = await getTenantAiKey(tenantId, "openai");

    const systemPrompt = `Você é um analista de atendimento ao cliente. Analise a conversa abaixo entre um cliente e um atendente humano de uma ótica/clínica. Extraia aprendizados em JSON puro (sem markdown, sem comentários). Responda APENAS com o objeto JSON, no formato:
{
  "summary": "resumo da conversa em 1-2 frases",
  "sentiment": "positive" | "neutral" | "negative",
  "intent": "intenção principal do cliente em poucas palavras",
  "frequent_questions": ["pergunta 1", "pergunta 2"],
  "objections": ["objeção 1", "objeção 2"],
  "keywords": ["palavra1", "palavra2"],
  "successful_responses": ["frase do atendente que funcionou bem"]
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

    // Log usage
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

    // Upsert insight (1 por lead — substitui análise antiga)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const insightPayload = {
      tenant_id: tenantId,
      lead_id: lead.id,
      conversation_id: conv.id,
      summary: parsed.summary ?? null,
      sentiment: parsed.sentiment ?? null,
      intent: parsed.intent ?? null,
      frequent_questions: parsed.frequent_questions ?? [],
      objections: parsed.objections ?? [],
      keywords: parsed.keywords ?? [],
      successful_responses: parsed.successful_responses ?? [],
      outcome: lead.status,
      agent_id: lead.assigned_user_id,
      message_count: messages.length,
      tokens_used: tokensIn + tokensOut,
      model: cred.model,
      updated_at: new Date().toISOString(),
    };

    // Remove insight antigo do mesmo lead e insere o novo
    await supabaseAdmin.from("ai_learning_insights").delete().eq("lead_id", lead.id);
    const { error: insErr } = await supabaseAdmin
      .from("ai_learning_insights")
      .insert(insightPayload);
    if (insErr) throw new Error(insErr.message);

    // Agrega padrões
    await aggregatePatterns(supabaseAdmin, tenantId, parsed, lead.status);

    return { ok: true, insight: parsed, tokens: tokensIn + tokensOut };
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

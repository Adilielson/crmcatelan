import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type QualificationQuestion = string;

export type AiConfig = {
  id: string;
  tenant_id: string;
  prompt_system: string;
  knowledge_base: string;
  knowledge_base_faq: string;
  sample_scripts: string;
  qualification_questions: QualificationQuestion[];
  response_delay: number;
  scheduling_link: string;
  goal: string;
  model_temperature: number;
  training_mode: boolean;
  autopilot_enabled: boolean;
  rejection_instructions: string;
  response_restrictions: string[];
  updated_at: string;
};

async function getUserTenant(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.tenant_id) throw new Error("Tenant não encontrado para o usuário");
  return data.tenant_id as string;
}

export const getAiConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const tenantId = await getUserTenant(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("ai_configs")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Configuração de IA não encontrada para este tenant");
    return data as AiConfig;
  });

export const updateAiConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const i = input as Partial<AiConfig>;
    if (!i || typeof i !== "object") throw new Error("Payload inválido");
    return i;
  })
  .handler(async ({ data, context }) => {
    const tenantId = await getUserTenant(context.supabase, context.userId);
    const allowed: (keyof AiConfig)[] = [
      "prompt_system", "knowledge_base", "knowledge_base_faq", "sample_scripts",
      "qualification_questions", "response_delay", "scheduling_link", "goal",
      "model_temperature", "training_mode", "autopilot_enabled", "rejection_instructions", "response_restrictions",
    ];
    const payload: Record<string, unknown> = {};
    for (const k of allowed) if (k in data) payload[k] = (data as any)[k];

    const { error } = await context.supabase
      .from("ai_configs")
      .update(payload as any)
      .eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAiVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const tenantId = await getUserTenant(context.supabase, context.userId);
    const { data: cfg } = await context.supabase
      .from("ai_configs").select("id").eq("tenant_id", tenantId).maybeSingle();
    if (!cfg?.id) return [];
    const { data, error } = await context.supabase
      .from("ai_config_versions")
      .select("id, created_at, created_by, config_snapshot")
      .eq("ai_config_id", cfg.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const restoreAiVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const i = input as { version_id: string };
    if (!i?.version_id) throw new Error("version_id obrigatório");
    return i;
  })
  .handler(async ({ data, context }) => {
    const tenantId = await getUserTenant(context.supabase, context.userId);
    const { data: version, error: vErr } = await context.supabase
      .from("ai_config_versions")
      .select("config_snapshot")
      .eq("id", data.version_id)
      .maybeSingle();
    if (vErr) throw new Error(vErr.message);
    if (!version?.config_snapshot) throw new Error("Versão não encontrada");
    const snap = version.config_snapshot as Record<string, any>;
    const payload = {
      prompt_system: snap.prompt_system,
      knowledge_base: snap.knowledge_base,
      knowledge_base_faq: snap.knowledge_base_faq,
      sample_scripts: snap.sample_scripts,
      qualification_questions: snap.qualification_questions,
      response_delay: snap.response_delay,
      scheduling_link: snap.scheduling_link,
      goal: snap.goal,
      model_temperature: snap.model_temperature,
      rejection_instructions: snap.rejection_instructions,
      response_restrictions: snap.response_restrictions,
    };
    const { error } = await context.supabase
      .from("ai_configs").update(payload).eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

function buildSystemPrompt(cfg: AiConfig, knowledgeDocs: string[], styleBlock: string = ""): string {
  const parts: string[] = [cfg.prompt_system || "Você é um atendente da Ótica Catelan."];
  if (styleBlock) parts.push(styleBlock);
  if (cfg.goal) parts.push(`Objetivo principal da conversa: ${cfg.goal === "appointment" ? "agendar uma consulta" : cfg.goal === "qualification" ? "qualificar o lead" : "dar suporte"}.`);
  if (cfg.scheduling_link) parts.push(`Link de agendamento (use quando o lead pedir): ${cfg.scheduling_link}`);

  // Sábados disponíveis do Oftalmologista (revezamento)
  const saturdays = Array.isArray((cfg as any).ophthalmologist_saturdays)
    ? ((cfg as any).ophthalmologist_saturdays as string[])
    : [];
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = saturdays.filter((d) => d >= today).sort().slice(0, 8);
  if (upcoming.length) {
    const fmt = upcoming.map((d) => {
      const [y, m, day] = d.split("-");
      return `${day}/${m}/${y}`;
    }).join(", ");
    parts.push(`SÁBADOS DISPONÍVEIS DO OFTALMOLOGISTA (próximos): ${fmt}. Só ofereça sábado para oftalmologista nessas datas. Se o lead pedir outro sábado, explique que naquele a agenda está fechada e ofereça a próxima da lista ou a quarta-feira (15h-17h).`);
  } else {
    parts.push(`OFTALMOLOGISTA NO SÁBADO: nenhuma data de sábado disponível no momento. Ofereça apenas quarta-feira (15h-17h) com o oftalmologista, ou optometrista de segunda a domingo a partir das 14h.`);
  }

  if (cfg.knowledge_base_faq?.trim()) parts.push(`BASE DE CONHECIMENTO (FAQ):\n${cfg.knowledge_base_faq}`);
  if (knowledgeDocs.length) parts.push(`DOCUMENTOS DE REFERÊNCIA:\n${knowledgeDocs.join("\n---\n").slice(0, 8000)}`);
  if (cfg.sample_scripts?.trim()) parts.push(`EXEMPLOS DE ATENDIMENTO (mimetize o estilo):\n${cfg.sample_scripts}`);
  if (Array.isArray(cfg.qualification_questions) && cfg.qualification_questions.length) {
    parts.push(`PERGUNTAS DE QUALIFICAÇÃO (faça uma por vez, na ordem):\n${cfg.qualification_questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`);
  }
  if (cfg.rejection_instructions?.trim()) parts.push(`O QUE NÃO FAZER:\n${cfg.rejection_instructions}`);
  if (Array.isArray(cfg.response_restrictions) && cfg.response_restrictions.length) {
    parts.push(`Restrições: ${cfg.response_restrictions.join(", ")}`);
  }
  return parts.join("\n\n");
}

export const simulateChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const i = input as { messages: { role: "user" | "assistant"; content: string }[] };
    if (!Array.isArray(i?.messages)) throw new Error("messages obrigatório");
    return i;
  })
  .handler(async ({ data, context }) => {
    const tenantId = await getUserTenant(context.supabase, context.userId);
    const { data: cfg, error } = await context.supabase
      .from("ai_configs").select("*").eq("tenant_id", tenantId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!cfg) throw new Error("Sem configuração de IA");

    const { data: docs } = await context.supabase
      .from("ai_knowledge_documents")
      .select("name, content")
      .eq("tenant_id", tenantId)
      .eq("status", "ready");
    const knowledgeTexts = (docs ?? [])
      .filter((d: any) => d.content?.trim())
      .map((d: any) => `[${d.name}]\n${(d.content as string).slice(0, 3000)}`);

    const { loadStyleBlockForPrompt } = await import("./ai-style.functions");
    const styleBlock = await loadStyleBlockForPrompt(tenantId);
    const systemPrompt = buildSystemPrompt(cfg as AiConfig, knowledgeTexts, styleBlock);

    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY ausente");

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }, ...data.messages],
        temperature: Number((cfg as any).model_temperature) || 0.7,
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em alguns segundos.");
      if (res.status === 401) throw new Error("OPENAI_API_KEY inválida.");
      throw new Error(`OpenAI ${res.status}: ${txt.slice(0, 200)}`);
    }
    const json = await res.json();
    const reply = json?.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) throw new Error("Sem resposta do modelo");
    return { reply: reply.trim() };
  });

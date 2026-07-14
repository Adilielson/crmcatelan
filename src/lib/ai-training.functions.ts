import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const COPILOT_ALLOWED_ROLES = ["admin", "super_admin", "manager"];

async function assertCopilotRole(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.role || !COPILOT_ALLOWED_ROLES.includes(data.role)) {
    throw new Error("Apenas administradores ou gerentes podem usar o Copilot de Prompt.");
  }
}

export type QualificationQuestion = string;

export type AiConfig = {
  id: string;
  tenant_id: string;
  prompt_system: string;
  behavior_rules: string;
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
      "prompt_system", "behavior_rules", "knowledge_base", "knowledge_base_faq", "sample_scripts",
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

  // Só oferecemos exame de Optometrista (Oftalmologia descontinuada)
  parts.push(`TIPO DE EXAME DISPONÍVEL: apenas Optometrista (segunda a domingo a partir das 14h, conforme grade cadastrada). NÃO ofereça exame de Oftalmologia — foi descontinuado. NUNCA cite valor/preço do exame sem o cliente perguntar primeiro.`);


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

// ============ Prompt Copilot ============
// Editable fields the Copilot may propose changes to.
const COPILOT_EDITABLE_FIELDS = [
  "prompt_system",
  "behavior_rules",
  "sample_scripts",
  "rejection_instructions",
  "knowledge_base_faq",
  "qualification_questions",
] as const;
type CopilotField = (typeof COPILOT_EDITABLE_FIELDS)[number];

export type CopilotProposal = {
  summary: string;
  changes: Partial<Record<CopilotField, string | string[]>>;
  before: Partial<Record<CopilotField, string | string[]>>;
};

async function callCopilotLLM(instruction: string, cfg: any): Promise<CopilotProposal> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY ausente");

  const currentSnapshot = {
    prompt_system: cfg.prompt_system ?? "",
    behavior_rules: cfg.behavior_rules ?? "",
    sample_scripts: cfg.sample_scripts ?? "",
    rejection_instructions: cfg.rejection_instructions ?? "",
    knowledge_base_faq: cfg.knowledge_base_faq ?? "",
    qualification_questions: Array.isArray(cfg.qualification_questions) ? cfg.qualification_questions : [],
  };


  const system = `Você é um Copilot de Prompt Engineering para o CRM da Ótica Catelan.
Recebe UMA instrução em linguagem natural do administrador e a configuração atual da IA de atendimento.
Sua tarefa: reescrever os campos necessários para atender a instrução, mantendo tom, estrutura e regras existentes.

REGRAS:
- Só edite campos que precisam mudar. Não devolva campos inalterados.
- **Se a instrução mencionar "abordagem", "comportamento", "forma de atender", "jeito", "script", "postura", "estilo" ou pedir para MUDAR/CORRIGIR/AJUSTAR a maneira como a IA fala — você DEVE reescrever "prompt_system" (a persona) removendo trechos que conflitam com a instrução. Não basta mexer só em campos periféricos.**
- Se a instrução PROIBIR uma frase/pergunta, procure essa frase (e variantes) dentro de "prompt_system", "behavior_rules", "sample_scripts", "knowledge_base_faq" e "qualification_questions" e REMOVA de todos. Não deixe a instrução proibida sobreviver em nenhum campo.
- Preserve regras críticas já existentes (proibições, apenas Optometrista, não citar valor sem pergunta, não pedir documentos, script de rapport) exceto se a instrução pedir explicitamente para removê-las.
- "qualification_questions" é um array de strings (ordem importa).
- Demais campos são strings (texto multi-linha permitido) — pode devolver o texto completo reescrito.
- Responda SOMENTE em JSON estrito no formato:
  {
    "summary": "resumo curto em pt-BR do que mudou e por quê (cite os campos alterados)",
    "changes": { "<nome_do_campo>": <novo_valor>, ... }
  }
- Campos válidos em "changes": ${COPILOT_EDITABLE_FIELDS.join(", ")}.
- Se a instrução for ambígua ou perigosa (ex: apagar tudo), devolva changes vazio e explique em summary.`;


  const user = `INSTRUÇÃO DO ADMIN:
${instruction}

CONFIGURAÇÃO ATUAL (JSON):
${JSON.stringify(currentSnapshot, null, 2)}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    if (res.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em alguns segundos.");
    if (res.status === 401) throw new Error("OPENAI_API_KEY inválida.");
    throw new Error(`OpenAI ${res.status}: ${txt.slice(0, 200)}`);
  }

  const json = await res.json();
  const raw = json?.choices?.[0]?.message?.content;
  if (typeof raw !== "string") throw new Error("Resposta vazia do Copilot");
  let parsed: any;
  try { parsed = JSON.parse(raw); } catch { throw new Error("Copilot devolveu JSON inválido"); }

  const summary = typeof parsed?.summary === "string" ? parsed.summary : "";
  const changesRaw = parsed?.changes && typeof parsed.changes === "object" ? parsed.changes : {};
  const changes: CopilotProposal["changes"] = {};
  for (const k of COPILOT_EDITABLE_FIELDS) {
    if (!(k in changesRaw)) continue;
    const v = changesRaw[k];
    if (k === "qualification_questions") {
      if (Array.isArray(v)) changes[k] = v.map((x) => String(x)).filter(Boolean);
    } else if (typeof v === "string") {
      changes[k] = v;
    }
  }
  const before: CopilotProposal["before"] = {};
  for (const k of Object.keys(changes) as CopilotField[]) {
    before[k] = currentSnapshot[k] as any;
  }
  return { summary, changes, before };
}


export const generatePromptCopilot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const i = input as { instruction: string };
    if (!i?.instruction || typeof i.instruction !== "string" || !i.instruction.trim()) {
      throw new Error("Descreva a mudança desejada.");
    }
    if (i.instruction.length > 4000) throw new Error("Instrução muito longa (máx 4000 chars).");
    return { instruction: i.instruction.trim() };
  })
  .handler(async ({ data, context }) => {
    await assertCopilotRole(context.supabase, context.userId);
    const tenantId = await getUserTenant(context.supabase, context.userId);
    const { data: cfg, error } = await context.supabase
      .from("ai_configs").select("*").eq("tenant_id", tenantId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!cfg) throw new Error("Sem configuração de IA");
    const proposal = await callCopilotLLM(data.instruction, cfg);
    return proposal;
  });

export const applyPromptCopilot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const i = input as { changes: Record<string, unknown> };
    if (!i?.changes || typeof i.changes !== "object") throw new Error("Nenhuma alteração para aplicar.");
    return i;
  })
  .handler(async ({ data, context }) => {
    await assertCopilotRole(context.supabase, context.userId);
    const tenantId = await getUserTenant(context.supabase, context.userId);
    const payload: Record<string, unknown> = {};
    for (const k of COPILOT_EDITABLE_FIELDS) {
      if (!(k in (data.changes as any))) continue;
      const v = (data.changes as any)[k];
      if (k === "qualification_questions") {
        if (Array.isArray(v)) payload[k] = v.map((x) => String(x)).filter(Boolean);
      } else if (typeof v === "string") {
        payload[k] = v;
      }
    }
    if (Object.keys(payload).length === 0) throw new Error("Nada para aplicar.");
    const { error } = await context.supabase
      .from("ai_configs").update(payload as any).eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);
    return { ok: true, applied_fields: Object.keys(payload) };
  });

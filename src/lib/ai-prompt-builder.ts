// Shared prompt builder usado por AMBOS: o simulador (/api/ai-training/simulate-chat)
// e o WhatsApp webhook (via supabase/functions/whatsapp-webhook/index.ts).
//
// IMPORTANTE (multitenant): NENHUM texto de prompt mora no código.
// As regras vêm do banco: ai_configs.behavior_rules (editável no front) com
// fallback em ai_rule_templates.content (modelo padrão).
//
// NÃO importar nada de Node/Deno específico — precisa rodar em worker/edge/browser tests.

import { composeBehaviorRules } from "../../supabase/functions/whatsapp-webhook/prompt-rules";

export { composeBehaviorRules };

export type AiCfgLike = {
  prompt_system?: string | null;
  behavior_rules?: string | null;
  knowledge_base_faq?: string | null;
  sample_scripts?: string | null;
  qualification_questions?: string[] | null;
  scheduling_link?: string | null;
  goal?: string | null;
  rejection_instructions?: string | null;
  response_restrictions?: string[] | null;
};

/** Regras finais: exclusivamente o que está no banco (com fallback do modelo padrão). */
export function resolveBehaviorRules(
  cfg: AiCfgLike | null | undefined,
  defaultRules?: string | null,
): string {
  return composeBehaviorRules(cfg?.behavior_rules, defaultRules);
}

/** Contexto de tempo real — usado em ambos os lados para respeitar a Regra 8. */
export function buildNowContext(timezone: string): string {
  const tz = timezone || "America/Sao_Paulo";
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", weekday: "long",
    day: "2-digit", month: "2-digit",
  });
  const parts = fmt.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hh = get("hour");
  const mm = get("minute");
  const wd = get("weekday");
  const dd = get("day");
  const mo = get("month");
  return `AGORA são ${hh}:${mm} (${wd}, ${dd}/${mo}, fuso ${tz}). Use isso para calcular quanto falta para qualquer agendamento antes de oferecer lembretes ou orientações temporais. NUNCA ofereça ou sugira horários de cabeça ou baseados em "hoje". Chame OBRIGATORIAMENTE a ferramenta 'listar_horarios_disponiveis' e ofereça APENAS os slots que ela retornar, pois eles respeitam a disponibilidade real da agenda no momento.`;
}

export interface BuildSystemPromptOptions {
  cfg: AiCfgLike;
  knowledgeTexts?: string[];
  styleBlock?: string;
  hoursContext?: string;
  nameContext?: string;
  behaviorContext?: string;
  extraContext?: string;
  timezone?: string;
  fallbackPersona?: string;
  /** Modelo padrão de regras vindo de ai_rule_templates (fallback). */
  defaultRules?: string | null;
}

const GOAL_LABEL: Record<string, string> = {
  appointment: "agendar uma consulta",
  qualification: "qualificar o lead",
  support: "dar suporte",
};

/**
 * Monta o system prompt IDÊNTICO usado pelo simulador e pelo webhook.
 *
 * Estrutura por DONO da informação (sem repetir a mesma regra em dois lugares):
 *   1. Persona (editável)
 *   2. Regras (núcleo + ajustes do tenant)
 *   3. Estado dinâmico (agora, horário, nome, comportamento) — contexto puro
 *   4. Conhecimento (FAQ, documentos)
 *   5. Objetivo / link / qualificação / restrições
 * NÃO existe bloco "REGRAS MESTRAS" — se ele voltar, o prompt está contraditório.
 */
export function buildAiSystemPrompt(opts: BuildSystemPromptOptions): string {
  const {
    cfg, knowledgeTexts = [], styleBlock = "",
    hoursContext = "", nameContext = "", behaviorContext = "", extraContext = "",
    timezone = "America/Sao_Paulo",
    fallbackPersona = "Você é a Ana, especialista ocular da Ótica Catelan.",
  } = opts;

  const parts: string[] = [];

  // 1) Persona (editável)
  parts.push(cfg.prompt_system?.trim() || fallbackPersona);

  // 2) Regras: núcleo imutável + ajustes do tenant
  parts.push(resolveBehaviorRules(cfg, opts.defaultRules));

  // 3) Estado dinâmico (contexto puro, sem instruções duplicadas)
  parts.push(buildNowContext(timezone));
  if (hoursContext.trim()) parts.push(hoursContext.trim());
  if (nameContext.trim()) parts.push(nameContext.trim());
  if (behaviorContext.trim()) parts.push(behaviorContext.trim());
  if (styleBlock.trim()) parts.push(styleBlock.trim());

  // 4) Objetivo + link
  if (cfg.goal) parts.push(`Objetivo principal da conversa: ${GOAL_LABEL[cfg.goal] ?? cfg.goal}.`);
  if (cfg.scheduling_link) parts.push(`Link de agendamento (use quando o lead pedir): ${cfg.scheduling_link}`);

  // 5) Base de conhecimento
  if (cfg.knowledge_base_faq?.trim()) parts.push(`BASE DE CONHECIMENTO (FAQ):\n${cfg.knowledge_base_faq.trim()}`);
  if (knowledgeTexts.length) {
    parts.push(`DOCUMENTOS DE REFERÊNCIA:\n${knowledgeTexts.join("\n---\n").slice(0, 6000)}`);
  }

  // 6) Qualificação
  if (Array.isArray(cfg.qualification_questions) && cfg.qualification_questions.length) {
    parts.push(
      `PERGUNTAS DE QUALIFICAÇÃO (faça uma por vez, na ordem):\n${cfg.qualification_questions
        .map((q, i) => `${i + 1}. ${q}`)
        .join("\n")}`,
    );
  }

  // 7) Rejeição / restrições
  if (cfg.rejection_instructions?.trim()) parts.push(`O QUE NÃO FAZER:\n${cfg.rejection_instructions.trim()}`);
  if (Array.isArray(cfg.response_restrictions) && cfg.response_restrictions.length) {
    parts.push(`Restrições: ${cfg.response_restrictions.join(", ")}`);
  }

  // 8) Contexto extra livre (ex: instruções de tools em dry-run no simulador)
  if (extraContext.trim()) parts.push(extraContext.trim());

  return parts.join("\n\n");
}

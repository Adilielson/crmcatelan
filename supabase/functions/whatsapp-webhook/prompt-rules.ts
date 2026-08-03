// ─────────────────────────────────────────────────────────────────────────────
// Validadores de runtime do comportamento da IA SDR.
//
// IMPORTANTE (multitenant): NÃO existe texto de prompt neste arquivo.
// As regras de atendimento vivem 100% no banco, por tenant:
//   • ai_configs.behavior_rules      → regras vigentes da loja (editáveis no front)
//   • ai_rule_templates.content      → modelo padrão usado pelo botão "Restaurar padrão"
//
// Aqui ficam apenas checagens objetivas aplicadas antes de enviar a resposta.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Regras finais enviadas ao modelo.
 * `rules` vem do banco (ai_configs.behavior_rules). `fallback` é o modelo
 * padrão lido de ai_rule_templates quando o tenant ainda não configurou nada.
 * Não há concatenação de regras de fábrica: fonte única, sem contradição.
 */
export function composeBehaviorRules(rules?: string | null, fallback?: string | null): string {
  const primary = (rules ?? "").trim();
  if (primary) return primary;
  return (fallback ?? "").trim();
}

export const FORBIDDEN_DOCUMENT_TERMS = [
  /\bCPF\b/i,
  /\bRG\b/i,
  /\bR\.?G\.?\b/i,
  /comprovante\s+de\s+resid[êe]ncia/i,
  /carteirinha/i,
  /conv[êe]nio/i,
  /plano\s+de\s+sa[úu]de/i,
  /n[úu]mero\s+do\s+cart[ãa]o/i,
  /documento\s+de\s+identidade/i,
];

/** Termos que nunca podem chegar ao cliente. */
export const FORBIDDEN_CLINICAL_TERMS = [/optometrista/i, /oftalmologia/i];

export interface ScriptCheck {
  ok: boolean;
  reasons: string[];
}

/**
 * Verifica se uma resposta da IA quebra alguma regra proibida.
 * Retorna ok=false quando encontra pedido de documento.
 */
export function checkNoDocumentRequest(reply: string): ScriptCheck {
  const reasons: string[] = [];
  for (const rx of FORBIDDEN_DOCUMENT_TERMS) {
    if (rx.test(reply)) reasons.push(`Menciona termo proibido: ${rx}`);
  }
  return { ok: reasons.length === 0, reasons };
}

/**
 * Verifica se a primeira mensagem da Ana segue o padrão Raiana:
 * função explícita ("especialista ocular" / "da Ótica Catelan") + saudação/rapport.
 */
export function checkOpeningScript(reply: string): ScriptCheck {
  const reasons: string[] = [];
  const hasFunction = /especialista\s+ocular|da\s+[óo]tica\s+catelan/i.test(reply);
  if (!hasFunction) reasons.push("Não apresenta função ('especialista ocular' / 'da Ótica Catelan').");

  const hasGreeting = /\b(bom dia|boa tarde|boa noite|oi|ol[áa])\b/i.test(reply);
  if (!hasGreeting) reasons.push("Sem cumprimento contextualizado.");

  return { ok: reasons.length === 0, reasons };
}

/**
 * Verifica se uma oferta de horário traz CTA concreto (horário + convite de fechamento),
 * em vez de devolver a bola pro cliente com 'qual o melhor dia?'.
 */
export function checkConcreteCTA(reply: string): ScriptCheck {
  const reasons: string[] = [];
  const hasTime = /\b(\d{1,2})[:h](\d{2})?\b/i.test(reply);
  if (!hasTime) reasons.push("Não oferece horário concreto (ex: '15h', '14:10').");

  const openEnded = /qual\s+o\s+melhor\s+dia|qual\s+dia\s+fica\s+melhor|que\s+dia\s+voc[êe]\s+prefere/i.test(reply);
  if (openEnded && !hasTime) reasons.push("Devolve a bola sem propor horário concreto.");

  const hasClose = /fecha\s+pra\s+voc[êe]|posso\s+reservar|quer\s+que\s+eu\s+(j[áa]\s+)?reserve|te\s+encaixo|te\s+encaixar/i.test(reply);
  if (!hasClose) reasons.push("Sem convite de fechamento no CTA.");

  return { ok: reasons.length === 0, reasons };
}

/**
 * Verifica se a resposta usa espelho afirmativo antes de avançar (jeito Raiana).
 */
export function checkAffirmativeMirror(reply: string): ScriptCheck {
  const reasons: string[] = [];
  const hasMirror = /\b(perfeito|boa|combinado|pode deixar|vamos te ajudar|entendo|imagino)\b/i.test(reply);
  if (!hasMirror) reasons.push("Sem espelho afirmativo (perfeito / boa / vamos te ajudar / entendo / imagino).");
  return { ok: reasons.length === 0, reasons };
}

/** Perguntas genéricas banidas pela regra 3. */
export function checkNoGenericQuestion(reply: string): ScriptCheck {
  const reasons: string[] = [];
  const banned = [
    /o\s+que\s+est[áa]\s+acontecendo\s+com\s+(a\s+)?sua\s+vis[ãa]o/i,
    /qual\s+(a\s+)?sua\s+dificuldade\s+visual/i,
    /como\s+posso\s+te\s+ajudar/i,
    /come[çc]ou\s+a\s+sentir\s+algum\s+inc[ôo]modo/i,
  ];
  for (const rx of banned) {
    if (rx.test(reply)) reasons.push(`Pergunta genérica proibida: ${rx}`);
  }
  return { ok: reasons.length === 0, reasons };
}

/** Termos clínicos proibidos com o cliente. */
export function checkNoClinicalTerms(reply: string): ScriptCheck {
  const reasons: string[] = [];
  for (const rx of FORBIDDEN_CLINICAL_TERMS) {
    if (rx.test(reply)) reasons.push(`Usa termo proibido com o cliente: ${rx}`);
  }
  return { ok: reasons.length === 0, reasons };
}

/** Máximo UMA pergunta por mensagem (regra 2/10). */
export function checkSingleQuestion(reply: string): ScriptCheck {
  const count = (reply.match(/\?/g) ?? []).length;
  return count <= 1
    ? { ok: true, reasons: [] }
    : { ok: false, reasons: [`Contém ${count} perguntas na mesma mensagem (máximo 1).`] };
}

/**
 * Guarda-corpo de RUNTIME: roda em toda resposta antes do envio.
 * Só checa regras "duras" (violação objetiva) — as heurísticas de estilo
 * (abertura, CTA, espelho) ficam para os testes de regressão, para não
 * bloquear respostas legítimas em produção.
 */
export function validateOutgoingReply(reply: string): ScriptCheck {
  const reasons: string[] = [
    ...checkNoDocumentRequest(reply).reasons,
    ...checkNoClinicalTerms(reply).reasons,
    ...checkNoGenericQuestion(reply).reasons,
    ...checkSingleQuestion(reply).reasons,
  ];
  return { ok: reasons.length === 0, reasons };
}

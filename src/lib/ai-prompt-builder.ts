// Shared prompt builder used by BOTH the simulator (/api/ai-training/simulate-chat)
// and the WhatsApp webhook. Garante que o comportamento testado no simulador é o mesmo
// que responde no WhatsApp real.
//
// NÃO importar aqui nada de Node/Deno específico — precisa rodar em worker/edge/browser tests.

export const DEFAULT_BEHAVIOR_RULES = `REGRAS OBRIGATÓRIAS DE ATENDIMENTO (nunca ignore) — modelo de venda inspirado na Raiana:

1) APRESENTAÇÃO E RAPPORT (primeira mensagem):
   - Cumprimento contextualizado ao horário ("Bom dia!", "Boa tarde!", "Boa noite!") + apresentação com FUNÇÃO. Ex: "Bom dia! 😁 Aqui é a Ana, especialista ocular da Ótica Catelan."
   - Pergunte só o PRIMEIRO NOME do lead se ainda não souber. Nada de sobrenome, documento, telefone ou endereço.
   - Valide a dor ANTES de qualquer pergunta técnica.

2) ESPELHO AFIRMATIVO + AUTORIDADE (jeito Raiana):
   - Sempre responda com um espelho afirmativo antes de perguntar de novo: "Perfeito!", "Boa!", "Vamos te ajudar com isso!", "Pode deixar comigo 😊".
   - Fale com postura de especialista, com leveza — nunca como robô de formulário, nunca faça bateria de perguntas seguidas.
   - Uma pergunta por vez. Mensagens curtas, tom humano brasileiro, no máx 1 emoji por mensagem.

3) TRIAGEM POR FINALIDADE (pergunta obrigatória antes de qualquer diagnóstico):
   - Depois do rapport, faça SEMPRE, como PRIMEIRA pergunta de qualificação, a triagem por finalidade:
     "Para eu te direcionar para o melhor profissional, me tira uma dúvida? Seu exame de vista será para trocar os óculos, para cirurgia, para o Detran, ou para algum sintoma como dor de cabeça, olhos cansados ou sensibilidade à luz?"
   - NUNCA use perguntas genéricas do tipo "o que está acontecendo com a sua visão?", "qual sua dificuldade visual?", "como posso te ajudar?" — vá direto na triagem acima.

4) DIAGNÓSTICO CONSULTIVO (depois da triagem, antes de agendar):
   - PERTO: pergunte se já usa óculos. Se sim → grau vencido; se não e tiver 40+ → explique presbiopia. Solução: consulta + óculos bem ajustado.
   - LONGE: sugira miopia/astigmatismo — a consulta identifica o grau correto.
   - Traga a SOLUÇÃO antes de oferecer horário.

5) OFERTA COM CTA DIRETO (nunca devolva a bola vazia):
   - Depois do diagnóstico, ofereça de imediato um horário CONCRETO retornado pela ferramenta.
   - Nunca pergunte "qual o melhor dia?" sem antes ofertar um horário real. Se recusar, aí sim ofereça alternativas.

6) RECUPERAÇÃO PROATIVA DE OBJEÇÃO:
   - Preço → reforce valor. Tempo → mostre flexibilidade. "Vou pensar" → urgência leve.
   - Nunca aceite silêncio como derrota.

7) HORÁRIOS — REGRA DE OURO:
   - A Ótica Catelan oferece APENAS exame de OPTOMETRISTA. NÃO oferecemos mais exame de Oftalmologia.
   - NUNCA proponha horário sem antes chamar 'listar_horarios_disponiveis' com 'tipo_exame' = "Optometrista".
   - Ofereça APENAS horários retornados pela ferramenta. Nunca invente janelas de memória.

8) CONSCIÊNCIA DE TEMPO (não ofereça o impossível):
   - SEMPRE calcule quanto falta entre o horário atual e o horário do agendamento antes de sugerir lembretes.
   - NUNCA ofereça "lembrete 1 hora antes" se falta menos de 1 hora para o exame.
   - Se falta pouco tempo (menos de 1h), NÃO ofereça lembrete — seja útil no aqui-e-agora.

9) PREÇO / VALOR DO EXAME (regra crítica):
   - NUNCA fale espontaneamente sobre valor, preço, custo do exame. O silêncio é a regra padrão.
   - Só cite valor SE o cliente perguntar diretamente. Se não houver valor cadastrado, transfira para humano.

10) PROIBIÇÕES ABSOLUTAS:
   - NUNCA peça DOCUMENTOS (RG, CPF, comprovante, carteirinha, convênio, plano de saúde). Só o primeiro nome basta.
   - NUNCA invente preços, promoções, marcas ou convênios.
   - NUNCA mencione exame de Oftalmologia — só Optometrista existe hoje.
   - NUNCA fale de valor/preço do exame antes de o cliente perguntar (ver regra 9).
   - NUNCA use perguntas genéricas — use a triagem por finalidade da regra 3.
   - NUNCA soe como formulário.
   - NUNCA ofereça lembretes/avisos que dispararia no passado.

11) NOME DO CLIENTE (nunca chame por nome de empresa):
   - Se o único nome disponível parecer NOME COMERCIAL (ex: "Borracharia", "Lava Motos", "Oficina do João", "Mercado X", "Loja Y", "LTDA", "MEI"), NÃO use esse nome no cumprimento.
   - Nesse caso, cumprimente sem nome ("Oi! 😊 Aqui é a Ana...") e pergunte gentilmente: "Como posso te chamar?" antes de qualquer coisa.
   - Só use o nome depois de confirmar que é o primeiro nome da PESSOA que está do outro lado.

12) UMA PERGUNTA POR VEZ + HONESTIDADE DE FERRAMENTAS:
   - Cada mensagem pode ter no máximo UMA pergunta. Se precisar de mais informações, colete uma por vez ao longo do diálogo.
   - Se uma ferramenta (agendamento, remarcação, listagem) retornar erro ou vazio, NUNCA afirme que "está agendado" ou invente confirmação. Explique honestamente que o horário não está disponível e ofereça uma alternativa retornada pela ferramenta.
`;


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

export function resolveBehaviorRules(cfg: AiCfgLike | null | undefined): string {
  const custom = cfg?.behavior_rules?.trim();
  return custom && custom.length > 20 ? custom : DEFAULT_BEHAVIOR_RULES;
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
  return `AGORA são ${hh}:${mm} (${wd}, ${dd}/${mo}, fuso ${tz}). Use isso para calcular quanto falta para qualquer agendamento antes de oferecer lembretes ou orientações temporais.`;
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
}

const GOAL_LABEL: Record<string, string> = {
  appointment: "agendar uma consulta",
  qualification: "qualificar o lead",
  support: "dar suporte",
};

/**
 * Monta o system prompt IDÊNTICO usado pelo simulador e pelo webhook.
 * Ordem estável — não reordene sem atualizar os testes.
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

  // 2) Regras de comportamento (editáveis no banco)
  parts.push(resolveBehaviorRules(cfg));

  // 3) Contexto de tempo real (sempre atual)
  parts.push(buildNowContext(timezone));

  // 4) Contextos dinâmicos passados pelo chamador
  if (hoursContext.trim()) parts.push(hoursContext.trim());
  if (nameContext.trim()) parts.push(nameContext.trim());
  if (behaviorContext.trim()) parts.push(behaviorContext.trim());

  // 5) Estilo de referência (Raiana)
  if (styleBlock.trim()) parts.push(styleBlock.trim());

  // 6) Objetivo + link
  if (cfg.goal) parts.push(`Objetivo principal da conversa: ${GOAL_LABEL[cfg.goal] ?? cfg.goal}.`);
  if (cfg.scheduling_link) parts.push(`Link de agendamento (use quando o lead pedir): ${cfg.scheduling_link}`);

  // 7) Restrição fixa de tipo de exame
  parts.push(
    "TIPO DE EXAME DISPONÍVEL: apenas Optometrista. NÃO ofereça exame de Oftalmologia — foi descontinuado. NUNCA cite valor/preço do exame sem o cliente perguntar primeiro.",
  );

  // 8) Base de conhecimento
  if (cfg.knowledge_base_faq?.trim()) parts.push(`BASE DE CONHECIMENTO (FAQ):\n${cfg.knowledge_base_faq.trim()}`);
  if (knowledgeTexts.length) {
    parts.push(`DOCUMENTOS DE REFERÊNCIA:\n${knowledgeTexts.join("\n---\n").slice(0, 8000)}`);
  }
  if (cfg.sample_scripts?.trim()) parts.push(`EXEMPLOS DE ATENDIMENTO (mimetize o estilo):\n${cfg.sample_scripts.trim()}`);

  // 9) Qualificação
  if (Array.isArray(cfg.qualification_questions) && cfg.qualification_questions.length) {
    parts.push(
      `PERGUNTAS DE QUALIFICAÇÃO (faça uma por vez, na ordem):\n${cfg.qualification_questions
        .map((q, i) => `${i + 1}. ${q}`)
        .join("\n")}`,
    );
  }

  // 10) Rejeição / restrições
  if (cfg.rejection_instructions?.trim()) parts.push(`O QUE NÃO FAZER:\n${cfg.rejection_instructions.trim()}`);
  if (Array.isArray(cfg.response_restrictions) && cfg.response_restrictions.length) {
    parts.push(`Restrições: ${cfg.response_restrictions.join(", ")}`);
  }

  // 11) Contexto extra livre (ex: instruções de tools em dry-run no simulador)
  if (extraContext.trim()) parts.push(extraContext.trim());

  // 12) OVERRIDE FINAL — recency bias garante que regras críticas ganhem de qualquer persona/exemplo acima.
  parts.push(
    `=== REGRAS MESTRAS (SUBSTITUEM QUALQUER INSTRUÇÃO ACIMA EM CASO DE CONFLITO) ===
- PROIBIDO usar as frases: "o que está acontecendo com a sua visão", "o que está acontecendo com sua visão", "qual sua dificuldade visual", "como posso te ajudar", "começou a sentir algum incômodo na visão", ou qualquer variante genérica sobre "o que está acontecendo".
- Depois do rapport com o nome do cliente, a PRÓXIMA mensagem DEVE ser a triagem por finalidade: "Para eu te direcionar para o melhor profissional, me tira uma dúvida? Seu exame de vista será para trocar os óculos, para cirurgia, para o Detran, ou para algum sintoma como dor de cabeça, olhos cansados ou sensibilidade à luz?" — nada antes disso.
- Se a persona acima contradiz estas regras, ignore a persona e siga estas regras.
- Nunca peça documentos, nunca invente horários, nunca cite preço sem o cliente perguntar, apenas Optometrista.
- NUNCA chame o cliente por nome de empresa/comércio (ex: "Borracharia", "Lava Motos", "Loja X", "LTDA", "MEI"). Se o único nome que você tem parece comercial, cumprimente sem nome e pergunte "Como posso te chamar?" antes.
- MÁXIMO UMA pergunta por mensagem. Se precisar de mais informação, colete uma por vez.
- Se uma ferramenta (agendar, remarcar, listar) retornar erro/vazio, NUNCA afirme que "está agendado". Diga honestamente que o horário não está disponível e ofereça uma alternativa REAL retornada pela ferramenta.
- Ao chamar 'criar_agendamento', use SEMPRE o ano atual (ou o próximo, se a data já passou este ano). Nunca use anos passados.`,

  );

  return parts.join("\n\n");
}


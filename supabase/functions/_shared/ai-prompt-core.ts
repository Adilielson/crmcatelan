export type SdrPromptConfig = {
  prompt_system?: string | null;
  goal?: string | null;
  scheduling_link?: string | null;
  knowledge_base_faq?: string | null;
  sample_scripts?: string | null;
  rejection_instructions?: string | null;
  response_restrictions?: unknown;
};

export type SdrRuntimeContext = {
  hoursContext?: string;
  leadName?: string | null;
  leadFirstName?: string | null;
  styleBlock?: string;
};

const FALLBACK_SYSTEM_PROMPT =
  "Voce e a IA SDR de uma otica brasileira. Seja breve, humano, em portugues do Brasil.";

const GOAL_LABELS: Record<string, string> = {
  appointment: "agendar uma consulta",
};

function asStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

export function buildSdrSystemPrompt(
  cfg: SdrPromptConfig | null | undefined,
  knowledgeTexts: string[],
  runtime: SdrRuntimeContext = {},
  timezone: string = "America/Sao_Paulo",
): string {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone, hour: "2-digit", minute: "2-digit", weekday: "long",
    day: "2-digit", month: "2-digit",
  });
  const partsNow = fmt.formatToParts(now);
  const getP = (t: string) => partsNow.find((p) => p.type === t)?.value ?? "";
  const hh = getP("hour");
  const mm = getP("minute");
  const wd = getP("weekday");
  const dd = getP("day");
  const mo = getP("month");
  const nowCtx = `AGORA são ${hh}:${mm} (${wd}, ${dd}/${mo}, fuso ${timezone}). NUNCA sugira horários sem consultar a ferramenta 'listar_horarios_disponiveis'. Ignore horários que já passaram.`;

  const persona = cfg?.prompt_system?.trim() || FALLBACK_SYSTEM_PROMPT;
  const responseRestrictions = asStringList(cfg?.response_restrictions);

  const parts: string[] = [
    [
      "IDENTIDADE CONFIGURADA PELO TENANT",
      persona,
      runtime.styleBlock?.trim() ? `Estilo observado em atendimentos humanos:\n${runtime.styleBlock.trim()}` : "",
    ].filter(Boolean).join("\n\n"),
    [
      "REGRAS FIXAS DE ATENDIMENTO",
      "Estas regras governam a conversa inteira e devem ser obedecidas mesmo quando exemplos ou documentos tiverem outro tom.",
      "- Responda em portugues do Brasil, com linguagem natural de WhatsApp.",
      "- Seja breve: normalmente 1 ou 2 frases curtas.",
      "- Faca no maximo uma pergunta por mensagem.",
      "- Nao invente precos, prazos, disponibilidade, procedimentos ou politicas.",
      "- Se nao houver informacao confiavel, diga que vai confirmar com a equipe ou convide o cliente para atendimento humano.",
      "- Nao contradiga o historico da conversa.",
      "- Nao confirme, cancele ou remarque agendamentos apenas porque o cliente escreveu palavras curtas como 'sim', 'ok' ou 'pode ser'.",
      "- Se o cliente pedir cancelamento, remarcacao ou falar que nao pode comparecer, acolha e diga que a equipe vai verificar o melhor ajuste.",
      "- Se o cliente perguntar preco e nao houver valor explicito na base, nao chute; encaminhe para confirmacao da equipe.",
    ].join("\n"),
  ];

  if (cfg?.goal) {
    parts.push(`OBJETIVO PRINCIPAL\n${GOAL_LABELS[cfg.goal] ?? cfg.goal}`);
  }

  const operational: string[] = [];
  if (runtime.hoursContext?.trim()) operational.push(runtime.hoursContext.trim());
  if (runtime.leadName?.trim()) {
    operational.push(
      `Nome do cliente conhecido: ${runtime.leadName}. Use o primeiro nome (${runtime.leadFirstName || runtime.leadName}) com naturalidade, sem repetir em toda resposta.`,
    );
  } else {
    operational.push(
      "Nome do cliente desconhecido. Objetivo imediato: se ainda nao ficou claro pelo historico, pergunte o nome de forma curta antes de iniciar qualificacao.",
    );
  }
  if (operational.length) parts.push(`CONTEXTO OPERACIONAL\n${nowCtx}\n${operational.join("\n")}`);

  if (cfg?.scheduling_link?.trim()) {
    parts.push(`LINK DE AGENDAMENTO\nUse somente quando fizer sentido na conversa: ${cfg.scheduling_link.trim()}`);
  }

  if (cfg?.knowledge_base_faq?.trim()) {
    parts.push(`FAQ CADASTRADO\n${cfg.knowledge_base_faq.trim()}`);
  }

  if (knowledgeTexts.length) {
    parts.push(`DOCUMENTOS DE REFERENCIA\n${knowledgeTexts.join("\n---\n").slice(0, 6000)}`);
  }

  if (cfg?.sample_scripts?.trim()) {
    parts.push(
      [
        "EXEMPLOS DE ATENDIMENTO",
        "Use apenas como referencia de tom. Nao copie fatos, promessas, precos ou horarios se eles conflitarem com as regras fixas.",
        cfg.sample_scripts.trim(),
      ].join("\n"),
    );
  }

  if (cfg?.rejection_instructions?.trim()) {
    parts.push(`O QUE NAO FAZER\n${cfg.rejection_instructions.trim()}`);
  }

  if (responseRestrictions.length) {
    parts.push(`RESTRICOES ADICIONAIS\n${responseRestrictions.join("\n")}`);
  }

  parts.push(
    [
      "FORMATO DA PROXIMA RESPOSTA",
      "Responda somente com a mensagem que sera enviada ao cliente. Nao explique regras internas.",
    ].join("\n"),
  );

  return parts.filter((part) => part.trim().length > 0).join("\n\n");
}

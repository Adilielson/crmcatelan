import { describe, it, expect } from "vitest";
import {
  CORE_BEHAVIOR_RULES,
  FORBIDDEN_DOCUMENT_TERMS,
  checkNoDocumentRequest,
  checkOpeningScript,
  checkConcreteCTA,
  checkAffirmativeMirror,
} from "../supabase/functions/whatsapp-webhook/prompt-rules";

// ─────────────────────────────────────────────────────────────
// 1) O prompt sistema precisa cobrir explicitamente as regras chave.
// Se alguém remover uma dessas linhas, o teste falha.
// ─────────────────────────────────────────────────────────────
describe("CORE_BEHAVIOR_RULES (contrato do prompt)", () => {
  it("proíbe explicitamente pedir documentos", () => {
    expect(CORE_BEHAVIOR_RULES).toMatch(/NUNCA peça DOCUMENTOS/i);
    expect(CORE_BEHAVIOR_RULES).toMatch(/CPF/);
    expect(CORE_BEHAVIOR_RULES).toMatch(/RG/);
    expect(CORE_BEHAVIOR_RULES).toMatch(/conv[êe]nio/i);
    expect(CORE_BEHAVIOR_RULES).toMatch(/plano de sa[úu]de/i);
    expect(CORE_BEHAVIOR_RULES).toMatch(/Só o primeiro nome basta/i);
  });

  it("exige apresentação com FUNÇÃO (jeito Raiana)", () => {
    expect(CORE_BEHAVIOR_RULES).toMatch(/apresentação com FUNÇÃO/i);
    expect(CORE_BEHAVIOR_RULES).toMatch(/especialista ocular/i);
  });

  it("exige espelho afirmativo antes de avançar", () => {
    expect(CORE_BEHAVIOR_RULES).toMatch(/ESPELHO AFIRMATIVO/i);
    expect(CORE_BEHAVIOR_RULES).toMatch(/Perfeito|Boa|Vamos te ajudar/);
  });

  it("exige CTA com horário concreto", () => {
    expect(CORE_BEHAVIOR_RULES).toMatch(/CTA DIRETO/i);
    expect(CORE_BEHAVIOR_RULES).toMatch(/horário CONCRETO/i);
    expect(CORE_BEHAVIOR_RULES).toMatch(/fecha pra você/i);
  });

  it("obriga chamar listar_horarios_disponiveis antes de propor horário", () => {
    expect(CORE_BEHAVIOR_RULES).toMatch(/listar_horarios_disponiveis/);
    expect(CORE_BEHAVIOR_RULES).toMatch(/Nunca invente janelas/i);
  });

  it("cobre recuperação de objeção (preço, tempo, 'vou pensar')", () => {
    expect(CORE_BEHAVIOR_RULES).toMatch(/Preço/i);
    expect(CORE_BEHAVIOR_RULES).toMatch(/Tempo/i);
    expect(CORE_BEHAVIOR_RULES).toMatch(/Vou pensar/i);
  });
});

// ─────────────────────────────────────────────────────────────
// 2) Validadores de saída — usados em runtime e em regressão.
// ─────────────────────────────────────────────────────────────
describe("checkNoDocumentRequest", () => {
  const goodReplies = [
    "Boa tarde! Aqui é a Ana, especialista ocular da Ótica Catelan. Como posso te chamar?",
    "Perfeito, João! Consigo te encaixar hoje às 15h com nosso especialista, fecha pra você?",
    "Boa! Vamos te ajudar com isso. Você já usa óculos?",
  ];
  it.each(goodReplies)("aceita resposta limpa: %s", (r) => {
    expect(checkNoDocumentRequest(r).ok).toBe(true);
  });

  const badReplies = [
    ["pede CPF", "Certo! Pra confirmar o agendamento vou precisar do seu CPF."],
    ["pede RG", "Ótimo. Me envia uma foto do seu RG por favor."],
    ["pede convênio", "Qual é o seu convênio médico?"],
    ["pede plano de saúde", "Você tem plano de saúde ativo?"],
    ["pede comprovante", "Envie o comprovante de residência para eu cadastrar."],
    ["pede carteirinha", "Me manda a carteirinha do plano por favor."],
  ];
  it.each(badReplies)("rejeita quando %s", (_label, r) => {
    const result = checkNoDocumentRequest(r);
    expect(result.ok).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("cobre todos os termos proibidos com pelo menos 1 regex", () => {
    expect(FORBIDDEN_DOCUMENT_TERMS.length).toBeGreaterThanOrEqual(6);
  });
});

describe("checkOpeningScript", () => {
  it("aceita abertura no padrão Raiana", () => {
    const reply =
      "Bom dia! 😁 Aqui é a Ana, especialista ocular da Ótica Catelan. Como posso te chamar?";
    expect(checkOpeningScript(reply).ok).toBe(true);
  });

  it("rejeita quando falta função", () => {
    const reply = "Oi! Aqui é a Ana. Em que posso ajudar?";
    const r = checkOpeningScript(reply);
    expect(r.ok).toBe(false);
    expect(r.reasons.join(" ")).toMatch(/função/i);
  });

  it("rejeita quando falta cumprimento", () => {
    const reply = "Aqui é a Ana, especialista ocular da Ótica Catelan.";
    const r = checkOpeningScript(reply);
    expect(r.ok).toBe(false);
    expect(r.reasons.join(" ")).toMatch(/cumprimento/i);
  });
});

describe("checkConcreteCTA", () => {
  it("aceita CTA com horário concreto e fechamento", () => {
    const reply =
      "Perfeito! Consigo te encaixar hoje às 15h com nosso especialista, fecha pra você?";
    expect(checkConcreteCTA(reply).ok).toBe(true);
  });

  it("aceita horário quebrado (14:10) com convite de reserva", () => {
    const reply = "Boa! Posso reservar amanhã às 14:10 pra você?";
    expect(checkConcreteCTA(reply).ok).toBe(true);
  });

  it("rejeita quando devolve a bola sem propor horário", () => {
    const reply = "Legal! Qual o melhor dia pra você fazer o exame?";
    const r = checkConcreteCTA(reply);
    expect(r.ok).toBe(false);
    expect(r.reasons.join(" ")).toMatch(/horário concreto|Devolve a bola/i);
  });

  it("rejeita quando tem horário mas não convida a fechar", () => {
    const reply = "Temos horário amanhã às 15h.";
    const r = checkConcreteCTA(reply);
    expect(r.ok).toBe(false);
    expect(r.reasons.join(" ")).toMatch(/fechamento/i);
  });
});

describe("checkAffirmativeMirror", () => {
  it.each([
    "Perfeito! Vou te ajudar com isso.",
    "Boa! Já entendi o cenário.",
    "Pode deixar comigo 😊",
    "Entendo, isso é super comum e tem solução.",
    "Imagino como incomoda no dia a dia.",
  ])("aceita espelho afirmativo: %s", (reply) => {
    expect(checkAffirmativeMirror(reply).ok).toBe(true);
  });

  it("rejeita resposta seca sem validação emocional", () => {
    const reply = "Qual sua idade? Você usa óculos? Consegue vir amanhã?";
    expect(checkAffirmativeMirror(reply).ok).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// 3) Casos de regressão específicos — cenários que já falharam
// em produção não podem voltar a passar.
// ─────────────────────────────────────────────────────────────
describe("Regressão — cenários históricos", () => {
  it("não permite que a Ana peça CPF pra confirmar agendamento", () => {
    const historicalBadReply =
      "Ótimo! Para confirmar seu horário preciso do seu CPF e telefone.";
    expect(checkNoDocumentRequest(historicalBadReply).ok).toBe(false);
  });

  it("não permite abrir a conversa como robô de formulário", () => {
    const historicalBadReply =
      "Olá. Poderia informar seu nome completo, idade e se possui óculos?";
    expect(checkOpeningScript(historicalBadReply).ok).toBe(false);
    expect(checkAffirmativeMirror(historicalBadReply).ok).toBe(false);
  });

  it("não permite oferecer agenda sem horário concreto (caso Samuel Lima)", () => {
    const historicalBadReply =
      "Legal! Qual o melhor dia e período pra você marcar o exame?";
    expect(checkConcreteCTA(historicalBadReply).ok).toBe(false);
  });
});

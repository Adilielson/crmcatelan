import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getTenantAiKey, logAiUsage } from "./ai-credentials.server";

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

const TOUCH_BRIEF: Record<string, string> = {
  followup_d1: "1 dia após a consulta — agradeça a visita e abra espaço para dúvidas, tom leve e acolhedor.",
  followup_d3: "3 dias após a consulta — lembrete suave sobre a decisão, sem pressão.",
  followup_d7: "7 dias após a consulta — ofereça uma condição/desconto especial limitada para destravar a decisão.",
  followup_d15: "15 dias — script para LIGAÇÃO: tom mais pessoal e direto, retomar a conversa e entender objeção.",
  followup_d30: "30 dias — comunique novidades, novas coleções ou promoções relevantes.",
  followup_d60: "60 dias — reengajamento mais leve, pode oferecer brinde ou avaliação gratuita.",
  followup_d120: "120 dias (4 meses) — check-in cuidando da saúde visual, sugira nova avaliação.",
  followup_d180: "180 dias (6 meses) — revisão semestral, lembrar que a receita pode estar próxima do vencimento.",
};

const NEEDS_LABEL: Record<string, string> = {
  yes: "já usa óculos",
  no: "não precisa de correção",
  reading: "só para leitura",
  distance: "só para longe",
  both: "precisa de multifocal",
};

function formatPrescription(s: Record<string, any> | null | undefined): string | null {
  if (!s) return null;
  const fmt = (n: number | null | undefined) =>
    n == null ? null : `${n > 0 ? "+" : ""}${n}`;
  const eye = (label: string, sph: any, cyl: any, add: any) => {
    const bits = [fmt(sph), fmt(cyl), add != null ? `Ad ${fmt(add)}` : null].filter(Boolean);
    return bits.length ? `${label} ${bits.join(" / ")}` : null;
  };
  const od = eye("OD", s.od_spherical, s.od_cylindrical, s.od_addition);
  const oe = eye("OE", s.oe_spherical, s.oe_cylindrical, s.oe_addition);
  return [od, oe].filter(Boolean).join(" • ") || null;
}

function buildPrompt(args: {
  leadName: string;
  templateKey: string;
  channel: string;
  summary: Record<string, any> | null;
  tenantTone?: string | null;
  schedulingLink?: string | null;
}): { system: string; user: string } {
  const touch = TOUCH_BRIEF[args.templateKey] ?? "Mensagem de follow-up.";
  const summary = args.summary;
  const ctx: string[] = [];

  if (summary) {
    if (summary.needs_glasses) {
      ctx.push(`Necessidade visual: ${NEEDS_LABEL[summary.needs_glasses] ?? summary.needs_glasses}.`);
    }
    if (summary.lens_type) ctx.push(`Tipo de lente avaliado: ${summary.lens_type}.`);
    const rx = formatPrescription(summary);
    if (rx) ctx.push(`Grau: ${rx}.`);
    if (summary.prescription_valid_until) {
      ctx.push(`Receita válida até: ${summary.prescription_valid_until}.`);
    }
    if (Array.isArray(summary.treatments) && summary.treatments.length) {
      ctx.push(`Tratamentos sugeridos: ${summary.treatments.join(", ")}.`);
    }
    if (summary.frame_recommendation) ctx.push(`Sugestão de armação: ${summary.frame_recommendation}.`);
    if (summary.products_shown) ctx.push(`Produtos apresentados: ${summary.products_shown}.`);
    if (summary.price_range_presented) ctx.push(`Faixa de preço apresentada: ${summary.price_range_presented}.`);
    if (summary.no_close_reason) {
      const detail = summary.no_close_reason_detail ? ` (${summary.no_close_reason_detail})` : "";
      ctx.push(`Motivo de não ter fechado: ${summary.no_close_reason}${detail}.`);
    }
    if (summary.professional_notes) ctx.push(`Observações do profissional: ${summary.professional_notes}.`);
  } else {
    ctx.push("(Sem resumo de consulta — escreva mais genérico, mas ainda personalizado pelo nome e momento.)");
  }

  const system = [
    "Você é uma SDR brasileira da Ótica Catelan especialista em reimpacto de leads que passaram pela loja, mas não fecharam.",
    "Escreva mensagens curtas (máx 4 linhas), tom humano, próximo, sem clichês de venda, sem emojis em excesso (1 no máximo, opcional).",
    "Nunca invente informações que não estejam no contexto. Não cite valores específicos se não foram apresentados.",
    "Adapte o tom à objeção do lead quando houver — se foi preço, explore condição; se foi tempo, ofereça flexibilidade; se foi pesquisar mais, mostre diferencial.",
    args.tenantTone ? `Tom da marca: ${args.tenantTone}` : null,
    args.channel === "call"
      ? "Esta mensagem é um SCRIPT DE ABERTURA para LIGAÇÃO TELEFÔNICA — escreva como se fosse falado, não como WhatsApp."
      : "Esta mensagem será enviada por WHATSAPP — pode usar quebras de linha e ser conversacional.",
    args.schedulingLink ? `Se fizer sentido convidar para agendar, use este link: ${args.schedulingLink}` : null,
    "Retorne SOMENTE a mensagem final, sem comentários, sem aspas, sem prefixos tipo 'Mensagem:'.",
  ]
    .filter(Boolean)
    .join("\n");

  const user = [
    `Lead: ${args.leadName}`,
    `Momento do toque: ${touch}`,
    `Canal: ${args.channel === "call" ? "Ligação" : "WhatsApp"}`,
    "",
    "Contexto da consulta:",
    ...ctx.map((c) => `- ${c}`),
  ].join("\n");

  return { system, user };
}

export const generateFollowupMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const i = input as { followupId: string };
    if (!i?.followupId) throw new Error("followupId obrigatório");
    return i;
  })
  .handler(async ({ data, context }) => {
    const tenantId = await getUserTenant(context.supabase, context.userId);
    const supabase = context.supabase;

    // 1) Follow-up
    const { data: followup, error: fErr } = await supabase
      .from("lead_followups")
      .select("id, lead_id, template_key, channel, day_offset")
      .eq("id", data.followupId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (fErr) throw new Error(fErr.message);
    if (!followup) throw new Error("Follow-up não encontrado");

    // 2) Lead
    const { data: lead, error: lErr } = await supabase
      .from("leads")
      .select("id, full_name, phone")
      .eq("id", (followup as any).lead_id)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (lErr) throw new Error(lErr.message);
    if (!lead) throw new Error("Lead não encontrado");

    // 3) Resumo da consulta (último registro)
    const { data: summaryRows } = await supabase
      .from("lead_consultation_summary")
      .select("*")
      .eq("lead_id", (followup as any).lead_id)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(1);
    const summary = (summaryRows ?? [])[0] ?? null;

    // 4) Config opcional de IA (tom e link de agendamento)
    const { data: cfg } = await supabase
      .from("ai_configs")
      .select("scheduling_link, prompt_system, model_temperature")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const { system, user } = buildPrompt({
      leadName: (lead as any).full_name,
      templateKey: (followup as any).template_key,
      channel: (followup as any).channel,
      summary: summary as any,
      tenantTone: (cfg as any)?.prompt_system ?? null,
      schedulingLink: (cfg as any)?.scheduling_link ?? null,
    });

    const cred = await getTenantAiKey(tenantId, "openai");

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cred.apiKey}`,
      },
      body: JSON.stringify({
        model: cred.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: Number((cfg as any)?.model_temperature) || 0.8,
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 429) throw new Error("Limite de requisições OpenAI atingido. Tente novamente em alguns segundos.");
      if (res.status === 401) throw new Error("Chave OpenAI inválida. Verifique em Super Admin > Credenciais IA.");
      throw new Error(`OpenAI ${res.status}: ${txt.slice(0, 200)}`);
    }
    const json = await res.json();
    const reply = json?.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) throw new Error("Sem resposta do modelo");

    const usage = json?.usage ?? {};
    await logAiUsage({
      tenantId: tenantId,
      provider: "openai",
      model: cred.model,
      tokensInput: Number(usage.prompt_tokens) || 0,
      tokensOutput: Number(usage.completion_tokens) || 0,
      usedFallback: cred.source === "master",
      source: cred.source,
      feature: "followup-ai",
    });

    return {
      message: reply.trim(),
      leadId: (lead as any).id,
      leadName: (lead as any).full_name as string,
      leadPhone: ((lead as any).phone ?? null) as string | null,
      channel: (followup as any).channel as string,
      templateKey: (followup as any).template_key as string,
      hasContext: !!summary,
    };
  });

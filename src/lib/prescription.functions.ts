import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKET = "whatsapp-media";

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

async function assertLeadInTenant(supabase: any, leadId: string, tenantId: string) {
  const { data, error } = await supabase
    .from("leads")
    .select("id, tenant_id, prescription_image_path")
    .eq("id", leadId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.tenant_id !== tenantId) throw new Error("Lead não encontrado");
  return data as { id: string; tenant_id: string; prescription_image_path: string | null };
}

function parseDataUrl(dataUrl: string): { mime: string; bytes: Uint8Array } {
  const m = dataUrl.match(/^data:([\w/+.-]+);base64,(.+)$/);
  if (!m) throw new Error("Formato de imagem inválido (esperado data URL base64)");
  const mime = m[1];
  if (!mime.startsWith("image/")) throw new Error("Arquivo precisa ser uma imagem");
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  if (bytes.length > 8 * 1024 * 1024) throw new Error("Imagem muito grande (máx 8MB)");
  return { mime, bytes };
}

/** Upload da foto da receita; persiste o caminho no lead e retorna URL assinada. */
export const uploadPrescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => {
    const x = i as { leadId?: string; dataUrl?: string };
    if (!x?.leadId) throw new Error("leadId obrigatório");
    if (!x?.dataUrl) throw new Error("dataUrl obrigatório");
    return { leadId: x.leadId, dataUrl: x.dataUrl };
  })
  .handler(async ({ data, context }) => {
    const tenantId = await getUserTenant(context.supabase, context.userId);
    await assertLeadInTenant(context.supabase, data.leadId, tenantId);
    const { mime, bytes } = parseDataUrl(data.dataUrl);
    const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
    const path = `prescriptions/${tenantId}/${data.leadId}-${Date.now()}.${ext}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: mime, upsert: true });
    if (upErr) throw new Error(`Falha ao salvar imagem: ${upErr.message}`);

    const { error: updErr } = await supabaseAdmin
      .from("leads")
      .update({ prescription_image_path: path })
      .eq("id", data.leadId);
    if (updErr) throw new Error(updErr.message);

    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(path, 3600);
    if (sErr) throw new Error(sErr.message);

    return { path, signedUrl: signed.signedUrl };
  });

/** Retorna URL assinada (1h) da foto da receita do lead. */
export const getPrescriptionSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => {
    const x = i as { leadId?: string };
    if (!x?.leadId) throw new Error("leadId obrigatório");
    return { leadId: x.leadId };
  })
  .handler(async ({ data, context }) => {
    const tenantId = await getUserTenant(context.supabase, context.userId);
    const lead = await assertLeadInTenant(context.supabase, data.leadId, tenantId);
    if (!lead.prescription_image_path) return { signedUrl: null as string | null };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(lead.prescription_image_path, 3600);
    if (error) throw new Error(error.message);
    return { signedUrl: signed.signedUrl };
  });

/** Roda OCR via Lovable AI Gateway (Gemini multimodal) e preenche a ficha. */
export const runPrescriptionOcr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => {
    const x = i as { leadId?: string };
    if (!x?.leadId) throw new Error("leadId obrigatório");
    return { leadId: x.leadId };
  })
  .handler(async ({ data, context }) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY não configurada");

    const tenantId = await getUserTenant(context.supabase, context.userId);
    const lead = await assertLeadInTenant(context.supabase, data.leadId, tenantId);
    if (!lead.prescription_image_path) throw new Error("Nenhuma foto de receita salva para este lead");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(lead.prescription_image_path, 600);
    if (sErr) throw new Error(sErr.message);

    const systemPrompt =
      "Você é um especialista em ler receitas oftalmológicas brasileiras. " +
      "Extraia o GRAU dos dois olhos e a VALIDADE da receita a partir da imagem. " +
      "Responda APENAS com um JSON válido, sem markdown, no formato exato: " +
      `{"grau":"OD: ±X.XX Cil ±X.XX Eixo XXX / OE: ±X.XX Cil ±X.XX Eixo XXX","validade":"YYYY-MM-DD","confianca":"alta|media|baixa"}. ` +
      "Se um campo não puder ser lido, use null no lugar. " +
      "Para o grau, simplifique omitindo cilindro/eixo se forem 0/ausentes (ex: 'OD: -2.00 / OE: -1.75'). " +
      "A validade no Brasil costuma ser 1 ano após a data do exame se não estiver explícita — nesse caso retorne validade null.";

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia o grau e a validade desta receita." },
              { type: "image_url", image_url: { url: signed.signedUrl } },
            ],
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      if (aiRes.status === 429) throw new Error("Limite de requisições da OpenAI atingido. Tente novamente em alguns instantes.");
      if (aiRes.status === 401) throw new Error("OPENAI_API_KEY inválida.");
      throw new Error(`OpenAI ${aiRes.status}: ${txt.slice(0, 200)}`);
    }
    const json = await aiRes.json();
    const raw: string | undefined = json?.choices?.[0]?.message?.content;
    if (!raw) throw new Error("Resposta vazia da IA");

    const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    let parsed: { grau?: string | null; validade?: string | null; confianca?: string };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("Não consegui interpretar a resposta da IA");
      parsed = JSON.parse(m[0]);
    }

    const grau = typeof parsed.grau === "string" && parsed.grau.trim() ? parsed.grau.trim() : null;
    let validade: string | null = null;
    if (typeof parsed.validade === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.validade)) {
      validade = parsed.validade;
    }

    if (!grau && !validade) throw new Error("Não foi possível ler nenhum dado da receita. Tente outra foto.");

    // Buscar tags atuais para mesclar
    const { data: cur } = await supabaseAdmin
      .from("leads")
      .select("ia_tags")
      .eq("id", data.leadId)
      .maybeSingle();
    const existingTags: string[] = Array.isArray((cur as any)?.ia_tags) ? (cur as any).ia_tags : [];
    const newTags = existingTags.includes("Receita Digitalizada")
      ? existingTags
      : [...existingTags, "Receita Digitalizada"];

    const { error: updErr } = await supabaseAdmin
      .from("leads")
      .update({
        prescription_ocr_at: new Date().toISOString(),
        ia_tags: newTags,
        ...(grau ? { ia_receita_grau: grau } : {}),
        ...(validade ? { ia_receita_validade: validade } : {}),
      })
      .eq("id", data.leadId);
    if (updErr) throw new Error(updErr.message);

    return {
      grau,
      validade,
      confianca: parsed.confianca ?? null,
    };
  });

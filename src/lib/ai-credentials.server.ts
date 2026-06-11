// Helpers de credenciais IA por tenant.
// Resolve a chave da OpenAI por tenant com fallback para OPENAI_API_KEY (master),
// checa orçamento mensal e registra custo em ia_token_logs.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Preço por 1k tokens (USD). gpt-4o-mini.
const PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "gpt-4o": { input: 0.0025, output: 0.01 },
  "gpt-4.1-mini": { input: 0.0004, output: 0.0016 },
};

export type ResolvedAiKey = {
  apiKey: string;
  model: string;
  source: "tenant" | "master";
  credentialId: string | null;
  monthlyBudgetUsd: number | null;
  currentMonthCostUsd: number;
};

export async function getTenantAiKey(
  tenantId: string,
  provider: "openai" = "openai",
): Promise<ResolvedAiKey> {
  // 1) Tenta credencial do tenant
  const { data, error } = await supabaseAdmin.rpc("get_active_ai_credential", {
    _tenant_id: tenantId,
    _provider: provider,
  });
  if (error) {
    console.warn("[ai-credentials] RPC erro, caindo p/ master:", error.message);
  }
  const row = Array.isArray(data) ? data[0] : null;

  if (row?.api_key) {
    const budget = Number(row.monthly_budget_usd) || 0;
    const used = Number(row.current_month_cost_usd) || 0;
    if (budget > 0 && used >= budget) {
      // estourou orçamento -> usa master como fallback
      const master = process.env.OPENAI_API_KEY;
      if (!master) {
        throw new Error(
          `Orçamento mensal do tenant excedido (US$ ${used.toFixed(2)} / US$ ${budget.toFixed(2)}) e nenhuma chave master disponível.`,
        );
      }
      return {
        apiKey: master,
        model: row.model_default || "gpt-4o-mini",
        source: "master",
        credentialId: row.credential_id,
        monthlyBudgetUsd: budget,
        currentMonthCostUsd: used,
      };
    }
    return {
      apiKey: row.api_key,
      model: row.model_default || "gpt-4o-mini",
      source: "tenant",
      credentialId: row.credential_id,
      monthlyBudgetUsd: budget,
      currentMonthCostUsd: used,
    };
  }

  // 2) Fallback master
  const master = process.env.OPENAI_API_KEY;
  if (!master) throw new Error("Nenhuma chave OpenAI configurada (tenant nem master).");
  return {
    apiKey: master,
    model: "gpt-4o-mini",
    source: "master",
    credentialId: null,
    monthlyBudgetUsd: null,
    currentMonthCostUsd: 0,
  };
}

export function estimateCostUsd(
  model: string,
  tokensInput: number,
  tokensOutput: number,
): number {
  const p = PRICING[model] ?? PRICING["gpt-4o-mini"];
  return (tokensInput / 1000) * p.input + (tokensOutput / 1000) * p.output;
}

export async function logAiUsage(args: {
  tenantId: string;
  provider: "openai";
  model: string;
  tokensInput: number;
  tokensOutput: number;
  usedFallback: boolean;
  source: "tenant" | "master";
  feature?: string;
}) {
  const cost = estimateCostUsd(args.model, args.tokensInput, args.tokensOutput);
  try {
    await supabaseAdmin.from("ia_token_logs").insert({
      tenant_id: args.tenantId,
      provider: args.provider,
      model: args.model,
      tokens_input: args.tokensInput,
      tokens_output: args.tokensOutput,
      cost_usd: cost,
      used_fallback: args.usedFallback || args.source === "master",
      feature: args.feature ?? "followup-ai",
    } as any);
  } catch (e: any) {
    console.warn("[ai-credentials] log falhou:", e?.message);
  }
  return cost;
}

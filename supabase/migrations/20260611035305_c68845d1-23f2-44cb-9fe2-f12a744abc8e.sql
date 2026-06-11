
-- Enable Vault extension for encryption
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- Provider enum
DO $$ BEGIN
  CREATE TYPE public.ai_provider AS ENUM ('openai', 'anthropic', 'gemini', 'lovable');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================
-- Table: tenant_ai_credentials
-- ============================================
CREATE TABLE public.tenant_ai_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider public.ai_provider NOT NULL DEFAULT 'openai',
  vault_secret_id UUID NOT NULL,
  key_hint TEXT NOT NULL,
  model_default TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  monthly_budget_usd NUMERIC(10,2) NOT NULL DEFAULT 10.00,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE (tenant_id, provider)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_ai_credentials TO authenticated;
GRANT ALL ON public.tenant_ai_credentials TO service_role;

ALTER TABLE public.tenant_ai_credentials ENABLE ROW LEVEL SECURITY;

-- Only super_admin can manage (and never expose vault_secret_id via API in practice — UI shows only key_hint)
CREATE POLICY "Super admin can view ai credentials"
  ON public.tenant_ai_credentials FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "Super admin can insert ai credentials"
  ON public.tenant_ai_credentials FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admin can update ai credentials"
  ON public.tenant_ai_credentials FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admin can delete ai credentials"
  ON public.tenant_ai_credentials FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

CREATE TRIGGER trg_tenant_ai_credentials_updated_at
  BEFORE UPDATE ON public.tenant_ai_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- ia_token_logs: add provider, model, cost, fallback
-- ============================================
ALTER TABLE public.ia_token_logs
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS used_fallback BOOLEAN NOT NULL DEFAULT false;

-- ============================================
-- View: monthly usage per tenant
-- ============================================
CREATE OR REPLACE VIEW public.tenant_ai_usage_month AS
SELECT
  tenant_id,
  DATE_TRUNC('month', created_at)::date AS reference_month,
  COALESCE(provider, 'unknown') AS provider,
  SUM(COALESCE(tokens_input, 0) + COALESCE(tokens_output, 0)) AS total_tokens,
  SUM(cost_usd) AS total_cost_usd,
  COUNT(*) AS total_calls,
  SUM(CASE WHEN used_fallback THEN 1 ELSE 0 END) AS fallback_calls
FROM public.ia_token_logs
GROUP BY tenant_id, DATE_TRUNC('month', created_at), provider;

GRANT SELECT ON public.tenant_ai_usage_month TO authenticated;
GRANT ALL ON public.tenant_ai_usage_month TO service_role;

-- ============================================
-- Function: decrypt and return active credential (service_role only)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_active_ai_credential(
  _tenant_id UUID,
  _provider public.ai_provider DEFAULT 'openai'
)
RETURNS TABLE (
  credential_id UUID,
  api_key TEXT,
  model_default TEXT,
  monthly_budget_usd NUMERIC,
  current_month_cost_usd NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_cred RECORD;
  v_key TEXT;
  v_cost NUMERIC;
BEGIN
  SELECT c.id, c.vault_secret_id, c.model_default, c.monthly_budget_usd
    INTO v_cred
  FROM public.tenant_ai_credentials c
  WHERE c.tenant_id = _tenant_id
    AND c.provider = _provider
    AND c.is_active = true
  LIMIT 1;

  IF v_cred.id IS NULL THEN
    RETURN;
  END IF;

  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE id = v_cred.vault_secret_id;

  SELECT COALESCE(SUM(cost_usd), 0) INTO v_cost
  FROM public.ia_token_logs
  WHERE tenant_id = _tenant_id
    AND created_at >= DATE_TRUNC('month', now());

  credential_id := v_cred.id;
  api_key := v_key;
  model_default := v_cred.model_default;
  monthly_budget_usd := v_cred.monthly_budget_usd;
  current_month_cost_usd := v_cost;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.get_active_ai_credential(UUID, public.ai_provider) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_ai_credential(UUID, public.ai_provider) TO service_role;

-- ============================================
-- Helper: upsert credential (encrypts key into vault)
-- ============================================
CREATE OR REPLACE FUNCTION public.upsert_ai_credential(
  _tenant_id UUID,
  _provider public.ai_provider,
  _api_key TEXT,
  _model_default TEXT DEFAULT 'gpt-4o-mini',
  _monthly_budget_usd NUMERIC DEFAULT 10.00
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_secret_id UUID;
  v_hint TEXT;
  v_cred_id UUID;
  v_existing RECORD;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only super admin can manage AI credentials';
  END IF;

  v_hint := '****' || RIGHT(_api_key, 4);

  SELECT id, vault_secret_id INTO v_existing
  FROM public.tenant_ai_credentials
  WHERE tenant_id = _tenant_id AND provider = _provider;

  IF v_existing.id IS NOT NULL THEN
    PERFORM vault.update_secret(v_existing.vault_secret_id, _api_key);
    UPDATE public.tenant_ai_credentials
    SET key_hint = v_hint,
        model_default = _model_default,
        monthly_budget_usd = _monthly_budget_usd,
        is_active = true,
        updated_at = now()
    WHERE id = v_existing.id;
    RETURN v_existing.id;
  ELSE
    SELECT vault.create_secret(_api_key, 'ai_key_' || _tenant_id::text || '_' || _provider::text) INTO v_secret_id;
    INSERT INTO public.tenant_ai_credentials (
      tenant_id, provider, vault_secret_id, key_hint, model_default, monthly_budget_usd, created_by
    ) VALUES (
      _tenant_id, _provider, v_secret_id, v_hint, _model_default, _monthly_budget_usd, auth.uid()
    ) RETURNING id INTO v_cred_id;
    RETURN v_cred_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_ai_credential(UUID, public.ai_provider, TEXT, TEXT, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_ai_credential(UUID, public.ai_provider, TEXT, TEXT, NUMERIC) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.upsert_ai_credential(_tenant_id uuid, _provider ai_provider, _api_key text, _model_default text DEFAULT 'gpt-4o-mini'::text, _monthly_budget_usd numeric DEFAULT 10.00)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault'
AS $function$
DECLARE
  v_secret_id UUID;
  v_hint TEXT;
  v_cred_id UUID;
  v_existing RECORD;
  v_role TEXT;
BEGIN
  v_role := current_setting('request.jwt.claims', true)::json->>'role';
  -- Permite service_role (chamadas server-side trusted) ou super_admin via JWT
  IF NOT (v_role = 'service_role' OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Only super admin or service role can manage AI credentials';
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
$function$;
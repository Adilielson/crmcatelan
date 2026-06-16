-- Perfis precisam ser legíveis pelo usuário logado para montar a sessão
GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;

-- Tenants: expõe apenas colunas não sensíveis para o app autenticado.
-- O token legado whatsapp_api_token, CNPJ e contatos sensíveis continuam sem grant direto.
REVOKE ALL ON TABLE public.tenants FROM anon;
REVOKE ALL ON TABLE public.tenants FROM authenticated;
GRANT SELECT (
  id,
  name,
  slug,
  plan,
  status,
  logo_url,
  created_at,
  updated_at,
  limite_usuarios,
  ia_token_quota,
  ia_token_used,
  total_leads_mes,
  storage_used_bytes,
  storage_limit_bytes,
  settings
) ON public.tenants TO authenticated;
GRANT ALL ON TABLE public.tenants TO service_role;

-- O token da instância fica protegido contra leitura/escrita direta pelo navegador.
REVOKE ALL ON TABLE public.whatsapp_config FROM anon;
REVOKE ALL ON TABLE public.whatsapp_config FROM authenticated;
GRANT ALL ON TABLE public.whatsapp_config TO service_role;

-- Logs do WhatsApp são usados pelo app autenticado e por rotinas server-side.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.whatsapp_message_logs TO authenticated;
GRANT ALL ON TABLE public.whatsapp_message_logs TO service_role;

CREATE OR REPLACE FUNCTION public.get_whatsapp_config_status(_tenant_id uuid)
RETURNS TABLE(
  has_token boolean,
  is_connected boolean,
  connected_phone text,
  connected_name text,
  webhook_registered boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_super_admin() OR public.is_tenant_admin(auth.uid(), _tenant_id)) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  RETURN QUERY
  SELECT
    (wc.instance_token IS NOT NULL AND length(wc.instance_token) > 0) AS has_token,
    wc.is_connected,
    wc.connected_phone,
    wc.connected_name,
    wc.webhook_registered
  FROM public.whatsapp_config wc
  WHERE wc.tenant_id = _tenant_id::text
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_whatsapp_instance_token(_tenant_id uuid, _instance_token text)
RETURNS TABLE(
  has_token boolean,
  is_connected boolean,
  connected_phone text,
  connected_name text,
  webhook_registered boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _instance_token IS NULL OR length(trim(_instance_token)) = 0 THEN
    RAISE EXCEPTION 'Token da instância obrigatório.';
  END IF;

  IF NOT (public.is_super_admin() OR public.is_tenant_admin(auth.uid(), _tenant_id)) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  INSERT INTO public.whatsapp_config (
    tenant_id,
    instance_token,
    is_active,
    is_connected,
    webhook_registered,
    connected_phone,
    connected_name,
    updated_at
  ) VALUES (
    _tenant_id::text,
    trim(_instance_token),
    true,
    false,
    false,
    NULL,
    NULL,
    now()
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    instance_token = EXCLUDED.instance_token,
    is_active = true,
    is_connected = false,
    webhook_registered = false,
    connected_phone = NULL,
    connected_name = NULL,
    updated_at = now();

  RETURN QUERY
  SELECT
    true AS has_token,
    false AS is_connected,
    NULL::text AS connected_phone,
    NULL::text AS connected_name,
    false AS webhook_registered;
END;
$$;

REVOKE ALL ON FUNCTION public.get_whatsapp_config_status(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.upsert_whatsapp_instance_token(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_config_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_whatsapp_instance_token(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_config_status(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_whatsapp_instance_token(uuid, text) TO service_role;
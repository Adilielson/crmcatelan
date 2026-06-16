GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.whatsapp_config TO authenticated;
GRANT ALL ON TABLE public.whatsapp_config TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.whatsapp_message_logs TO authenticated;
GRANT ALL ON TABLE public.whatsapp_message_logs TO service_role;

GRANT SELECT (
  id, name, slug, plan, status, logo_url,
  created_at, updated_at,
  limite_usuarios, ia_token_quota, ia_token_used,
  total_leads_mes, storage_used_bytes, storage_limit_bytes,
  settings
) ON public.tenants TO authenticated;
GRANT ALL ON TABLE public.tenants TO service_role;
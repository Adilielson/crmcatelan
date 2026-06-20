
-- 1) Revoke risky RPCs from anon/authenticated (keep service_role for cron)
REVOKE EXECUTE ON FUNCTION public.reactivate_lead_if_stale(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_stale_leads() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_tenant_id(uuid) FROM anon;

-- 2) Lock search_path on internal helper functions
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.touch_ai_configs_updated_at() SET search_path = public;
ALTER FUNCTION public.version_ai_config() SET search_path = public;
ALTER FUNCTION public.update_performance_metrics() SET search_path = public;
ALTER FUNCTION public.block_inactive_tenant_access() SET search_path = public;
ALTER FUNCTION public.protect_tenant_limits() SET search_path = public;
ALTER FUNCTION public.generate_tenant_slug() SET search_path = public;
ALTER FUNCTION public.update_tenant_ia_usage() SET search_path = public;
ALTER FUNCTION public.prevent_last_admin_deletion() SET search_path = public;

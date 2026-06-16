
-- 1. is_super_admin requires active status
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin' AND status = 'active');
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND role = 'super_admin' AND status = 'active');
$$;

-- 2. get_auth_profile: fix search_path
CREATE OR REPLACE FUNCTION public.get_auth_profile()
RETURNS TABLE(id uuid, tenant_id uuid, role public.user_role, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.tenant_id, p.role, p.status FROM public.profiles p WHERE p.id = auth.uid();
$$;

-- 3. Prevent profile self-escalation
CREATE OR REPLACE FUNCTION public.prevent_profile_self_escalation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN NEW; END IF;
  IF public.is_super_admin() THEN RETURN NEW; END IF;
  IF OLD.id <> v_uid THEN RETURN NEW; END IF;
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Você não pode alterar seu próprio papel (role).';
  END IF;
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'Você não pode alterar seu próprio tenant.';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Você não pode alterar seu próprio status.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_self_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_self_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_self_escalation();

-- 4. marketing_integrations: privileged read only
DROP POLICY IF EXISTS "marketing_integrations tenant read" ON public.marketing_integrations;
CREATE POLICY "marketing_integrations privileged read"
ON public.marketing_integrations FOR SELECT TO authenticated
USING (
  tenant_id = public.get_current_user_tenant()
  AND public.get_current_user_role() IN ('admin','super_admin','manager','marketing_partner')
);

-- 5. tenants: column-level grants hide sensitive fields
REVOKE SELECT ON public.tenants FROM authenticated;
GRANT SELECT (
  id, name, slug, plan, status, logo_url,
  created_at, updated_at,
  limite_usuarios, ia_token_quota, ia_token_used,
  total_leads_mes, storage_used_bytes, storage_limit_bytes,
  settings
) ON public.tenants TO authenticated;

CREATE OR REPLACE FUNCTION public.get_tenant_sensitive(_tenant_id uuid)
RETURNS TABLE(
  whatsapp_api_token text,
  cnpj text,
  webhook_url_notificacoes text,
  contato_responsavel text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_super_admin() OR public.is_tenant_admin(auth.uid(), _tenant_id)) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN QUERY
  SELECT t.whatsapp_api_token, t.cnpj, t.webhook_url_notificacoes, t.contato_responsavel
  FROM public.tenants t WHERE t.id = _tenant_id;
END;
$$;
REVOKE ALL ON FUNCTION public.get_tenant_sensitive(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_tenant_sensitive(uuid) TO authenticated;

-- 6. notifications: only service role can INSERT
DROP POLICY IF EXISTS "notifications service insert" ON public.notifications;
CREATE POLICY "notifications service insert"
ON public.notifications FOR INSERT TO service_role WITH CHECK (true);

-- 7. profile_units: SELECT for self / tenant admins / managers
DROP POLICY IF EXISTS "profile_units self read" ON public.profile_units;
CREATE POLICY "profile_units self read"
ON public.profile_units FOR SELECT TO authenticated
USING (
  profile_id = auth.uid()
  OR public.is_super_admin()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = profile_units.profile_id
      AND p.tenant_id = public.get_current_user_tenant()
      AND public.get_current_user_role() IN ('admin','manager')
  )
);

-- 8. Storage whatsapp-media INSERT/UPDATE policies
DROP POLICY IF EXISTS "whatsapp-media tenant insert" ON storage.objects;
CREATE POLICY "whatsapp-media tenant insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'whatsapp-media'
  AND (storage.foldername(name))[1] = public.get_current_user_tenant()::text
);

DROP POLICY IF EXISTS "whatsapp-media tenant update" ON storage.objects;
CREATE POLICY "whatsapp-media tenant update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'whatsapp-media'
  AND (storage.foldername(name))[1] = public.get_current_user_tenant()::text
)
WITH CHECK (
  bucket_id = 'whatsapp-media'
  AND (storage.foldername(name))[1] = public.get_current_user_tenant()::text
);

-- 9. Recreate SECURITY DEFINER views with security_invoker
ALTER VIEW IF EXISTS public.unit_performance_metrics SET (security_invoker = on);
ALTER VIEW IF EXISTS public.saas_global_sla          SET (security_invoker = on);
ALTER VIEW IF EXISTS public.saas_ia_roi_daily        SET (security_invoker = on);
ALTER VIEW IF EXISTS public.saas_churn_ltv_stats     SET (security_invoker = on);
ALTER VIEW IF EXISTS public.tenant_ia_usage_safe     SET (security_invoker = on);
ALTER VIEW IF EXISTS public.saas_ia_usage_summary    SET (security_invoker = on);
ALTER VIEW IF EXISTS public.saas_mrr_stats           SET (security_invoker = on);
ALTER VIEW IF EXISTS public.tenant_ai_usage_month    SET (security_invoker = on);

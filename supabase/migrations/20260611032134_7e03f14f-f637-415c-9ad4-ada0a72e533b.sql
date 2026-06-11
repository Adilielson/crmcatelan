-- 1) marketing_sources: habilitar RLS e cobrir leitura/escrita por tenant
ALTER TABLE public.marketing_sources ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_sources TO authenticated;
GRANT ALL ON public.marketing_sources TO service_role;

DROP POLICY IF EXISTS "Tenant users can view marketing_sources" ON public.marketing_sources;
CREATE POLICY "Tenant users can view marketing_sources"
  ON public.marketing_sources
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_current_user_tenant() OR public.is_super_admin());

DROP POLICY IF EXISTS "Tenant admins manage marketing_sources" ON public.marketing_sources;
CREATE POLICY "Tenant admins manage marketing_sources"
  ON public.marketing_sources
  FOR ALL
  TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_tenant_admin(auth.uid(), tenant_id)
  )
  WITH CHECK (
    public.is_super_admin()
    OR public.is_tenant_admin(auth.uid(), tenant_id)
  );

-- 2) Converter as 7 views para security_invoker (passam a respeitar a RLS do consultante)
ALTER VIEW public.saas_churn_ltv_stats     SET (security_invoker = on);
ALTER VIEW public.saas_global_sla          SET (security_invoker = on);
ALTER VIEW public.saas_ia_roi_daily        SET (security_invoker = on);
ALTER VIEW public.saas_ia_usage_summary    SET (security_invoker = on);
ALTER VIEW public.saas_mrr_stats           SET (security_invoker = on);
ALTER VIEW public.tenant_ia_usage_safe     SET (security_invoker = on);
ALTER VIEW public.unit_performance_metrics SET (security_invoker = on);
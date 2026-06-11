-- =========== activity_logs ===========
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;

DROP POLICY IF EXISTS "activity_logs select" ON public.activity_logs;
CREATE POLICY "activity_logs select" ON public.activity_logs
  FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    OR public.is_super_admin()
    OR public.is_tenant_admin(auth.uid(), tenant_id)
  );

DROP POLICY IF EXISTS "activity_logs insert self" ON public.activity_logs;
CREATE POLICY "activity_logs insert self" ON public.activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid());

-- =========== lead_pipeline_history ===========
ALTER TABLE public.lead_pipeline_history ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.lead_pipeline_history TO authenticated;
GRANT ALL ON public.lead_pipeline_history TO service_role;

DROP POLICY IF EXISTS "pipeline_history tenant access" ON public.lead_pipeline_history;
CREATE POLICY "pipeline_history tenant access" ON public.lead_pipeline_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_pipeline_history.lead_id
        AND (l.tenant_id = public.get_current_user_tenant() OR public.is_super_admin())
    )
  );

DROP POLICY IF EXISTS "pipeline_history tenant insert" ON public.lead_pipeline_history;
CREATE POLICY "pipeline_history tenant insert" ON public.lead_pipeline_history
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_pipeline_history.lead_id
        AND l.tenant_id = public.get_current_user_tenant()
    )
  );

-- =========== notification_preferences ===========
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

DROP POLICY IF EXISTS "notif_prefs self access" ON public.notification_preferences;
CREATE POLICY "notif_prefs self access" ON public.notification_preferences
  FOR ALL TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- =========== notifications ===========
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

DROP POLICY IF EXISTS "notifications self read" ON public.notifications;
CREATE POLICY "notifications self read" ON public.notifications
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "notifications self update" ON public.notifications;
CREATE POLICY "notifications self update" ON public.notifications
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());
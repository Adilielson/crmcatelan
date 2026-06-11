
-- ============ 1. Remover policies "DEV/mock" e ALL/true para public/anon ============
DROP POLICY IF EXISTS "DEV anon access ai_configs" ON public.ai_configs;
DROP POLICY IF EXISTS "DEV anon access ai_config_versions" ON public.ai_config_versions;
DROP POLICY IF EXISTS "DEV anon access ai_knowledge_documents" ON public.ai_knowledge_documents;
DROP POLICY IF EXISTS "CRM mock conversations access" ON public.conversations;
DROP POLICY IF EXISTS "CRM mock messages access" ON public.messages;
DROP POLICY IF EXISTS "Dev mock units access" ON public.units;
DROP POLICY IF EXISTS "Dev tenant read" ON public.tenants;
DROP POLICY IF EXISTS "Dev whatsapp_message_logs access" ON public.whatsapp_message_logs;
DROP POLICY IF EXISTS "whatsapp_config_all" ON public.whatsapp_config;
DROP POLICY IF EXISTS "whatsapp_logs_all" ON public.whatsapp_message_logs;

-- ============ 2. whatsapp_config: tenant admin only ============
-- tenant_id é TEXT nessa tabela; comparamos casting o uuid para text.
CREATE POLICY "whatsapp_config tenant admin read"
  ON public.whatsapp_config FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_tenant_admin(auth.uid(), tenant_id::uuid)
  );

CREATE POLICY "whatsapp_config tenant admin write"
  ON public.whatsapp_config FOR ALL
  TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_tenant_admin(auth.uid(), tenant_id::uuid)
  )
  WITH CHECK (
    public.is_super_admin()
    OR public.is_tenant_admin(auth.uid(), tenant_id::uuid)
  );

-- ============ 3. whatsapp_message_logs: tenant members ============
CREATE POLICY "whatsapp_logs tenant members select"
  ON public.whatsapp_message_logs FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR tenant_id::uuid = public.get_current_user_tenant()
  );

CREATE POLICY "whatsapp_logs tenant members insert"
  ON public.whatsapp_message_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR tenant_id::uuid = public.get_current_user_tenant()
  );

CREATE POLICY "whatsapp_logs tenant members update"
  ON public.whatsapp_message_logs FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin()
    OR tenant_id::uuid = public.get_current_user_tenant()
  )
  WITH CHECK (
    public.is_super_admin()
    OR tenant_id::uuid = public.get_current_user_tenant()
  );

CREATE POLICY "whatsapp_logs tenant admins delete"
  ON public.whatsapp_message_logs FOR DELETE
  TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_tenant_admin(auth.uid(), tenant_id::uuid)
  );

-- ============ 4. messages: INSERT precisa validar tenant da conversa ============
DROP POLICY IF EXISTS "Message insertion policy" ON public.messages;
CREATE POLICY "Message insertion policy"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (
          public.is_super_admin()
          OR c.tenant_id = public.get_current_user_tenant()
        )
    )
  );

-- ============ 5. saas_audit_logs: INSERT amarrado ao usuário autenticado ============
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.saas_audit_logs;
CREATE POLICY "Authenticated users can insert audit logs"
  ON public.saas_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND (
      tenant_id IS NULL
      OR tenant_id = public.get_current_user_tenant()
      OR public.is_super_admin()
    )
  );

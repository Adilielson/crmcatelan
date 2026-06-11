
-- Fix messages SELECT to enforce tenant via conversation
DROP POLICY IF EXISTS "Message viewing policy" ON public.messages;
CREATE POLICY "Message viewing policy" ON public.messages
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id
      AND (is_super_admin() OR c.tenant_id = get_current_user_tenant())
  )
  AND ((NOT is_internal) OR (
    (SELECT role FROM public.profiles WHERE id = auth.uid())
      = ANY (ARRAY['super_admin'::user_role,'admin'::user_role,'manager'::user_role])
  ))
);

-- marketing_integrations: enable RLS + tenant-scoped policies
ALTER TABLE public.marketing_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketing_integrations super admin all" ON public.marketing_integrations;
DROP POLICY IF EXISTS "marketing_integrations tenant admin all" ON public.marketing_integrations;
DROP POLICY IF EXISTS "marketing_integrations tenant read" ON public.marketing_integrations;

CREATE POLICY "marketing_integrations super admin all" ON public.marketing_integrations
FOR ALL TO authenticated
USING (is_super_admin())
WITH CHECK (is_super_admin());

CREATE POLICY "marketing_integrations tenant admin all" ON public.marketing_integrations
FOR ALL TO authenticated
USING (is_tenant_admin(auth.uid(), tenant_id))
WITH CHECK (is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "marketing_integrations tenant read" ON public.marketing_integrations
FOR SELECT TO authenticated
USING (tenant_id = get_current_user_tenant());

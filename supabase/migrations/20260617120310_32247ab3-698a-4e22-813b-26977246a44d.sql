CREATE POLICY "Tenant members insert AI config versions"
ON public.ai_config_versions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.ai_configs ac
    WHERE ac.id = ai_config_versions.ai_config_id
      AND ac.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  )
);
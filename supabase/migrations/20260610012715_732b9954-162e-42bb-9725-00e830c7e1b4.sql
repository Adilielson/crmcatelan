
-- DEV-ONLY: permitir acesso anônimo aos dados do tenant DEV (00000000-0000-0000-0000-000000000001)
-- TODO(auth): remover quando Supabase Auth real for implementado.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_configs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_knowledge_documents TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_config_versions TO anon;

CREATE POLICY "DEV anon access ai_configs" ON public.ai_configs
  FOR ALL TO anon
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "DEV anon access ai_knowledge_documents" ON public.ai_knowledge_documents
  FOR ALL TO anon
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "DEV anon access ai_config_versions" ON public.ai_config_versions
  FOR ALL TO anon
  USING (EXISTS (SELECT 1 FROM public.ai_configs ac WHERE ac.id = ai_config_versions.ai_config_id AND ac.tenant_id = '00000000-0000-0000-0000-000000000001'::uuid))
  WITH CHECK (EXISTS (SELECT 1 FROM public.ai_configs ac WHERE ac.id = ai_config_versions.ai_config_id AND ac.tenant_id = '00000000-0000-0000-0000-000000000001'::uuid));


ALTER POLICY "AI Config Access Policy" ON public.ai_configs TO authenticated;
ALTER POLICY "Admins and Managers can manage AI configs" ON public.ai_configs TO authenticated;
ALTER POLICY "Super Admins see all AI configs" ON public.ai_configs TO authenticated;
ALTER POLICY "Tenant members see AI configs" ON public.ai_configs TO authenticated;

ALTER POLICY "Admins and Managers manage AI docs" ON public.ai_knowledge_documents TO authenticated;
ALTER POLICY "Super Admins see all AI docs" ON public.ai_knowledge_documents TO authenticated;
ALTER POLICY "Tenant members see AI docs" ON public.ai_knowledge_documents TO authenticated;

ALTER POLICY "Tenant members see AI config versions" ON public.ai_config_versions TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_configs TO authenticated;
GRANT ALL ON public.ai_configs TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_config_versions TO authenticated;
GRANT ALL ON public.ai_config_versions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_knowledge_documents TO authenticated;
GRANT ALL ON public.ai_knowledge_documents TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_knowledge_patterns TO authenticated;
GRANT ALL ON public.ai_knowledge_patterns TO service_role;
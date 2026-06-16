-- Restaurar GRANTs ausentes para whatsapp_config (necessários para PostgREST/Data API)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_config TO authenticated;
GRANT ALL ON public.whatsapp_config TO service_role;

-- Garantir GRANTs em outras tabelas críticas do mesmo fluxo que possam estar sem
DO $$
DECLARE
  tbl text;
  has_priv boolean;
  tables text[] := ARRAY[
    'whatsapp_config','whatsapp_message_logs','tenants','profiles','leads','messages',
    'conversations','appointments','appointment_reminders','notifications','notification_preferences',
    'kanban_columns','lead_followups','lead_pipeline_history','units','profile_units',
    'agenda_business_hours','agenda_blocked_dates','ai_configs','ai_config_versions',
    'ai_knowledge_documents','ai_knowledge_patterns','ai_learning_insights',
    'tenant_ai_credentials','ia_token_logs','marketing_integrations','marketing_sources',
    'marketing_spend','conversion_goals','professional_performance','module_permissions',
    'user_module_overrides','plans','global_settings','saas_audit_logs','activity_logs',
    'unit_ai_configs','lead_consultation_summary'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=tbl) THEN
      SELECT EXISTS (
        SELECT 1 FROM information_schema.role_table_grants
        WHERE grantee='authenticated' AND table_schema='public' AND table_name=tbl
          AND privilege_type IN ('SELECT','INSERT','UPDATE','DELETE')
      ) INTO has_priv;
      IF NOT has_priv THEN
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', tbl);
      END IF;

      SELECT EXISTS (
        SELECT 1 FROM information_schema.role_table_grants
        WHERE grantee='service_role' AND table_schema='public' AND table_name=tbl
          AND privilege_type IN ('SELECT','INSERT','UPDATE','DELETE')
      ) INTO has_priv;
      IF NOT has_priv THEN
        EXECUTE format('GRANT ALL ON public.%I TO service_role', tbl);
      END IF;
    END IF;
  END LOOP;
END $$;
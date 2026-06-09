GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_config TO anon, authenticated;
GRANT ALL ON public.whatsapp_config TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_message_logs TO anon, authenticated;
GRANT ALL ON public.whatsapp_message_logs TO service_role;
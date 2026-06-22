GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_message_logs TO authenticated;
GRANT ALL ON public.whatsapp_message_logs TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
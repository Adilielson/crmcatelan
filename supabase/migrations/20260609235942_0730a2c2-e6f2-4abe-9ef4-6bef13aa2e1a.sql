
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_message_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_config;
ALTER TABLE public.whatsapp_message_logs REPLICA IDENTITY FULL;

DROP POLICY IF EXISTS "Dev whatsapp_message_logs access" ON public.whatsapp_message_logs;
CREATE POLICY "Dev whatsapp_message_logs access" ON public.whatsapp_message_logs
  FOR ALL USING (tenant_id = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001');

GRANT SELECT, INSERT ON public.whatsapp_message_logs TO anon, authenticated;
GRANT ALL ON public.whatsapp_message_logs TO service_role;

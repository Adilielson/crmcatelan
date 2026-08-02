ALTER TABLE public.whatsapp_message_logs
  ADD COLUMN IF NOT EXISTS whatsapp_message_id text;

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_message_logs_wamid_uniq
  ON public.whatsapp_message_logs (tenant_id, whatsapp_message_id)
  WHERE whatsapp_message_id IS NOT NULL;
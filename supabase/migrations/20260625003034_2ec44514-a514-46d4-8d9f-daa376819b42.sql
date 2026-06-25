
ALTER TABLE public.whatsapp_message_logs
  ADD COLUMN IF NOT EXISTS body text;

CREATE INDEX IF NOT EXISTS idx_wml_tenant_sent_at
  ON public.whatsapp_message_logs (tenant_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_wml_phone_sent_at
  ON public.whatsapp_message_logs (recipient_phone, sent_at DESC);

-- Backfill: copia o texto que já vinha sendo salvo em error_message para body
UPDATE public.whatsapp_message_logs
   SET body = error_message
 WHERE body IS NULL
   AND error_message IS NOT NULL
   AND message_type IN ('text','chat','conversation','extendedTextMessage');

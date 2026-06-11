ALTER TABLE public.whatsapp_message_logs
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_mime text;
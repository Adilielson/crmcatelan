
ALTER TABLE public.whatsapp_message_logs
  ADD COLUMN IF NOT EXISTS sender_name text,
  ADD COLUMN IF NOT EXISTS sender_avatar_url text;

-- Remove registros antigos com telefones inválidos (IDs de mensagem capturados por engano)
DELETE FROM public.whatsapp_message_logs
WHERE length(regexp_replace(recipient_phone, '\D', '', 'g')) NOT BETWEEN 10 AND 13;

DELETE FROM public.whatsapp_message_logs
WHERE status = 'received'
  AND (error_message IS NULL OR btrim(error_message) = '')
  AND media_url IS NULL
  AND media_storage_path IS NULL;
-- 1) Coluna para path permanente no Storage
ALTER TABLE public.whatsapp_message_logs
  ADD COLUMN IF NOT EXISTS media_storage_path text;

CREATE INDEX IF NOT EXISTS idx_whatsapp_message_logs_media_storage_path
  ON public.whatsapp_message_logs (media_storage_path)
  WHERE media_storage_path IS NOT NULL;

-- 2) Policies no storage.objects para o bucket "whatsapp-media"
-- Layout do path: {tenant_id}/{yyyy}/{mm}/{uuid}.{ext}
-- Apenas membros do tenant podem ler; service_role (webhook/admin) escreve.

DROP POLICY IF EXISTS "tenant members can read whatsapp media" ON storage.objects;
CREATE POLICY "tenant members can read whatsapp media"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'whatsapp-media'
    AND (storage.foldername(name))[1] = public.get_current_user_tenant()::text
  );

DROP POLICY IF EXISTS "tenant admins can delete whatsapp media" ON storage.objects;
CREATE POLICY "tenant admins can delete whatsapp media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'whatsapp-media'
    AND (storage.foldername(name))[1] = public.get_current_user_tenant()::text
    AND public.is_tenant_admin(auth.uid(), public.get_current_user_tenant())
  );

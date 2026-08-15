-- Separa conteúdo de mensagem (body) de erros reais (failure_reason)
-- body já existe e já foi preenchido pela migration 20260802
ALTER TABLE public.whatsapp_message_logs
  ADD COLUMN IF NOT EXISTS failure_reason text;

-- Backfill: erros reais vão para failure_reason
UPDATE public.whatsapp_message_logs
  SET failure_reason = error_message
  WHERE status = 'failed'
    AND error_message IS NOT NULL
    AND (error_message LIKE 'HTTP %' OR error_message LIKE 'Error:%');

-- Corrige RLS: a policy atual usa is_super_admin() como USING,
-- bloqueando usuários normais do tenant de ler seus próprios logs
DROP POLICY IF EXISTS "whatsapp_logs tenant members select" ON public.whatsapp_message_logs;

CREATE POLICY "whatsapp_logs select own tenant"
  ON public.whatsapp_message_logs FOR SELECT
  TO authenticated
  USING (
    tenant_id = (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

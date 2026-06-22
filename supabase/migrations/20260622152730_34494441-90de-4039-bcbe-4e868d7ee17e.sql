CREATE TABLE public.webhook_debug_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  event_type text,
  payload jsonb,
  received_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.webhook_debug_logs TO authenticated;
GRANT ALL ON public.webhook_debug_logs TO service_role;

ALTER TABLE public.webhook_debug_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to service_role"
ON public.webhook_debug_logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated read own tenant"
ON public.webhook_debug_logs
FOR SELECT
TO authenticated
USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- Índice para limpeza rápida
CREATE INDEX idx_webhook_debug_logs_received_at ON public.webhook_debug_logs(received_at);

-- Função e trigger para limpar logs com mais de 7 dias
CREATE OR REPLACE FUNCTION public.clean_old_webhook_debug_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.webhook_debug_logs WHERE received_at < now() - interval '7 days';
END;
$$;
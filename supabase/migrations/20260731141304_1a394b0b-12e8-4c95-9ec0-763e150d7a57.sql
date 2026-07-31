-- Retenção de 7 dias para webhook_debug_logs (idempotente)
CREATE INDEX IF NOT EXISTS idx_webhook_debug_logs_received_at
  ON public.webhook_debug_logs (received_at);

CREATE OR REPLACE FUNCTION public.clean_old_webhook_debug_logs()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.webhook_debug_logs
  WHERE received_at < now() - INTERVAL '7 days';
$$;

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'clean-webhook-debug-logs-daily') THEN
    PERFORM cron.unschedule('clean-webhook-debug-logs-daily');
  END IF;
  PERFORM cron.schedule(
    'clean-webhook-debug-logs-daily',
    '0 3 * * *',
    $cron$ SELECT public.clean_old_webhook_debug_logs(); $cron$
  );
END $$;
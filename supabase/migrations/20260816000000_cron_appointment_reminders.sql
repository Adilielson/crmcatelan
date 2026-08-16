-- Cron job: processa lembretes de agendamento pendentes a cada 5 minutos.
-- A rota /api/public/hooks/process-appointment-reminders lê a tabela
-- appointment_reminders (populada automaticamente pelo trigger
-- trg_schedule_appointment_reminders em appointments) e envia via WhatsApp.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$ BEGIN
  PERFORM cron.unschedule('process-appointment-reminders-5min');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'process-appointment-reminders-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--a4fae15a-5be2-4935-8219-348863e85123.lovable.app/api/public/hooks/process-appointment-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdxc2NnY2ViZ29rb2dsa29pZG56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2ODYyMDIsImV4cCI6MjA5NjI2MjIwMn0.xwUvcdX3WV_PrD2076tmwKJ0GW5u__pb3m60XMuSofY'
    ),
    body := '{}'::jsonb
  );
  $$
);

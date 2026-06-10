
ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS business_hours jsonb NOT NULL DEFAULT '{
    "mon": ["09:00","18:00"],
    "tue": ["09:00","18:00"],
    "wed": ["09:00","18:00"],
    "thu": ["09:00","18:00"],
    "fri": ["09:00","18:00"],
    "sat": ["09:00","13:00"],
    "sun": null
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Sao_Paulo';

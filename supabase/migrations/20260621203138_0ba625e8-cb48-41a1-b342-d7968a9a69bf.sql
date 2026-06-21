ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lost_reason text,
  ADD COLUMN IF NOT EXISTS lost_reason_note text;

CREATE INDEX IF NOT EXISTS idx_leads_lost_reason ON public.leads(tenant_id, lost_reason) WHERE status = 'lost';

-- Captura origem de anúncio (Click-to-WhatsApp / UTMs) por lead
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS ad_id              TEXT,
  ADD COLUMN IF NOT EXISTS ad_name            TEXT,
  ADD COLUMN IF NOT EXISTS ad_headline        TEXT,
  ADD COLUMN IF NOT EXISTS ad_body            TEXT,
  ADD COLUMN IF NOT EXISTS ad_thumbnail_url   TEXT,
  ADD COLUMN IF NOT EXISTS ad_source_url      TEXT,
  ADD COLUMN IF NOT EXISTS ad_media_type      TEXT,
  ADD COLUMN IF NOT EXISTS ctwa_clid          TEXT,
  ADD COLUMN IF NOT EXISTS utm_source         TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium         TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign       TEXT,
  ADD COLUMN IF NOT EXISTS utm_content        TEXT,
  ADD COLUMN IF NOT EXISTS utm_term           TEXT,
  ADD COLUMN IF NOT EXISTS ad_captured_at     TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_leads_ad_id        ON public.leads (tenant_id, ad_id)        WHERE ad_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_utm_campaign ON public.leads (tenant_id, utm_campaign) WHERE utm_campaign IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_ctwa_clid    ON public.leads (tenant_id, ctwa_clid)    WHERE ctwa_clid IS NOT NULL;

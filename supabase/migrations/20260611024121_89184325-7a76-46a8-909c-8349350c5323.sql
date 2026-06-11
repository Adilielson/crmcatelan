CREATE TABLE public.lead_consultation_summary (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL UNIQUE REFERENCES public.leads(id) ON DELETE CASCADE,
  filled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  needs_glasses TEXT CHECK (needs_glasses IN ('yes','no','reading','distance','both')),
  lens_type TEXT,

  od_spherical NUMERIC(5,2),
  od_cylindrical NUMERIC(5,2),
  od_axis INTEGER,
  od_addition NUMERIC(5,2),
  oe_spherical NUMERIC(5,2),
  oe_cylindrical NUMERIC(5,2),
  oe_axis INTEGER,
  oe_addition NUMERIC(5,2),
  prescription_valid_until DATE,

  frame_recommendation TEXT,
  treatments TEXT[] DEFAULT '{}',
  price_range_presented TEXT,
  products_shown TEXT,

  no_close_reason TEXT,
  no_close_reason_detail TEXT,
  professional_notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_consultation_summary TO authenticated;
GRANT ALL ON public.lead_consultation_summary TO service_role;

ALTER TABLE public.lead_consultation_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members can view consultation summaries"
ON public.lead_consultation_summary FOR SELECT
TO authenticated
USING (tenant_id = public.get_current_user_tenant());

CREATE POLICY "tenant members can manage consultation summaries"
ON public.lead_consultation_summary FOR ALL
TO authenticated
USING (tenant_id = public.get_current_user_tenant())
WITH CHECK (tenant_id = public.get_current_user_tenant());

CREATE TRIGGER set_lead_consultation_summary_updated_at
BEFORE UPDATE ON public.lead_consultation_summary
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_lead_consultation_summary_tenant ON public.lead_consultation_summary(tenant_id);
CREATE INDEX idx_lead_consultation_summary_lead ON public.lead_consultation_summary(lead_id);
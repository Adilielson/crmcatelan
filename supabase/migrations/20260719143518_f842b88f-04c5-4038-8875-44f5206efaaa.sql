
CREATE TABLE IF NOT EXISTS public.ai_copilot_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ai_config_id UUID REFERENCES public.ai_configs(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  instruction TEXT NOT NULL,
  summary TEXT,
  applied_fields TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'applied',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_copilot_history_tenant_created
  ON public.ai_copilot_history (tenant_id, created_at DESC);

GRANT SELECT, INSERT ON public.ai_copilot_history TO authenticated;
GRANT ALL ON public.ai_copilot_history TO service_role;

ALTER TABLE public.ai_copilot_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members read copilot history"
  ON public.ai_copilot_history
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND status = 'active')
  );

CREATE POLICY "Tenant admins write copilot history"
  ON public.ai_copilot_history
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND status = 'active')
  );

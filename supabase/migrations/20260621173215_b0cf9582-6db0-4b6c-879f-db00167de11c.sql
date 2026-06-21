
-- 1) consultation_types
CREATE TABLE public.consultation_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  default_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultation_types TO authenticated;
GRANT ALL ON public.consultation_types TO service_role;

ALTER TABLE public.consultation_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_members_read_consultation_types"
  ON public.consultation_types FOR SELECT TO authenticated
  USING (tenant_id = public.get_current_user_tenant() OR public.is_super_admin());

CREATE POLICY "tenant_admins_write_consultation_types"
  ON public.consultation_types FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (public.is_super_admin() OR public.is_tenant_admin(auth.uid(), tenant_id));

CREATE TRIGGER trg_consultation_types_updated
  BEFORE UPDATE ON public.consultation_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) revenue_goals (Bronze/Ouro/Diamante)
CREATE TABLE public.revenue_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES public.units(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  bronze NUMERIC(14,2) NOT NULL DEFAULT 0,
  gold   NUMERIC(14,2) NOT NULL DEFAULT 0,
  diamond NUMERIC(14,2) NOT NULL DEFAULT 0,
  active_tier TEXT NOT NULL DEFAULT 'bronze' CHECK (active_tier IN ('bronze','gold','diamond')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, unit_id, month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.revenue_goals TO authenticated;
GRANT ALL ON public.revenue_goals TO service_role;

ALTER TABLE public.revenue_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_members_read_revenue_goals"
  ON public.revenue_goals FOR SELECT TO authenticated
  USING (tenant_id = public.get_current_user_tenant() OR public.is_super_admin());

CREATE POLICY "tenant_admins_write_revenue_goals"
  ON public.revenue_goals FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (public.is_super_admin() OR public.is_tenant_admin(auth.uid(), tenant_id));

CREATE TRIGGER trg_revenue_goals_updated
  BEFORE UPDATE ON public.revenue_goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Colunas extras
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS consultation_type_id UUID REFERENCES public.consultation_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by_ai BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_from_ai BOOLEAN NOT NULL DEFAULT false;

-- 4) Seed default consultation_types for existing tenants
INSERT INTO public.consultation_types (tenant_id, name, default_value)
SELECT t.id, 'Optometrista', 29.90 FROM public.tenants t
ON CONFLICT (tenant_id, name) DO NOTHING;

INSERT INTO public.consultation_types (tenant_id, name, default_value)
SELECT t.id, 'Oftalmológica', 120.00 FROM public.tenants t
ON CONFLICT (tenant_id, name) DO NOTHING;

-- 5) Trigger to seed consultation_types for new tenants
CREATE OR REPLACE FUNCTION public.seed_consultation_types_for_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.consultation_types (tenant_id, name, default_value)
  VALUES
    (NEW.id, 'Optometrista', 29.90),
    (NEW.id, 'Oftalmológica', 120.00)
  ON CONFLICT (tenant_id, name) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_consultation_types ON public.tenants;
CREATE TRIGGER trg_seed_consultation_types
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.seed_consultation_types_for_tenant();

-- 6) View unificada de receita
CREATE OR REPLACE VIEW public.v_revenue_events
WITH (security_invoker = true)
AS
-- Consultas pagas (appointment completed)
SELECT
  a.tenant_id,
  a.unit_id,
  a.lead_id,
  a.professional_id AS user_id,
  'consultation'::text AS source_type,
  COALESCE(a.value, ct.default_value, 0) AS amount,
  COALESCE(a.checkout_at, a.scheduled_at) AS event_at,
  a.id AS source_id,
  a.created_by_ai
FROM public.appointments a
LEFT JOIN public.consultation_types ct ON ct.id = a.consultation_type_id
WHERE a.status = 'completed'
  AND COALESCE(a.value, ct.default_value, 0) > 0

UNION ALL

-- Vendas de óculos (lead showed_up com sales_value)
SELECT
  l.tenant_id,
  l.unit_id,
  l.id AS lead_id,
  l.assigned_user_id AS user_id,
  'glasses_sale'::text AS source_type,
  l.sales_value AS amount,
  COALESCE(l.closed_at, l.updated_at) AS event_at,
  l.id AS source_id,
  false AS created_by_ai
FROM public.leads l
WHERE l.status = 'showed_up'
  AND COALESCE(l.sales_value, 0) > 0;

GRANT SELECT ON public.v_revenue_events TO authenticated;
GRANT ALL  ON public.v_revenue_events TO service_role;

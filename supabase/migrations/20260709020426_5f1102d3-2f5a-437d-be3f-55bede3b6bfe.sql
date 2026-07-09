
-- Janelas semanais por tipo de exame (0..6 = Dom..Sáb)
CREATE TABLE public.consultation_type_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  consultation_type_id UUID NOT NULL REFERENCES public.consultation_types(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  is_active BOOLEAN NOT NULL DEFAULT true,
  start_time TIME,
  end_time TIME,
  slot_minutes SMALLINT NOT NULL DEFAULT 30 CHECK (slot_minutes BETWEEN 5 AND 240),
  saturday_recurrence TEXT NOT NULL DEFAULT 'all'
    CHECK (saturday_recurrence IN ('all','even','odd','none')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (consultation_type_id, weekday)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultation_type_hours TO authenticated;
GRANT ALL ON public.consultation_type_hours TO service_role;

ALTER TABLE public.consultation_type_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members read consultation_type_hours"
  ON public.consultation_type_hours FOR SELECT
  USING (tenant_id = public.get_current_user_tenant());

CREATE POLICY "tenant admins manage consultation_type_hours"
  ON public.consultation_type_hours FOR ALL
  USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE TRIGGER trg_cth_updated_at
  BEFORE UPDATE ON public.consultation_type_hours
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Datas específicas: liga/desliga um exame numa data (sobrescreve a regra semanal)
CREATE TABLE public.consultation_type_date_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  consultation_type_id UUID NOT NULL REFERENCES public.consultation_types(id) ON DELETE CASCADE,
  override_date DATE NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  start_time TIME,
  end_time TIME,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (consultation_type_id, override_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultation_type_date_overrides TO authenticated;
GRANT ALL ON public.consultation_type_date_overrides TO service_role;

ALTER TABLE public.consultation_type_date_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members read consultation_type_date_overrides"
  ON public.consultation_type_date_overrides FOR SELECT
  USING (tenant_id = public.get_current_user_tenant());

CREATE POLICY "tenant admins manage consultation_type_date_overrides"
  ON public.consultation_type_date_overrides FOR ALL
  USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE TRIGGER trg_ctdo_updated_at
  BEFORE UPDATE ON public.consultation_type_date_overrides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed inicial conforme regra da ótica
-- Optometrista: todos os dias 14:00–18:00 (slot 20 min)
INSERT INTO public.consultation_type_hours (tenant_id, consultation_type_id, weekday, is_active, start_time, end_time, slot_minutes)
SELECT ct.tenant_id, ct.id, w.weekday, true, '14:00'::time, '18:00'::time, 20
FROM public.consultation_types ct
CROSS JOIN generate_series(0,6) AS w(weekday)
WHERE ct.name ILIKE 'optometrista'
ON CONFLICT (consultation_type_id, weekday) DO NOTHING;

-- Oftalmologista: quarta 15–17, sábado alternado 08:30–12:30 (slot 40 min); resto desativado
INSERT INTO public.consultation_type_hours (tenant_id, consultation_type_id, weekday, is_active, start_time, end_time, slot_minutes, saturday_recurrence)
SELECT ct.tenant_id, ct.id, w.weekday,
  CASE WHEN w.weekday IN (3,6) THEN true ELSE false END,
  CASE WHEN w.weekday = 3 THEN '15:00'::time WHEN w.weekday = 6 THEN '08:30'::time ELSE NULL END,
  CASE WHEN w.weekday = 3 THEN '17:00'::time WHEN w.weekday = 6 THEN '12:30'::time ELSE NULL END,
  40,
  CASE WHEN w.weekday = 6 THEN 'even' ELSE 'all' END
FROM public.consultation_types ct
CROSS JOIN generate_series(0,6) AS w(weekday)
WHERE ct.name ILIKE 'oftal%'
ON CONFLICT (consultation_type_id, weekday) DO NOTHING;

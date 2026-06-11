
-- 1. business hours table
CREATE TABLE public.agenda_business_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  is_open boolean NOT NULL DEFAULT true,
  open_time time,
  close_time time,
  lunch_start time,
  lunch_end time,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, weekday)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_business_hours TO authenticated;
GRANT ALL ON public.agenda_business_hours TO service_role;

ALTER TABLE public.agenda_business_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members read business hours"
  ON public.agenda_business_hours FOR SELECT TO authenticated
  USING (tenant_id = public.get_current_user_tenant());

CREATE POLICY "tenant members write business hours"
  ON public.agenda_business_hours FOR ALL TO authenticated
  USING (tenant_id = public.get_current_user_tenant())
  WITH CHECK (tenant_id = public.get_current_user_tenant());

CREATE TRIGGER trg_agenda_business_hours_updated_at
  BEFORE UPDATE ON public.agenda_business_hours
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. blocked dates table
CREATE TABLE public.agenda_blocked_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  blocked_date date NOT NULL,
  all_day boolean NOT NULL DEFAULT true,
  block_start time,
  block_end time,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX agenda_blocked_dates_tenant_date_idx
  ON public.agenda_blocked_dates (tenant_id, blocked_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_blocked_dates TO authenticated;
GRANT ALL ON public.agenda_blocked_dates TO service_role;

ALTER TABLE public.agenda_blocked_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members read blocked dates"
  ON public.agenda_blocked_dates FOR SELECT TO authenticated
  USING (tenant_id = public.get_current_user_tenant());

CREATE POLICY "tenant members write blocked dates"
  ON public.agenda_blocked_dates FOR ALL TO authenticated
  USING (tenant_id = public.get_current_user_tenant())
  WITH CHECK (tenant_id = public.get_current_user_tenant());

CREATE TRIGGER trg_agenda_blocked_dates_updated_at
  BEFORE UPDATE ON public.agenda_blocked_dates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. seed default hours for new tenants
CREATE OR REPLACE FUNCTION public.seed_agenda_business_hours_for_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- weekdays 1..5 = seg..sex (open 08-18, lunch 12-13)
  INSERT INTO public.agenda_business_hours (tenant_id, weekday, is_open, open_time, close_time, lunch_start, lunch_end)
  VALUES
    (NEW.id, 0, false, NULL, NULL, NULL, NULL),
    (NEW.id, 1, true, '08:00', '18:00', '12:00', '13:00'),
    (NEW.id, 2, true, '08:00', '18:00', '12:00', '13:00'),
    (NEW.id, 3, true, '08:00', '18:00', '12:00', '13:00'),
    (NEW.id, 4, true, '08:00', '18:00', '12:00', '13:00'),
    (NEW.id, 5, true, '08:00', '18:00', '12:00', '13:00'),
    (NEW.id, 6, false, NULL, NULL, NULL, NULL)
  ON CONFLICT (tenant_id, weekday) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_seed_agenda_hours_after_tenant_insert
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.seed_agenda_business_hours_for_tenant();

-- 4. backfill existing tenants
INSERT INTO public.agenda_business_hours (tenant_id, weekday, is_open, open_time, close_time, lunch_start, lunch_end)
SELECT t.id, w.weekday,
       CASE WHEN w.weekday BETWEEN 1 AND 5 THEN true ELSE false END,
       CASE WHEN w.weekday BETWEEN 1 AND 5 THEN time '08:00' END,
       CASE WHEN w.weekday BETWEEN 1 AND 5 THEN time '18:00' END,
       CASE WHEN w.weekday BETWEEN 1 AND 5 THEN time '12:00' END,
       CASE WHEN w.weekday BETWEEN 1 AND 5 THEN time '13:00' END
FROM public.tenants t
CROSS JOIN (VALUES (0),(1),(2),(3),(4),(5),(6)) AS w(weekday)
ON CONFLICT (tenant_id, weekday) DO NOTHING;

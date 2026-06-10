
-- 1) Add missing columns to appointments
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS end_at timestamptz,
  ADD COLUMN IF NOT EXISTS value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notification_channel text DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS reminder_sent boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reschedule_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS needs_transport boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS lead_name text,
  ADD COLUMN IF NOT EXISTS unit_name text,
  ADD COLUMN IF NOT EXISTS origin text DEFAULT 'manual';

-- 2) Drop legacy dev policy, keep proper tenant-aware policy
DROP POLICY IF EXISTS "Dev mock appointments access" ON public.appointments;

-- The existing "Appointment Access Policy" is fine for SELECT/UPDATE/DELETE.
-- We need a separate INSERT policy that allows authenticated users to insert
-- into their own tenant (the existing policy uses appointments.tenant_id
-- which is fine for FOR ALL, but ensure WITH CHECK exists).
DROP POLICY IF EXISTS "Appointment Access Policy" ON public.appointments;

CREATE POLICY "Tenant users manage appointments"
  ON public.appointments
  FOR ALL
  USING (
    is_super_admin()
    OR tenant_id = get_current_user_tenant()
  )
  WITH CHECK (
    is_super_admin()
    OR tenant_id = get_current_user_tenant()
  );

-- 3) Ensure grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;

-- 4) updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_appointments_updated_at ON public.appointments;
CREATE TRIGGER trg_appointments_updated_at
BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

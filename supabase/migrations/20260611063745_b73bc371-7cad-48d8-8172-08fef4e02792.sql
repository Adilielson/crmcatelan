
-- 1. Profiles: phone, notification_phone
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS notification_phone TEXT;

-- 2. Leads: claim indicator (quem assumiu e quando)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS claimed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_leads_claimed_by ON public.leads(claimed_by);

-- 3. Notification preferences: channel
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'in_app'
    CHECK (channel IN ('in_app','whatsapp','both'));

-- 4. RLS: admin/manager do tenant podem gerenciar profiles do próprio tenant
DROP POLICY IF EXISTS "tenant_admins_manage_team" ON public.profiles;
CREATE POLICY "tenant_admins_manage_team"
ON public.profiles
FOR ALL
TO authenticated
USING (
  public.is_super_admin()
  OR public.is_tenant_admin(auth.uid(), tenant_id)
  OR id = auth.uid()
)
WITH CHECK (
  public.is_super_admin()
  OR public.is_tenant_admin(auth.uid(), tenant_id)
  OR id = auth.uid()
);

-- 5. Garantir grants (idempotente)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;


-- Default permissions per role per tenant
CREATE TABLE public.module_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role public.user_role NOT NULL,
  module_key TEXT NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, role, module_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.module_permissions TO authenticated;
GRANT ALL ON public.module_permissions TO service_role;

ALTER TABLE public.module_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant users can read role perms"
  ON public.module_permissions FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_current_user_tenant());

CREATE POLICY "tenant admins manage role perms"
  ON public.module_permissions FOR ALL
  TO authenticated
  USING (
    tenant_id = public.get_current_user_tenant()
    AND public.get_current_user_role() IN ('admin','super_admin')
  )
  WITH CHECK (
    tenant_id = public.get_current_user_tenant()
    AND public.get_current_user_role() IN ('admin','super_admin')
  );

CREATE TRIGGER trg_module_permissions_updated
  BEFORE UPDATE ON public.module_permissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Per-user override (NULL allowed means "use role default")
CREATE TABLE public.user_module_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  allowed BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, module_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_module_overrides TO authenticated;
GRANT ALL ON public.user_module_overrides TO service_role;

ALTER TABLE public.user_module_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own overrides or admins read tenant"
  ON public.user_module_overrides FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      tenant_id = public.get_current_user_tenant()
      AND public.get_current_user_role() IN ('admin','super_admin')
    )
  );

CREATE POLICY "tenant admins manage user overrides"
  ON public.user_module_overrides FOR ALL
  TO authenticated
  USING (
    tenant_id = public.get_current_user_tenant()
    AND public.get_current_user_role() IN ('admin','super_admin')
  )
  WITH CHECK (
    tenant_id = public.get_current_user_tenant()
    AND public.get_current_user_role() IN ('admin','super_admin')
  );

CREATE TRIGGER trg_user_module_overrides_updated
  BEFORE UPDATE ON public.user_module_overrides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed default role permissions for every existing tenant
DO $$
DECLARE
  t RECORD;
  all_modules TEXT[] := ARRAY['home','chat','equipe','kanban','fila','agenda','clientes','performance','no_show','reports','marketing','settings','ai_training','users','saas'];
  seller_modules TEXT[] := ARRAY['home','chat','equipe','kanban','fila','agenda','clientes'];
  manager_modules TEXT[] := ARRAY['home','chat','equipe','kanban','fila','agenda','clientes','performance','no_show','reports'];
  marketing_modules TEXT[] := ARRAY['home','marketing','performance','reports'];
  m TEXT;
BEGIN
  FOR t IN SELECT id FROM public.tenants LOOP
    -- admin & super_admin: everything
    FOREACH m IN ARRAY all_modules LOOP
      INSERT INTO public.module_permissions (tenant_id, role, module_key, allowed)
      VALUES (t.id, 'admin', m, true),
             (t.id, 'super_admin', m, true)
      ON CONFLICT DO NOTHING;
    END LOOP;

    -- manager
    FOREACH m IN ARRAY all_modules LOOP
      INSERT INTO public.module_permissions (tenant_id, role, module_key, allowed)
      VALUES (t.id, 'manager', m, m = ANY(manager_modules))
      ON CONFLICT DO NOTHING;
    END LOOP;

    -- seller
    FOREACH m IN ARRAY all_modules LOOP
      INSERT INTO public.module_permissions (tenant_id, role, module_key, allowed)
      VALUES (t.id, 'seller', m, m = ANY(seller_modules))
      ON CONFLICT DO NOTHING;
    END LOOP;

    -- marketing_partner
    FOREACH m IN ARRAY all_modules LOOP
      INSERT INTO public.module_permissions (tenant_id, role, module_key, allowed)
      VALUES (t.id, 'marketing_partner', m, m = ANY(marketing_modules))
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

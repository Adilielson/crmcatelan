-- Etapa 1: RLS real para leads e units (multi-tenant via profile do usuário logado)

-- LEADS: substitui policy "Dev mock leads access" por policies por tenant + role
DROP POLICY IF EXISTS "Dev mock leads access" ON public.leads;
DROP POLICY IF EXISTS "Tenant users manage own leads" ON public.leads;
DROP POLICY IF EXISTS "Super admins manage all leads" ON public.leads;

CREATE POLICY "Tenant users manage own leads"
ON public.leads
FOR ALL
TO authenticated
USING (tenant_id = public.get_current_user_tenant())
WITH CHECK (tenant_id = public.get_current_user_tenant());

CREATE POLICY "Super admins manage all leads"
ON public.leads
FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;

-- UNITS: ler unidades do próprio tenant
DROP POLICY IF EXISTS "Tenant users read own units" ON public.units;
DROP POLICY IF EXISTS "Tenant admins manage own units" ON public.units;

CREATE POLICY "Tenant users read own units"
ON public.units
FOR SELECT
TO authenticated
USING (tenant_id = public.get_current_user_tenant() OR public.is_super_admin());

CREATE POLICY "Tenant admins manage own units"
ON public.units
FOR ALL
TO authenticated
USING (
  (tenant_id = public.get_current_user_tenant() AND public.get_current_user_role() = 'admin')
  OR public.is_super_admin()
)
WITH CHECK (
  (tenant_id = public.get_current_user_tenant() AND public.get_current_user_role() = 'admin')
  OR public.is_super_admin()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.units TO authenticated;
GRANT ALL ON public.units TO service_role;
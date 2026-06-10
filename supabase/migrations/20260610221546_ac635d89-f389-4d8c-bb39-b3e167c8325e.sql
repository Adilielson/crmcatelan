
-- Helper function: get current user's role without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_tenant()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid() LIMIT 1
$$;

-- Drop ALL existing policies on profiles to remove recursion
DROP POLICY IF EXISTS "Admins see profiles in their tenant" ON public.profiles;
DROP POLICY IF EXISTS "Managers see profiles in their units" ON public.profiles;
DROP POLICY IF EXISTS "Super Admins see all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users see own profile" ON public.profiles;

-- Recreate without self-referencing subqueries
CREATE POLICY "Users see own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Super admins manage all profiles"
  ON public.profiles FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Admins manage tenant profiles"
  ON public.profiles FOR ALL
  USING (
    public.get_current_user_role() = 'admin'::public.user_role
    AND tenant_id = public.get_current_user_tenant()
  )
  WITH CHECK (
    public.get_current_user_role() = 'admin'::public.user_role
    AND tenant_id = public.get_current_user_tenant()
  );

CREATE POLICY "Managers read tenant profiles"
  ON public.profiles FOR SELECT
  USING (
    public.get_current_user_role() = 'manager'::public.user_role
    AND tenant_id = public.get_current_user_tenant()
  );

-- Fix tenants policies that also subquery profiles (also recursive via above)
DROP POLICY IF EXISTS "Users see their own tenant" ON public.tenants;
DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.tenants;

CREATE POLICY "Users see their own tenant"
  ON public.tenants FOR SELECT
  USING (id = public.get_current_user_tenant());

CREATE POLICY "Super admins manage tenants"
  ON public.tenants FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());


-- Helper: admin OR manager OR super_admin do tenant
CREATE OR REPLACE FUNCTION public.is_tenant_admin_or_manager(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id
      AND tenant_id = _tenant_id
      AND role IN ('admin','super_admin','manager')
  )
$$;

-- consultation_types: substituir policy de escrita
DROP POLICY IF EXISTS "tenant_admins_write_consultation_types" ON public.consultation_types;
CREATE POLICY "tenant_admins_write_consultation_types"
  ON public.consultation_types FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_admin_or_manager(auth.uid(), tenant_id))
  WITH CHECK (public.is_super_admin() OR public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

-- revenue_goals: substituir policy de escrita
DROP POLICY IF EXISTS "tenant_admins_write_revenue_goals" ON public.revenue_goals;
CREATE POLICY "tenant_admins_write_revenue_goals"
  ON public.revenue_goals FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_admin_or_manager(auth.uid(), tenant_id))
  WITH CHECK (public.is_super_admin() OR public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

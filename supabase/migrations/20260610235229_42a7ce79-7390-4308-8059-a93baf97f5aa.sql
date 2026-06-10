DROP POLICY IF EXISTS "Admins can insert kanban columns" ON public.kanban_columns;
DROP POLICY IF EXISTS "Admins can update kanban columns" ON public.kanban_columns;
DROP POLICY IF EXISTS "Admins can delete non-system kanban columns" ON public.kanban_columns;

CREATE POLICY "Managers can insert kanban columns"
  ON public.kanban_columns FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.get_current_user_tenant()
    AND public.get_current_user_role() IN ('admin', 'super_admin', 'manager')
  );

CREATE POLICY "Managers can update kanban columns"
  ON public.kanban_columns FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.get_current_user_tenant()
    AND public.get_current_user_role() IN ('admin', 'super_admin', 'manager')
  )
  WITH CHECK (
    tenant_id = public.get_current_user_tenant()
    AND public.get_current_user_role() IN ('admin', 'super_admin', 'manager')
  );

CREATE POLICY "Managers can delete non-system kanban columns"
  ON public.kanban_columns FOR DELETE
  TO authenticated
  USING (
    tenant_id = public.get_current_user_tenant()
    AND public.get_current_user_role() IN ('admin', 'super_admin', 'manager')
    AND is_system = false
  );
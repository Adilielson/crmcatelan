-- ============================================
-- RLS Policies for saas_audit_logs
-- Logs de Suporte e Auditoria de Seguranca
-- ============================================

-- 1. Enable RLS on saas_audit_logs
ALTER TABLE saas_audit_logs ENABLE ROW LEVEL SECURITY;

-- 2. Security definer function to check if a user is super_admin
-- This avoids infinite recursion in RLS policies
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id
      AND role = 'super_admin'
  )
$$;

-- 3. Security definer function to check if a user is admin of a specific tenant
CREATE OR REPLACE FUNCTION public.is_tenant_admin(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id
      AND tenant_id = _tenant_id
      AND role IN ('admin', 'super_admin')
  )
$$;

-- 4. Security definer function to get the user's tenant_id
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = _user_id LIMIT 1
$$;

-- 5. Grant usage on functions to authenticated
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_tenant_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_tenant_id(uuid) TO authenticated;

-- ============================================
-- RLS Policies
-- ============================================

-- Policy: Super Admins can SELECT all audit logs (full audit view)
CREATE POLICY "Super Admins can view all audit logs"
ON saas_audit_logs
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- Policy: Tenant Admins can view only 'support' category logs for their tenant
-- They CANNOT see 'security', 'billing', or 'system' logs (internal only)
CREATE POLICY "Tenant Admins can view support logs for their tenant"
ON saas_audit_logs
FOR SELECT
TO authenticated
USING (
  action_category = 'support'
  AND tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.is_tenant_admin(auth.uid(), tenant_id)
);

-- Policy: Anyone authenticated can INSERT logs (system-generated logs)
-- This allows the application to write logs from server functions
CREATE POLICY "Authenticated users can insert audit logs"
ON saas_audit_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Note: No UPDATE or DELETE policies = append-only (immutable logs)
-- This ensures logs cannot be modified or deleted by any role

-- ============================================
-- Grants
-- ============================================
GRANT SELECT, INSERT ON public.saas_audit_logs TO authenticated;
GRANT ALL ON public.saas_audit_logs TO service_role;

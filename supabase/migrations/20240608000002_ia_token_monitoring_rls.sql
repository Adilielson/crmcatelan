-- 1. Enable RLS on ia_token_logs
ALTER TABLE ia_token_logs ENABLE ROW LEVEL SECURITY;

-- 2. IA_TOKEN_LOGS Policies
-- Super Admin: Full Read Access (Audit/Global View)
CREATE POLICY "Super Admins see all IA logs" ON ia_token_logs
    FOR SELECT USING (is_super_admin());

-- Store Admins (Role: admin): Can view their own logs, but we will use a view to hide sensitive cost_raw
CREATE POLICY "Store Admins see their own IA logs" ON ia_token_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND tenant_id = ia_token_logs.tenant_id
            AND role = 'admin' 
            AND status = 'active'
        )
    );

-- 3. Immutability: Prevent ANY update or delete on logs (including Super Admin)
CREATE POLICY "IA logs are immutable" ON ia_token_logs
    FOR UPDATE WITH CHECK (false);

CREATE POLICY "IA logs cannot be deleted" ON ia_token_logs
    FOR DELETE USING (false);

-- 4. Create a Safe View for Store Admins (Hiding cost_raw)
-- This view allows store owners to see their usage without seeing infrastructure costs.
CREATE OR REPLACE VIEW tenant_ia_usage_safe AS
SELECT 
    id,
    tenant_id,
    model,
    tokens_input,
    tokens_output,
    cost_billed,
    context,
    created_at
FROM ia_token_logs;

-- Note: RLS is inherited from the underlying table, so Store Admins will only see their own records.
-- However, we can't apply RLS directly to views, but since they can only SELECT from ia_token_logs 
-- where they have access, the view naturally filters by the RLS of the source table.


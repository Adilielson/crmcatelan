-- 1. Enable RLS on plans and global_settings
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_settings ENABLE ROW LEVEL SECURITY;

-- 2. PLANS Policies
-- Super Admin: Full Access
CREATE POLICY "Super Admins manage all plans" ON plans
    FOR ALL USING (is_super_admin());

-- Store Admins (Role: admin): Can view plans (to see upgrade options)
CREATE POLICY "Store Admins can view plans" ON plans
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'admin' 
            AND status = 'active'
        )
    );

-- 3. GLOBAL_SETTINGS Policies
-- Super Admin: Full Access
CREATE POLICY "Super Admins manage global settings" ON global_settings
    FOR ALL USING (is_super_admin());

-- All active users: Can view non-sensitive settings (maintenance, broadcast)
-- We block access to keys that might contain secrets by default in the UI/API if needed, 
-- but here we filter by known safe keys.
CREATE POLICY "Users can view public global settings" ON global_settings
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND status = 'active')
        AND key IN ('maintenance_mode', 'system_broadcast', 'default_ia_model')
    );

-- 4. TENANT PROTECTION (Enforce Rule 3: Only Super Admin can change limits)
-- We add a trigger to prevent non-super-admins from changing plan-related fields in tenants table
CREATE OR REPLACE FUNCTION protect_tenant_limits()
RETURNS TRIGGER AS $$
BEGIN
    -- If NOT super admin and trying to change limits or plan
    IF NOT is_super_admin() THEN
        IF (OLD.plan IS DISTINCT FROM NEW.plan OR 
            OLD.limite_usuarios IS DISTINCT FROM NEW.limite_usuarios OR 
            OLD.ia_token_quota IS DISTINCT FROM NEW.ia_token_quota) THEN
            RAISE EXCEPTION 'Apenas o Super Admin pode alterar planos ou limites de usuários/IA.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_protect_tenant_limits ON tenants;
CREATE TRIGGER tr_protect_tenant_limits
BEFORE UPDATE ON tenants
FOR EACH ROW
EXECUTE FUNCTION protect_tenant_limits();


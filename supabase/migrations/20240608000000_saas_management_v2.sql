-- 1. Refine Tenant Status Trigger to block users on 'inactive' or 'cancelled'
CREATE OR REPLACE FUNCTION block_inactive_tenant_access()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('cancelled', 'inactive', 'overdue') THEN
    UPDATE profiles SET status = 'inactive' WHERE tenant_id = NEW.id;
    -- Optional: If status becomes active/trial again, reactive users? 
    -- PRD says "bloqueado imediatamente", doesn't specify reversal. 
    -- But usually 'overdue' to 'active' should restore.
  ELSIF NEW.status IN ('active', 'trial') AND OLD.status IN ('cancelled', 'inactive', 'overdue') THEN
    UPDATE profiles SET status = 'active' WHERE tenant_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Ensure CNPJ is unique (already exists but for safety)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenants_cnpj_key') THEN
        ALTER TABLE tenants ADD CONSTRAINT tenants_cnpj_key UNIQUE (cnpj);
    END IF;
END $$;

-- 3. Super Admin RLS refinement
-- Ensure Super Admins can bypass everything for management
CREATE POLICY "Super Admins manage all units" ON units FOR ALL USING (is_super_admin());
CREATE POLICY "Super Admins manage all profile_units" ON profile_units FOR ALL USING (is_super_admin());
CREATE POLICY "Super Admins manage all marketing_sources" ON marketing_sources FOR ALL USING (is_super_admin());

-- 4. Audit Log for SaaS changes
CREATE TABLE IF NOT EXISTS saas_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID REFERENCES profiles(id),
    target_tenant_id UUID REFERENCES tenants(id),
    action TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE saas_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super Admins see all logs" ON saas_audit_logs FOR SELECT USING (is_super_admin());

-- 5. Storage limit rule (Placeholder - logic usually handled in edge function or app code)
-- But we can add a column to track storage used
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS storage_used_bytes BIGINT DEFAULT 0;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS storage_limit_bytes BIGINT DEFAULT 524288000; -- 500MB default


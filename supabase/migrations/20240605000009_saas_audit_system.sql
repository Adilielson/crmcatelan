-- Enum for log severity
CREATE TYPE log_severity AS ENUM ('info', 'warning', 'critical');

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS saas_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID REFERENCES profiles(id),
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    action_category TEXT NOT NULL, -- 'security', 'billing', 'support', 'system'
    action_type TEXT NOT NULL, -- 'PLAN_CHANGE', 'IMPERSONATE', 'TOKEN_QUOTA_RESET', etc.
    severity log_severity DEFAULT 'info',
    metadata JSONB DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing for search performance
CREATE INDEX IF NOT EXISTS idx_saas_audit_logs_category ON saas_audit_logs(action_category);
CREATE INDEX IF NOT EXISTS idx_saas_audit_logs_created_at ON saas_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_saas_audit_logs_tenant ON saas_audit_logs(tenant_id);

-- Insert dummy logs for initial visualization
INSERT INTO saas_audit_logs (action_category, action_type, severity, metadata, ip_address)
VALUES 
('billing', 'PLAN_CHANGE', 'info', '{"old_plan": "pro", "new_plan": "enterprise"}', '189.12.33.45'),
('security', 'IMPERSONATE', 'warning', '{"target_tenant": "Ótica Castelar"}', '189.12.33.45'),
('system', 'TOKEN_QUOTA_RESET', 'info', '{"tenant": "Ótica Visão", "added_tokens": 50000}', '127.0.0.1');

-- AI Token Usage Logs Table
CREATE TABLE IF NOT EXISTS ia_token_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    model TEXT NOT NULL,
    tokens_input INTEGER DEFAULT 0,
    tokens_output INTEGER DEFAULT 0,
    cost_raw DECIMAL(12,6) DEFAULT 0,
    cost_billed DECIMAL(12,6) DEFAULT 0,
    context TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance tracking
CREATE INDEX IF NOT EXISTS idx_ia_token_logs_tenant_id ON ia_token_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ia_token_logs_created_at ON ia_token_logs(created_at);

-- Trigger to update tenant current usage automatically
CREATE OR REPLACE FUNCTION update_tenant_ia_usage()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE tenants 
    SET ia_token_used = ia_token_used + (NEW.tokens_input + NEW.tokens_output)
    WHERE id = NEW.tenant_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_update_tenant_ia_usage
AFTER INSERT ON ia_token_logs
FOR EACH ROW
EXECUTE FUNCTION update_tenant_ia_usage();

-- View for Super Admin analytics
CREATE OR REPLACE VIEW saas_ia_usage_summary AS
SELECT 
    t.name as tenant_name,
    t.plan,
    SUM(l.tokens_input + l.tokens_output) as total_tokens,
    SUM(l.cost_raw) as total_cost_raw,
    SUM(l.cost_billed) as total_revenue,
    (SUM(l.cost_billed) - SUM(l.cost_raw)) as net_profit
FROM tenants t
JOIN ia_token_logs l ON t.id = l.tenant_id
WHERE l.created_at >= date_trunc('month', now())
GROUP BY t.id, t.name, t.plan;

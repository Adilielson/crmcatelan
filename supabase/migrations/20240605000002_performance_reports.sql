-- Conversion Goals table
CREATE TABLE IF NOT EXISTS conversion_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    month DATE NOT NULL,
    target_conversion_rate DECIMAL(5,2),
    target_cpa DECIMAL(12,2),
    max_no_show_rate DECIMAL(5,2),
    target_appointments INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(unit_id, month)
);

-- Marketing Spend (Mock/Integration)
CREATE TABLE IF NOT EXISTS marketing_spend (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    source_id UUID REFERENCES marketing_sources(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    spend DECIMAL(12,2) NOT NULL,
    impressions INTEGER,
    clicks INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_id, date)
);

-- Index for analytics
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_at ON appointments(scheduled_at);

-- 1. Create Unit-Specific AI Settings if not exists (To support Q4: "só da unidade")
CREATE TABLE IF NOT EXISTS unit_ai_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    auto_scheduling_enabled BOOLEAN DEFAULT true,
    training_mode_override BOOLEAN DEFAULT NULL, -- NULL means use tenant default
    qualification_threshold_override INTEGER DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(unit_id)
);

-- Enable RLS
ALTER TABLE ai_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_config_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_ai_configs ENABLE ROW LEVEL SECURITY;

-- 2. AI_CONFIGS Policies (Tenant level)
CREATE POLICY "Super Admins see all AI configs" ON ai_configs FOR ALL USING (is_super_admin());

CREATE POLICY "Tenant members see AI configs" ON ai_configs
    FOR SELECT USING (
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() AND status = 'active')
    );

CREATE POLICY "Admins and Managers can manage AI configs" ON ai_configs
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() AND status = 'active')
        AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager')
    );

-- 3. UNIT_AI_CONFIGS Policies (Unit level override)
CREATE POLICY "Super Admins see all unit AI configs" ON unit_ai_configs FOR ALL USING (is_super_admin());

CREATE POLICY "Admins manage all unit AI configs in tenant" ON unit_ai_configs
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() AND status = 'active')
        AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    );

CREATE POLICY "Managers manage their unit AI configs" ON unit_ai_configs
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() AND status = 'active')
        AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'manager'
        AND EXISTS (SELECT 1 FROM profile_units pu WHERE pu.profile_id = auth.uid() AND pu.unit_id = unit_ai_configs.unit_id)
    );

-- 4. AI_KNOWLEDGE_DOCUMENTS Policies
CREATE POLICY "Super Admins see all AI docs" ON ai_knowledge_documents FOR ALL USING (is_super_admin());

CREATE POLICY "Tenant members see AI docs" ON ai_knowledge_documents
    FOR SELECT USING (
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() AND status = 'active')
    );

CREATE POLICY "Admins and Managers manage AI docs" ON ai_knowledge_documents
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() AND status = 'active')
        AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager')
    );

-- 5. AI_CONFIG_VERSIONS (Audit trail)
CREATE POLICY "Tenant members see AI config versions" ON ai_config_versions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM ai_configs ac 
            WHERE ac.id = ai_config_versions.ai_config_id 
            AND ac.tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() AND status = 'active')
        )
    );

-- 6. Trigger to automatically version AI configs
CREATE OR REPLACE FUNCTION version_ai_config()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO ai_config_versions (ai_config_id, config_snapshot, created_by)
    VALUES (NEW.id, to_jsonb(NEW), auth.uid());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_version_ai_config
AFTER INSERT OR UPDATE ON ai_configs
FOR EACH ROW EXECUTE FUNCTION version_ai_config();


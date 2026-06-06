-- 1. Ensure No-Show and Conversion Rate tracking fields exist in unit_ai_configs or a new metrics table
-- Based on Q2: "para sua propria unidade" (limits/thresholds)
ALTER TABLE unit_ai_configs 
ADD COLUMN IF NOT EXISTS no_show_alert_threshold DECIMAL(5,2) DEFAULT 20.0,
ADD COLUMN IF NOT EXISTS conversion_target_threshold DECIMAL(5,2) DEFAULT 15.0;

-- 2. Create a specific table for Professional Performance to handle Q1: "só da loja"
CREATE TABLE IF NOT EXISTS professional_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    reference_month DATE NOT NULL,
    total_appointments INTEGER DEFAULT 0,
    no_show_count INTEGER DEFAULT 0,
    conversion_count INTEGER DEFAULT 0,
    revenue_generated DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(profile_id, reference_month)
);

-- Enable RLS
ALTER TABLE professional_performance ENABLE ROW LEVEL SECURITY;

-- 3. PROFESSIONAL_PERFORMANCE Policies
CREATE POLICY "Super Admins see all professional metrics" ON professional_performance
    FOR ALL USING (is_super_admin());

CREATE POLICY "Admins see all professional metrics in tenant" ON professional_performance
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM get_auth_profile() WHERE status = 'active')
        AND (SELECT role FROM get_auth_profile()) = 'admin'
    );

CREATE POLICY "Managers see professional metrics in their unit" ON professional_performance
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM get_auth_profile() WHERE status = 'active')
        AND (SELECT role FROM get_auth_profile()) = 'manager'
        AND EXISTS (SELECT 1 FROM profile_units pu WHERE pu.profile_id = auth.uid() AND pu.unit_id = professional_performance.unit_id)
    );

CREATE POLICY "Sellers see their own performance" ON professional_performance
    FOR SELECT USING (
        profile_id = auth.uid()
        AND (SELECT status FROM get_auth_profile()) = 'active'
    );

-- 4. Trigger to update metrics on Appointment status change
CREATE OR REPLACE FUNCTION update_performance_metrics()
RETURNS TRIGGER AS $$
DECLARE
    v_month DATE;
    v_tenant_id UUID;
BEGIN
    v_month := DATE_TRUNC('month', COALESCE(NEW.scheduled_at, OLD.scheduled_at));
    v_tenant_id := COALESCE(NEW.tenant_id, OLD.tenant_id);

    -- Ensure a record exists for this month/professional
    INSERT INTO professional_performance (tenant_id, unit_id, profile_id, reference_month)
    VALUES (v_tenant_id, COALESCE(NEW.unit_id, OLD.unit_id), COALESCE(NEW.professional_id, OLD.professional_id), v_month)
    ON CONFLICT (profile_id, reference_month) DO NOTHING;

    -- Update counts
    IF (TG_OP = 'UPDATE') THEN
        UPDATE professional_performance
        SET 
            no_show_count = (SELECT COUNT(*) FROM appointments WHERE professional_id = NEW.professional_id AND status = 'no_show' AND DATE_TRUNC('month', scheduled_at) = v_month),
            conversion_count = (SELECT COUNT(*) FROM appointments WHERE professional_id = NEW.professional_id AND status = 'completed' AND DATE_TRUNC('month', scheduled_at) = v_month),
            total_appointments = (SELECT COUNT(*) FROM appointments WHERE professional_id = NEW.professional_id AND DATE_TRUNC('month', scheduled_at) = v_month),
            updated_at = NOW()
        WHERE profile_id = NEW.professional_id AND reference_month = v_month;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_update_performance_metrics
AFTER UPDATE OF status ON appointments
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION update_performance_metrics();


-- Enable RLS on analytics/performance tables
ALTER TABLE conversion_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_spend ENABLE ROW LEVEL SECURITY;

-- 1. CONVERSION GOALS Policies
CREATE POLICY "Super Admins see all goals" ON conversion_goals
    FOR ALL USING (is_super_admin());

CREATE POLICY "Admins can manage all goals in tenant" ON conversion_goals
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() AND status = 'active')
        AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    );

CREATE POLICY "Managers can manage goals for their units" ON conversion_goals
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() AND status = 'active')
        AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'manager'
        AND EXISTS (SELECT 1 FROM profile_units pu WHERE pu.profile_id = auth.uid() AND pu.unit_id = conversion_goals.unit_id)
    );

-- 2. MARKETING SPEND Policies (Restricted to Admins only)
CREATE POLICY "Super Admins see all spend" ON marketing_spend
    FOR ALL USING (is_super_admin());

CREATE POLICY "Admins see and manage spend in tenant" ON marketing_spend
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() AND status = 'active')
        AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    );

-- Note: No policy for Managers on marketing_spend as per Q2: "administrador" only.

-- 3. Refined View for SLA and Benchmarking (Conceptual via RLS)
-- Since we want to restrict benchmarking to the same unit for managers:
-- The existing Lead/Appointment policies already restrict access by unit_id.
-- Any aggregate query performed by a Manager will naturally be limited to their unit data.

-- 4. Audit/Export Logs (Optional but recommended for Q4)
-- If we had an export_logs table, we would allow Managers to insert records there.

-- 5. Views for Performance (Aggregated data for >12 months)
-- These would typically be handled at the API/Client level, but RLS ensures
-- that even if a Manager tries to query raw leads from 2 years ago, 
-- they only see their unit's raw data.


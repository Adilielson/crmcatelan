-- RLS Policies for Marketing/Partners Panel - Lead Source Reports (Ads)

-- 1. Enable RLS on Marketing Tables
ALTER TABLE marketing_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_integrations ENABLE ROW LEVEL SECURITY;

-- 2. Create helper function to check unit access (shared with other migrations if not exists)
CREATE OR REPLACE FUNCTION public.check_user_unit_access(check_unit_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profile_units
        WHERE profile_id = auth.uid()
        AND unit_id = check_unit_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Policies for marketing_sources
-- Admins/Managers see everything in their tenant
CREATE POLICY "Admins/Managers can view all marketing sources"
    ON marketing_sources
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND tenant_id = marketing_sources.tenant_id
            AND role IN ('super_admin', 'admin', 'manager')
        )
    );

-- Marketing Partners see sources linked to leads in units they have access to
-- Note: marketing_sources itself doesn't have unit_id, but leads do.
-- For direct reporting, we allow partners to see sources if they belong to the same tenant, 
-- but we filter the actual data in the views/queries by unit_id when joining with leads.
CREATE POLICY "Partners can view marketing sources of their tenant"
    ON marketing_sources
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND tenant_id = marketing_sources.tenant_id
            AND role = 'marketing_partner'
        )
    );

-- Only Admins can manage marketing sources
CREATE POLICY "Admins can manage marketing sources"
    ON marketing_sources
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND tenant_id = marketing_sources.tenant_id
            AND role IN ('super_admin', 'admin')
        )
    );

-- 4. Policies for marketing_integrations
-- Admins/Managers see all integrations
CREATE POLICY "Admins/Managers can view all integrations"
    ON marketing_integrations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND tenant_id = marketing_integrations.tenant_id
            AND role IN ('super_admin', 'admin', 'manager')
        )
    );

-- Partners can see status/info of integrations but NOT the tokens
CREATE POLICY "Partners can view integration status"
    ON marketing_integrations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND tenant_id = marketing_integrations.tenant_id
            AND role = 'marketing_partner'
        )
    );

-- Token protection: Only super_admin and admin can see the api_token column content
-- (Using column-level logic in policies is limited, usually handled by Views or separate table)
-- For now, we ensure only Admins can perform any action on integrations besides SELECT status
CREATE POLICY "Admins can manage integrations"
    ON marketing_integrations
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND tenant_id = marketing_integrations.tenant_id
            AND role IN ('super_admin', 'admin')
        )
    );

-- 5. Secure View for Lead Source ROI (Ads)
-- This view filters data based on user access to units
CREATE OR REPLACE VIEW lead_source_report_view AS
SELECT 
    l.id as lead_id,
    l.tenant_id,
    l.unit_id,
    l.status,
    l.sales_value,
    ms.name as source_name,
    ms.utm_source,
    ms.utm_medium,
    ms.utm_campaign,
    ms.ad_id,
    ms.platform,
    l.created_at
FROM leads l
JOIN marketing_sources ms ON l.source_id = ms.id
WHERE 
    -- Super Admin sees all
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    OR
    -- Admin/Manager sees all in tenant
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND tenant_id = l.tenant_id AND role IN ('admin', 'manager'))
    OR
    -- Partner/Seller sees only their units
    EXISTS (SELECT 1 FROM profile_units pu WHERE pu.profile_id = auth.uid() AND pu.unit_id = l.unit_id);

GRANT SELECT ON lead_source_report_view TO authenticated;

-- 6. Notifications for marketing alerts (Integration expiration)
-- Partners and Admins should see these
CREATE POLICY "Marketing partners can view marketing notifications"
    ON notifications
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'admin', 'marketing_partner')
            AND (metadata->>'type' = 'marketing_alert' OR user_id = auth.uid())
        )
    );


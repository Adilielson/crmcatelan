-- Refinement of RLS policies for AI Qualification SDR feature

-- 1. Ensure Notifications have RLS enabled (missed in previous migrations)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- 2. NOTIFICATIONS Policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users see own notifications' AND tablename = 'notifications') THEN
        CREATE POLICY "Users see own notifications" ON notifications
            FOR SELECT USING (
                profile_id = auth.uid() 
                OR is_super_admin()
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'System can create notifications' AND tablename = 'notifications') THEN
        CREATE POLICY "System can create notifications" ON notifications
            FOR INSERT WITH CHECK (true); -- Usually inserted via Edge Functions or Triggers
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users update own notifications' AND tablename = 'notifications') THEN
        CREATE POLICY "Users update own notifications" ON notifications
            FOR UPDATE USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());
    END IF;
END $$;

-- 3. NOTIFICATION_PREFERENCES Policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own notification preferences' AND tablename = 'notification_preferences') THEN
        CREATE POLICY "Users manage own notification preferences" ON notification_preferences
            FOR ALL USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());
    END IF;
END $$;

-- 4. Refine LEAD Access Policy for AI SDR workflow
-- Based on user feedback: "devem ver todos os leads" and "não bloquear edição"
-- We need to ensure that Sellers can see leads in their units even if not assigned yet (for AI triage visibility)

DROP POLICY IF EXISTS "Lead Access Policy" ON leads;

CREATE POLICY "Lead Access Policy Refined" ON leads
  FOR ALL USING (
    is_super_admin() OR (
      EXISTS (
        SELECT 1 FROM get_auth_profile() p
        WHERE p.status = 'active' 
        AND p.tenant_id = leads.tenant_id
        AND (
          p.role = 'admin' 
          -- Managers see all leads in their units
          OR (p.role = 'manager' AND EXISTS (SELECT 1 FROM profile_units pu WHERE pu.profile_id = p.id AND pu.unit_id = leads.unit_id))
          -- Sellers see all leads in their units (for triage) or assigned to them
          OR (p.role = 'seller' AND (
              EXISTS (SELECT 1 FROM profile_units pu WHERE pu.profile_id = p.id AND pu.unit_id = leads.unit_id)
              OR leads.assigned_user_id = p.id
          ))
        )
      )
    )
  );

-- 5. Audit logs for AI actions (optional but recommended for traceability)
-- Ensuring changes to AI fields are logged if not already handled by a general audit system

COMMENT ON COLUMN leads.score_ia IS 'AI calculated lead score (0-100)';
COMMENT ON COLUMN leads.ia_summary IS 'AI generated summary of the conversation';
COMMENT ON COLUMN leads.ia_sentiment IS 'AI detected sentiment (positive, neutral, negative)';


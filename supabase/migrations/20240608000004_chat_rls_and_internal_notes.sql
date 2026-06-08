-- 1. Add is_internal column to messages to support Manager private notes
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT false;

-- 2. Ensure RLS is enabled
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Conversation Access Policy" ON conversations;
DROP POLICY IF EXISTS "Message Access Policy" ON messages;

-- 4. CONVERSATIONS Policies
-- Super Admin: Full Access
CREATE POLICY "Super Admin conversations access" ON conversations
    FOR ALL TO authenticated
    USING (is_super_admin());

-- Tenant Admin: Full Access within tenant
CREATE POLICY "Tenant Admin conversations access" ON conversations
    FOR ALL TO authenticated
    USING (
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() AND status = 'active')
        AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    );

-- Manager: Access to conversations in their units
CREATE POLICY "Manager conversations access" ON conversations
    FOR SELECT TO authenticated
    USING (
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() AND status = 'active')
        AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'manager'
        AND EXISTS (
            SELECT 1 FROM leads l
            JOIN profile_units pu ON pu.unit_id = l.unit_id
            WHERE l.id = conversations.lead_id
            AND pu.profile_id = auth.uid()
        )
    );

-- Seller: Access to conversations of their leads
CREATE POLICY "Seller conversations access" ON conversations
    FOR SELECT TO authenticated
    USING (
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() AND status = 'active')
        AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'seller'
        AND EXISTS (
            SELECT 1 FROM leads l
            WHERE l.id = conversations.lead_id
            AND l.assigned_user_id = auth.uid()
        )
    );

-- 5. MESSAGES Policies
-- Base policy: Access through conversation access
-- Note: is_internal filter is applied here for security

CREATE POLICY "Message viewing policy" ON messages
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM conversations c
            WHERE c.id = messages.conversation_id
            -- This relies on the conversation policies already defined
        )
        AND (
            -- Only Super Admin, Tenant Admin, or Manager see internal notes
            NOT messages.is_internal 
            OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'admin', 'manager')
        )
    );

CREATE POLICY "Message insertion policy" ON messages
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM conversations c
            WHERE c.id = messages.conversation_id
        )
    );

-- No UPDATE or DELETE on messages (Append-only requirement)
-- Except for Super Admin (optional, but keep it strict for now as per PRD)


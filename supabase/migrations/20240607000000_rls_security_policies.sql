-- 1. Enable RLS on all relevant tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_integrations ENABLE ROW LEVEL SECURITY;

-- 2. Helper Functions for RLS
CREATE OR REPLACE FUNCTION get_auth_profile()
RETURNS TABLE (id UUID, tenant_id UUID, role user_role, status TEXT) AS $$
  SELECT p.id, p.tenant_id, p.role, p.status 
  FROM profiles p 
  WHERE p.id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin');
$$ LANGUAGE sql SECURITY DEFINER;

-- 3. Universal Block for Inactive Users
-- This is implicitly handled by the policies below: if status != 'active', no policy matches unless super_admin

-- 4. TENANTS Policies
CREATE POLICY "Super Admins see all tenants" ON tenants
  FOR ALL USING (is_super_admin());

CREATE POLICY "Users see their own tenant" ON tenants
  FOR SELECT USING (id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() AND status = 'active'));

-- 5. PROFILES Policies
CREATE POLICY "Super Admins see all profiles" ON profiles
  FOR ALL USING (is_super_admin());

CREATE POLICY "Admins see profiles in their tenant" ON profiles
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() AND status = 'active')
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Managers see profiles in their units" ON profiles
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() AND status = 'active')
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'manager'
    AND (
      role = 'seller' OR id = auth.uid()
    )
  );

CREATE POLICY "Users see own profile" ON profiles
  FOR SELECT USING (id = auth.uid());

-- 6. LEADS Policies (Multi-tenant + Unit Isolation)
CREATE POLICY "Lead Access Policy" ON leads
  FOR ALL USING (
    is_super_admin() OR (
      EXISTS (
        SELECT 1 FROM get_auth_profile() p
        WHERE p.status = 'active' 
        AND p.tenant_id = leads.tenant_id
        AND (
          p.role = 'admin' 
          OR (p.role = 'manager' AND EXISTS (SELECT 1 FROM profile_units pu WHERE pu.profile_id = p.id AND pu.unit_id = leads.unit_id))
          OR (p.role = 'seller' AND leads.assigned_user_id = p.id)
        )
      )
    )
  );

-- 7. APPOINTMENTS Policies
CREATE POLICY "Appointment Access Policy" ON appointments
  FOR ALL USING (
    is_super_admin() OR (
      EXISTS (
        SELECT 1 FROM get_auth_profile() p
        WHERE p.status = 'active' 
        AND p.tenant_id = appointments.tenant_id
        AND (
          p.role = 'admin' 
          OR (p.role = 'manager' AND EXISTS (SELECT 1 FROM profile_units pu WHERE pu.profile_id = p.id AND pu.unit_id = appointments.unit_id))
          OR (p.role = 'seller' AND appointments.professional_id = p.id)
        )
      )
    )
  );

-- 8. CONVERSATIONS Policies
CREATE POLICY "Conversation Access Policy" ON conversations
  FOR ALL USING (
    is_super_admin() OR (
      EXISTS (
        SELECT 1 FROM get_auth_profile() p
        WHERE p.status = 'active' 
        AND p.tenant_id = conversations.tenant_id
        AND (
          p.role IN ('admin', 'manager') -- Managers can see unit conversations
          OR (p.role = 'seller' AND EXISTS (SELECT 1 FROM leads l WHERE l.id = conversations.lead_id AND l.assigned_user_id = p.id))
        )
      )
    )
  );

-- 9. MESSAGES Policies
CREATE POLICY "Message Access Policy" ON messages
  FOR ALL USING (
    is_super_admin() OR (
      EXISTS (
        SELECT 1 FROM conversations c
        JOIN get_auth_profile() p ON p.tenant_id = c.tenant_id
        WHERE c.id = messages.conversation_id
        AND p.status = 'active'
        AND (
          p.role IN ('admin', 'manager')
          OR (p.role = 'seller' AND EXISTS (SELECT 1 FROM leads l WHERE l.id = c.lead_id AND l.assigned_user_id = p.id))
        )
      )
    )
  );

-- 10. AI CONFIGS (Admins only)
CREATE POLICY "AI Config Access Policy" ON ai_configs
  FOR ALL USING (
    is_super_admin() OR (
      EXISTS (
        SELECT 1 FROM get_auth_profile() p
        WHERE p.status = 'active' 
        AND p.tenant_id = ai_configs.tenant_id
        AND p.role = 'admin'
      )
    )
  );

-- 11. Protect Admin Users from self-deletion (Trigger)
CREATE OR REPLACE FUNCTION prevent_last_admin_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role = 'admin' AND (
    SELECT count(*) FROM profiles 
    WHERE tenant_id = OLD.tenant_id 
    AND role = 'admin' 
    AND status = 'active'
  ) <= 1 THEN
    RAISE EXCEPTION 'Não é possível excluir o único administrador ativo do tenant.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_prevent_admin_deletion
BEFORE DELETE ON profiles
FOR EACH ROW
EXECUTE FUNCTION prevent_last_admin_deletion();

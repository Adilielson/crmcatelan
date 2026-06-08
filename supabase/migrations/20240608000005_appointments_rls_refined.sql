-- Refinement of RLS Policies for Agenda de Consultas (appointments)
-- Based on the proposed policies and business rules.

-- 1. Drop the existing broad policy
DROP POLICY IF EXISTS "Appointment Access Policy" ON appointments;

-- 2. Create refined SELECT policy (Isolation and Hierarchy)
CREATE POLICY "Appointments Select Policy" ON appointments
  FOR SELECT USING (
    is_super_admin() OR (
      EXISTS (
        SELECT 1 FROM get_auth_profile() p
        WHERE p.status = 'active' 
        AND p.tenant_id = appointments.tenant_id
        AND (
          p.role = 'admin' 
          OR (p.role = 'manager' AND EXISTS (SELECT 1 FROM profile_units pu WHERE pu.profile_id = p.id AND pu.unit_id = appointments.unit_id))
          OR (p.role = 'seller') -- Atendentes can see the whole unit agenda to avoid conflicts (as per discussion)
        )
      )
    )
  );

-- 3. Create refined INSERT policy
CREATE POLICY "Appointments Insert Policy" ON appointments
  FOR INSERT WITH CHECK (
    is_super_admin() OR (
      EXISTS (
        SELECT 1 FROM get_auth_profile() p
        WHERE p.status = 'active' 
        AND p.tenant_id = appointments.tenant_id
        AND (
          p.role IN ('admin', 'manager', 'seller')
        )
      )
    )
  );

-- 4. Create refined UPDATE policy (Status-based restriction)
-- Atendentes can only edit if not 'realizado' or 'cancelado'
-- Tenant IDs must be immutable
CREATE POLICY "Appointments Update Policy" ON appointments
  FOR UPDATE USING (
    is_super_admin() OR (
      EXISTS (
        SELECT 1 FROM get_auth_profile() p
        WHERE p.status = 'active' 
        AND p.tenant_id = appointments.tenant_id
        AND (
          p.role = 'admin' 
          OR (p.role = 'manager' AND EXISTS (SELECT 1 FROM profile_units pu WHERE pu.profile_id = p.id AND pu.unit_id = appointments.unit_id))
          OR (
            p.role = 'seller' 
            AND status NOT IN ('realizado', 'cancelado') -- Restricted editing for billing integrity
            AND (appointments.professional_id = p.id OR appointments.created_by = p.id)
          )
        )
      )
    )
  ) WITH CHECK (
    tenant_id = (SELECT tenant_id FROM appointments WHERE id = id) -- Immutability of tenant_id
  );

-- 5. Create DELETE policy (Restricted)
-- Only admins can delete, others must cancel by status update
CREATE POLICY "Appointments Delete Policy" ON appointments
  FOR DELETE USING (
    is_super_admin() OR (
      EXISTS (
        SELECT 1 FROM get_auth_profile() p
        WHERE p.status = 'active' 
        AND p.tenant_id = appointments.tenant_id
        AND p.role = 'admin'
      )
    )
  );


-- Update tenants table with PRD requirements
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS contato_responsavel TEXT,
ADD COLUMN IF NOT EXISTS webhook_url_notificacoes TEXT,
ADD COLUMN IF NOT EXISTS total_leads_mes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS limite_usuarios INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS ia_token_quota INTEGER DEFAULT 100000,
ADD COLUMN IF NOT EXISTS ia_token_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Update status and plan constraints/defaults if needed
-- Assuming status and plan were simple text before, let's keep them flexible but document the expected values:
-- status: 'active', 'overdue', 'cancelled', 'trial'
-- plan: 'basic', 'pro', 'enterprise'

-- Function to generate slug from name
CREATE OR REPLACE FUNCTION generate_tenant_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := lower(regexp_replace(NEW.name, '[^a-zA-Z0-9]+', '-', 'g'));
    -- Ensure uniqueness by appending part of UUID if needed (simplified here)
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_generate_tenant_slug
BEFORE INSERT ON tenants
FOR EACH ROW
EXECUTE FUNCTION generate_tenant_slug();

-- Rule: If tenant is inactive/cancelled, block profile access
CREATE OR REPLACE FUNCTION block_inactive_tenant_access()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('cancelled') THEN
    UPDATE profiles SET status = 'inactive' WHERE tenant_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_block_inactive_tenant
AFTER UPDATE OF status ON tenants
FOR EACH ROW
EXECUTE FUNCTION block_inactive_tenant_access();

-- RLS Refinement for Multi-tenancy (Basic isolation)
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON tenants
    FOR ALL
    USING (
        id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) 
        OR 
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    );


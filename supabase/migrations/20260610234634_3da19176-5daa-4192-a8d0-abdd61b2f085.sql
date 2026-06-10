-- 1. Add 'checked_in' to lead_status enum
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'checked_in' AFTER 'scheduled';

-- 2. Create kanban_columns table
CREATE TABLE IF NOT EXISTS public.kanban_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#64748b',
  position INTEGER NOT NULL DEFAULT 0,
  is_system BOOLEAN NOT NULL DEFAULT false,
  system_key TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, system_key)
);

CREATE INDEX IF NOT EXISTS idx_kanban_columns_tenant ON public.kanban_columns(tenant_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_columns TO authenticated;
GRANT ALL ON public.kanban_columns TO service_role;

ALTER TABLE public.kanban_columns ENABLE ROW LEVEL SECURITY;

-- Read: any member of the tenant
CREATE POLICY "Members can view kanban columns of their tenant"
  ON public.kanban_columns FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_current_user_tenant());

-- Write: admin or super_admin of the tenant
CREATE POLICY "Admins can insert kanban columns"
  ON public.kanban_columns FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.get_current_user_tenant()
    AND public.get_current_user_role() IN ('admin', 'super_admin')
  );

CREATE POLICY "Admins can update kanban columns"
  ON public.kanban_columns FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.get_current_user_tenant()
    AND public.get_current_user_role() IN ('admin', 'super_admin')
  )
  WITH CHECK (
    tenant_id = public.get_current_user_tenant()
    AND public.get_current_user_role() IN ('admin', 'super_admin')
  );

CREATE POLICY "Admins can delete non-system kanban columns"
  ON public.kanban_columns FOR DELETE
  TO authenticated
  USING (
    tenant_id = public.get_current_user_tenant()
    AND public.get_current_user_role() IN ('admin', 'super_admin')
    AND is_system = false
  );

CREATE TRIGGER set_kanban_columns_updated_at
  BEFORE UPDATE ON public.kanban_columns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Add custom_column_id to leads (for leads placed in custom columns)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS custom_column_id UUID REFERENCES public.kanban_columns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_custom_column ON public.leads(custom_column_id);

-- 4. Seed system columns for every existing tenant
INSERT INTO public.kanban_columns (tenant_id, name, color, position, is_system, system_key)
SELECT t.id, c.name, c.color, c.position, true, c.system_key
FROM public.tenants t
CROSS JOIN (VALUES
  ('Leads Prontos',  '#3b82f6', 10, 'open'),
  ('Em Atendimento', '#f59e0b', 20, 'in_progress'),
  ('Agendado',       '#8b5cf6', 30, 'scheduled'),
  ('Check-IN OK',    '#10b981', 40, 'checked_in'),
  ('Fechado',        '#22c55e', 50, 'showed_up'),
  ('Perdido',        '#ef4444', 60, 'lost')
) AS c(name, color, position, system_key)
ON CONFLICT (tenant_id, system_key) DO NOTHING;

-- 5. Auto-seed system columns when a new tenant is created
CREATE OR REPLACE FUNCTION public.seed_kanban_columns_for_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.kanban_columns (tenant_id, name, color, position, is_system, system_key)
  VALUES
    (NEW.id, 'Leads Prontos',  '#3b82f6', 10, true, 'open'),
    (NEW.id, 'Em Atendimento', '#f59e0b', 20, true, 'in_progress'),
    (NEW.id, 'Agendado',       '#8b5cf6', 30, true, 'scheduled'),
    (NEW.id, 'Check-IN OK',    '#10b981', 40, true, 'checked_in'),
    (NEW.id, 'Fechado',        '#22c55e', 50, true, 'showed_up'),
    (NEW.id, 'Perdido',        '#ef4444', 60, true, 'lost')
  ON CONFLICT (tenant_id, system_key) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_kanban_columns ON public.tenants;
CREATE TRIGGER trg_seed_kanban_columns
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.seed_kanban_columns_for_tenant();
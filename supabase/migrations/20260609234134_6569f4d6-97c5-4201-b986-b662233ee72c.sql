
INSERT INTO public.tenants (id, name, slug, status, plan)
VALUES ('00000000-0000-0000-0000-000000000001', 'Ótica Catelan Matriz', 'catelan-matriz', 'active', 'pro')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS source text;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO anon, authenticated;
GRANT ALL ON public.leads TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO anon, authenticated;
GRANT ALL ON public.appointments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.units TO anon, authenticated;
GRANT ALL ON public.units TO service_role;
GRANT SELECT ON public.tenants TO anon, authenticated;
GRANT ALL ON public.tenants TO service_role;

DROP POLICY IF EXISTS "CRM mock leads access" ON public.leads;
DROP POLICY IF EXISTS "Lead Access Policy" ON public.leads;
DROP POLICY IF EXISTS "Dev mock leads access" ON public.leads;
CREATE POLICY "Dev mock leads access" ON public.leads
  FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

DROP POLICY IF EXISTS "Dev mock appointments access" ON public.appointments;
CREATE POLICY "Dev mock appointments access" ON public.appointments
  FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

DROP POLICY IF EXISTS "Dev mock units access" ON public.units;
CREATE POLICY "Dev mock units access" ON public.units
  FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

DROP POLICY IF EXISTS "Dev tenant read" ON public.tenants;
CREATE POLICY "Dev tenant read" ON public.tenants
  FOR SELECT
  USING (id = '00000000-0000-0000-0000-000000000001'::uuid);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

INSERT INTO public.units (tenant_id, name, address, phone)
SELECT '00000000-0000-0000-0000-000000000001'::uuid, 'Loja Centro', 'Rua Principal, 100 - Centro', '(27) 9999-0001'
WHERE NOT EXISTS (
  SELECT 1 FROM public.units WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
);

INSERT INTO public.leads (tenant_id, full_name, phone, email, status, sales_value, source, notes, score_ia)
SELECT '00000000-0000-0000-0000-000000000001'::uuid, 'João Silva', '5527999990001', 'joao@example.com', 'open'::lead_status, 2500, 'whatsapp', 'Receita recente, busca lentes multifocais.', 85
WHERE NOT EXISTS (
  SELECT 1 FROM public.leads WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
);

INSERT INTO public.leads (tenant_id, full_name, phone, email, status, sales_value, source)
SELECT '00000000-0000-0000-0000-000000000001'::uuid, 'Maria Souza', '5527999990002', 'maria@example.com', 'in_progress'::lead_status, 4200, 'instagram'
WHERE NOT EXISTS (
  SELECT 1 FROM public.leads WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid AND full_name = 'Maria Souza'
);

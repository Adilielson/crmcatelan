-- 1. Flag de agente-referência
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_reference_agent BOOLEAN NOT NULL DEFAULT false;

-- 2. Peso e atribuição nos patterns
ALTER TABLE public.ai_knowledge_patterns
  ADD COLUMN IF NOT EXISTS weight NUMERIC NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS agent_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_patterns_agent
  ON public.ai_knowledge_patterns(tenant_id, agent_id);

-- 3. Tabela do perfil de estilo
CREATE TABLE IF NOT EXISTS public.ai_reference_style_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE,
  style_guide JSONB NOT NULL DEFAULT '{}'::jsonb,
  style_prompt TEXT NOT NULL DEFAULT '',
  sample_count INT NOT NULL DEFAULT 0,
  reference_agent_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  last_built_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_reference_style_profiles TO authenticated;
GRANT ALL ON public.ai_reference_style_profiles TO service_role;

ALTER TABLE public.ai_reference_style_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their tenant style profile"
  ON public.ai_reference_style_profiles
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_current_user_tenant());

CREATE POLICY "Service role manages style profile"
  ON public.ai_reference_style_profiles
  FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_ai_reference_style_profiles_updated_at
  BEFORE UPDATE ON public.ai_reference_style_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

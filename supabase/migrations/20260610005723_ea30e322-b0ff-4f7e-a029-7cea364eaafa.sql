
-- 1) Knowledge docs: extracted text + size
ALTER TABLE public.ai_knowledge_documents
  ADD COLUMN IF NOT EXISTS content TEXT,
  ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;

-- 2) One ai_configs row per tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ai_configs_tenant_id_unique'
  ) THEN
    ALTER TABLE public.ai_configs
      ADD CONSTRAINT ai_configs_tenant_id_unique UNIQUE (tenant_id);
  END IF;
END$$;

-- 3) updated_at trigger on ai_configs
CREATE OR REPLACE FUNCTION public.touch_ai_configs_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_touch_ai_configs ON public.ai_configs;
CREATE TRIGGER trg_touch_ai_configs
BEFORE UPDATE ON public.ai_configs
FOR EACH ROW EXECUTE FUNCTION public.touch_ai_configs_updated_at();

-- 4) Versioning trigger (uses existing public.version_ai_config())
DROP TRIGGER IF EXISTS trg_version_ai_config ON public.ai_configs;
CREATE TRIGGER trg_version_ai_config
AFTER UPDATE ON public.ai_configs
FOR EACH ROW
WHEN (OLD.* IS DISTINCT FROM NEW.*)
EXECUTE FUNCTION public.version_ai_config();

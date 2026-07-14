ALTER TABLE public.ai_configs ADD COLUMN IF NOT EXISTS behavior_rules TEXT;

COMMENT ON COLUMN public.ai_configs.behavior_rules IS 'Regras mestras de comportamento da IA (editáveis via UI). Se NULL, usa o fallback hardcoded no código.';
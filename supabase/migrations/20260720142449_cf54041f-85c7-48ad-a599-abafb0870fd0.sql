
UPDATE public.ai_configs
SET
  behavior_rules = REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(behavior_rules, '\mOptometrista\M', 'nosso profissional', 'g'),
      '\moptometrista\M', 'nosso profissional', 'g'
    ),
    '\mOftalmologia\M', 'nosso profissional', 'g'
  ),
  knowledge_base_faq = REGEXP_REPLACE(
    REGEXP_REPLACE(knowledge_base_faq, '\*\*Optometrista:\*\*', '**Exame de vista (com nosso profissional):**', 'g'),
    '\mOptometrista\M', 'Profissional', 'g'
  ),
  updated_at = now();

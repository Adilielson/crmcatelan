
-- ============ ai_learning_insights ============
CREATE TABLE public.ai_learning_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  summary TEXT,
  sentiment TEXT, -- positive | neutral | negative
  intent TEXT,
  frequent_questions JSONB DEFAULT '[]'::jsonb,
  objections JSONB DEFAULT '[]'::jsonb,
  keywords JSONB DEFAULT '[]'::jsonb,
  successful_responses JSONB DEFAULT '[]'::jsonb,
  outcome TEXT, -- showed_up | lost | followup | in_progress
  agent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  message_count INT DEFAULT 0,
  tokens_used INT DEFAULT 0,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_learning_insights_tenant ON public.ai_learning_insights(tenant_id, created_at DESC);
CREATE INDEX idx_ai_learning_insights_lead ON public.ai_learning_insights(lead_id);
CREATE INDEX idx_ai_learning_insights_outcome ON public.ai_learning_insights(tenant_id, outcome);

GRANT SELECT ON public.ai_learning_insights TO authenticated;
GRANT ALL ON public.ai_learning_insights TO service_role;

ALTER TABLE public.ai_learning_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_insights_select_admin_manager_marketing"
ON public.ai_learning_insights FOR SELECT
TO authenticated
USING (
  tenant_id = public.get_current_user_tenant()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin','super_admin','manager','marketing_partner')
  )
);

CREATE POLICY "ai_insights_service_role_all"
ON public.ai_learning_insights FOR ALL
TO service_role
USING (true) WITH CHECK (true);

CREATE TRIGGER trg_ai_learning_insights_updated_at
BEFORE UPDATE ON public.ai_learning_insights
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ ai_knowledge_patterns ============
CREATE TABLE public.ai_knowledge_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  pattern_type TEXT NOT NULL, -- frequent_question | objection | winning_phrase | keyword
  content TEXT NOT NULL,
  occurrences INT NOT NULL DEFAULT 1,
  conversion_rate NUMERIC(5,2),
  related_outcome TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, pattern_type, content)
);

CREATE INDEX idx_ai_knowledge_patterns_tenant_type ON public.ai_knowledge_patterns(tenant_id, pattern_type, occurrences DESC);

GRANT SELECT ON public.ai_knowledge_patterns TO authenticated;
GRANT ALL ON public.ai_knowledge_patterns TO service_role;

ALTER TABLE public.ai_knowledge_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_patterns_select_admin_manager_marketing"
ON public.ai_knowledge_patterns FOR SELECT
TO authenticated
USING (
  tenant_id = public.get_current_user_tenant()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin','super_admin','manager','marketing_partner')
  )
);

CREATE POLICY "ai_patterns_service_role_all"
ON public.ai_knowledge_patterns FOR ALL
TO service_role
USING (true) WITH CHECK (true);

CREATE TRIGGER trg_ai_knowledge_patterns_updated_at
BEFORE UPDATE ON public.ai_knowledge_patterns
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 1. Cadences
CREATE TABLE public.followup_cadences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('lead_silent','post_exam','custom')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  silence_minutes INT NOT NULL DEFAULT 120, -- só usado para trigger_type='lead_silent'
  cold_after_step INT, -- se preenchido, marca lead como 'cold' após esse passo (ordem)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.followup_cadences TO authenticated;
GRANT ALL ON public.followup_cadences TO service_role;
ALTER TABLE public.followup_cadences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cadences_read" ON public.followup_cadences FOR SELECT TO authenticated
USING (tenant_id = public.get_current_user_tenant());
CREATE POLICY "cadences_manage" ON public.followup_cadences FOR ALL TO authenticated
USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id))
WITH CHECK (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE TRIGGER trg_followup_cadences_updated_at
BEFORE UPDATE ON public.followup_cadences
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Cadence steps
CREATE TABLE public.followup_cadence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cadence_id UUID NOT NULL REFERENCES public.followup_cadences(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  position INT NOT NULL,
  offset_minutes INT NOT NULL, -- minutos desde o enrollment
  channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp','call')),
  message_template TEXT NOT NULL,
  label TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cadence_id, position)
);

CREATE INDEX idx_followup_cadence_steps_cadence ON public.followup_cadence_steps(cadence_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.followup_cadence_steps TO authenticated;
GRANT ALL ON public.followup_cadence_steps TO service_role;
ALTER TABLE public.followup_cadence_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cadence_steps_read" ON public.followup_cadence_steps FOR SELECT TO authenticated
USING (tenant_id = public.get_current_user_tenant());
CREATE POLICY "cadence_steps_manage" ON public.followup_cadence_steps FOR ALL TO authenticated
USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id))
WITH CHECK (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE TRIGGER trg_followup_cadence_steps_updated_at
BEFORE UPDATE ON public.followup_cadence_steps
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Leads: engagement_status + cadence link em lead_followups
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS engagement_status TEXT NOT NULL DEFAULT 'active'
  CHECK (engagement_status IN ('active','silent','cold','recovered'));

CREATE INDEX IF NOT EXISTS idx_leads_engagement_status ON public.leads(tenant_id, engagement_status);

ALTER TABLE public.lead_followups
  ADD COLUMN IF NOT EXISTS cadence_step_id UUID REFERENCES public.followup_cadence_steps(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cadence_id UUID REFERENCES public.followup_cadences(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lead_followups_cadence ON public.lead_followups(cadence_id, status);

-- 4. Seed function: cria cadência padrão de "Reengajamento" para cada tenant
CREATE OR REPLACE FUNCTION public.seed_default_reengagement_cadence(_tenant_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cadence_id UUID;
BEGIN
  INSERT INTO public.followup_cadences (tenant_id, name, description, trigger_type, silence_minutes, cold_after_step, enabled)
  VALUES (_tenant_id,
    'Reengajamento de Lead Silencioso',
    'Aciona automaticamente quando um lead abriu conversa e parou de responder.',
    'lead_silent', 120, 4, true)
  ON CONFLICT (tenant_id, name) DO UPDATE SET description = EXCLUDED.description
  RETURNING id INTO v_cadence_id;

  INSERT INTO public.followup_cadence_steps (cadence_id, tenant_id, position, offset_minutes, channel, message_template, label)
  VALUES
    (v_cadence_id, _tenant_id, 1, 120,   'whatsapp',
     'Oi {primeiro_nome}, ainda posso te ajudar com seu exame de vista? 😊',
     'Toque leve (+2h)'),
    (v_cadence_id, _tenant_id, 2, 1440,  'whatsapp',
     'Oi {primeiro_nome}! Passei aqui pra te lembrar: quanto antes você faz o exame, mais rápido resolve aquele desconforto. Posso te encaixar hoje ou amanhã, o que fica melhor?',
     'Autoridade + CTA (+1 dia)'),
    (v_cadence_id, _tenant_id, 3, 4320,  'whatsapp',
     'Oi {primeiro_nome}, é a Lú da Ótica Catelan de novo. Se preferir, posso encerrar seu atendimento por aqui — mas fico à disposição quando quiser marcar. 💙',
     'Última tentativa (+3 dias)'),
    (v_cadence_id, _tenant_id, 4, 10080, 'whatsapp',
     '',
     'Marcar como frio (+7 dias, sem envio)')
  ON CONFLICT (cadence_id, position) DO NOTHING;

  RETURN v_cadence_id;
END;
$$;

-- 5. Trigger: quando novo tenant é criado, gera cadência padrão
CREATE OR REPLACE FUNCTION public.seed_cadences_for_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_default_reengagement_cadence(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_cadences_on_tenant ON public.tenants;
CREATE TRIGGER trg_seed_cadences_on_tenant
AFTER INSERT ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.seed_cadences_for_tenant();

-- 6. Backfill: cria cadência padrão em todos os tenants existentes
DO $$
DECLARE t RECORD;
BEGIN
  FOR t IN SELECT id FROM public.tenants LOOP
    PERFORM public.seed_default_reengagement_cadence(t.id);
  END LOOP;
END $$;

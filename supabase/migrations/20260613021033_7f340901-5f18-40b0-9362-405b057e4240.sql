
-- =====================================================================
-- LEAD REACTIVATION SYSTEM (LTV-focused, history-preserving)
-- =====================================================================
-- Premissa garantida: histórico do lead é INDEPENDENTE do whatsapp_config.
-- Desconectar/banir WhatsApp NÃO apaga leads, conversations, messages,
-- appointments ou qualquer histórico. Confirmado: não existem FKs entre
-- whatsapp_config e tabelas de dados de cliente.
-- =====================================================================

-- 1. Colunas de rastreamento de reativação
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS reactivation_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_contact_at TIMESTAMPTZ;

-- Backfill: first_contact_at = created_at para leads existentes
UPDATE public.leads
   SET first_contact_at = created_at
 WHERE first_contact_at IS NULL;

COMMENT ON COLUMN public.leads.reactivation_count IS
  'Quantas vezes o lead foi reaberto após inatividade (LTV / cliente recorrente).';
COMMENT ON COLUMN public.leads.last_reactivated_at IS
  'Timestamp da última reativação automática.';
COMMENT ON COLUMN public.leads.first_contact_at IS
  'Data do primeiríssimo contato do cliente (preservado para sempre, mesmo após reativações).';

-- 2. Função de reativação: chamada pelo webhook quando chega mensagem
-- de lead em status terminal (lost / showed_up) há mais de 30 dias.
-- PRESERVA todo histórico: pipeline_history, conversations, messages,
-- appointments, consultation_summary continuam intactos.
CREATE OR REPLACE FUNCTION public.reactivate_lead_if_stale(
  _lead_id UUID,
  _stale_days INT DEFAULT 30
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead RECORD;
  v_days_inactive INT;
BEGIN
  SELECT id, tenant_id, status, updated_at, reactivation_count
    INTO v_lead
  FROM public.leads
  WHERE id = _lead_id
  FOR UPDATE;

  IF v_lead.id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Só reativa se estiver em status "terminal" e inativo há X dias
  IF v_lead.status NOT IN ('lost', 'showed_up') THEN
    RETURN FALSE;
  END IF;

  v_days_inactive := EXTRACT(DAY FROM (now() - v_lead.updated_at))::INT;
  IF v_days_inactive < _stale_days THEN
    RETURN FALSE;
  END IF;

  -- Reabre o lead: volta para 'open' (Leads Prontos)
  UPDATE public.leads
     SET status = 'open',
         custom_column_id = NULL,
         reactivation_count = reactivation_count + 1,
         last_reactivated_at = now(),
         closed_at = NULL,
         updated_at = now()
   WHERE id = _lead_id;

  -- Registra no histórico de pipeline (preserva rastro da reativação)
  INSERT INTO public.lead_pipeline_history (
    tenant_id, lead_id, from_status, to_status, changed_by, reason
  ) VALUES (
    v_lead.tenant_id,
    _lead_id,
    v_lead.status::text,
    'open',
    NULL,
    'auto_reactivation: cliente retornou após ' || v_days_inactive || ' dias de inatividade'
  );

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.reactivate_lead_if_stale IS
  'Reabre lead em status terminal (lost/showed_up) quando cliente retorna após N dias. Preserva 100% do histórico. Padrão: 30 dias.';

GRANT EXECUTE ON FUNCTION public.reactivate_lead_if_stale(UUID, INT) TO authenticated, service_role;

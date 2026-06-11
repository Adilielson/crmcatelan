
-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Enum: add negotiating and followup
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'negotiating';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'followup';

-- 3. Leads: closing fields
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS products_sold TEXT,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- 4. lead_followups
CREATE TABLE IF NOT EXISTS public.lead_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  day_offset INT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  template_key TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | sent | failed | skipped | responded
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  response_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_followups_due ON public.lead_followups(scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_lead_followups_lead ON public.lead_followups(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_followups_tenant ON public.lead_followups(tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_followups TO authenticated;
GRANT ALL ON public.lead_followups TO service_role;

ALTER TABLE public.lead_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members read followups"
  ON public.lead_followups FOR SELECT TO authenticated
  USING (tenant_id = public.get_current_user_tenant());

CREATE POLICY "tenant members manage followups"
  ON public.lead_followups FOR ALL TO authenticated
  USING (tenant_id = public.get_current_user_tenant())
  WITH CHECK (tenant_id = public.get_current_user_tenant());

CREATE TRIGGER trg_lead_followups_updated_at
  BEFORE UPDATE ON public.lead_followups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Update seed function for new system columns
CREATE OR REPLACE FUNCTION public.seed_kanban_columns_for_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.kanban_columns (tenant_id, name, color, position, is_system, system_key)
  VALUES
    (NEW.id, 'Leads Prontos',  '#3b82f6', 10, true, 'open'),
    (NEW.id, 'Em Atendimento', '#f59e0b', 20, true, 'in_progress'),
    (NEW.id, 'Agendado',       '#8b5cf6', 30, true, 'scheduled'),
    (NEW.id, 'Check-IN OK',    '#10b981', 40, true, 'checked_in'),
    (NEW.id, 'Em Negociação',  '#06b6d4', 45, true, 'negotiating'),
    (NEW.id, 'Fechado',        '#22c55e', 50, true, 'showed_up'),
    (NEW.id, 'Follow-up',      '#eab308', 55, true, 'followup'),
    (NEW.id, 'Perdido',        '#ef4444', 60, true, 'lost')
  ON CONFLICT (tenant_id, system_key) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- 6. Backfill new columns for existing tenants
INSERT INTO public.kanban_columns (tenant_id, name, color, position, is_system, system_key)
SELECT t.id, 'Em Negociação', '#06b6d4', 45, true, 'negotiating'
FROM public.tenants t
ON CONFLICT (tenant_id, system_key) DO NOTHING;

INSERT INTO public.kanban_columns (tenant_id, name, color, position, is_system, system_key)
SELECT t.id, 'Follow-up', '#eab308', 55, true, 'followup'
FROM public.tenants t
ON CONFLICT (tenant_id, system_key) DO NOTHING;

-- 7. Trigger: when lead enters 'followup', create 8 scheduled touches
CREATE OR REPLACE FUNCTION public.create_followup_schedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  offsets INT[] := ARRAY[1, 3, 7, 15, 30, 60, 120, 180];
  templates TEXT[] := ARRAY[
    'followup_d1','followup_d3','followup_d7','followup_d15',
    'followup_d30','followup_d60','followup_d120','followup_d180'
  ];
  i INT;
BEGIN
  IF NEW.status = 'followup' AND (OLD.status IS DISTINCT FROM 'followup') THEN
    -- clear existing pending touches for this lead to avoid duplicates
    DELETE FROM public.lead_followups WHERE lead_id = NEW.id AND status = 'pending';
    FOR i IN 1..array_length(offsets, 1) LOOP
      INSERT INTO public.lead_followups (tenant_id, lead_id, day_offset, channel, template_key, scheduled_at)
      VALUES (
        NEW.tenant_id, NEW.id, offsets[i],
        CASE WHEN offsets[i] = 15 THEN 'call' ELSE 'whatsapp' END,
        templates[i],
        now() + (offsets[i] || ' days')::interval
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lead_followup_schedule ON public.leads;
CREATE TRIGGER trg_lead_followup_schedule
  AFTER UPDATE OF status ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.create_followup_schedule();

-- 8. Trigger: when lead -> showed_up, auto-checkout latest completed/confirmed appointment
CREATE OR REPLACE FUNCTION public.auto_checkout_on_close()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'showed_up' AND (OLD.status IS DISTINCT FROM 'showed_up') THEN
    NEW.closed_at := now();
    UPDATE public.appointments
    SET checkout_at = now(),
        status = 'completed',
        updated_at = now()
    WHERE lead_id = NEW.id
      AND checkout_at IS NULL
      AND id = (
        SELECT id FROM public.appointments
        WHERE lead_id = NEW.id
        ORDER BY scheduled_at DESC LIMIT 1
      );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lead_auto_checkout ON public.leads;
CREATE TRIGGER trg_lead_auto_checkout
  BEFORE UPDATE OF status ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.auto_checkout_on_close();

-- 9. Trigger: when appointment created, move lead to 'scheduled'
CREATE OR REPLACE FUNCTION public.auto_move_lead_to_scheduled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.lead_id IS NOT NULL THEN
    UPDATE public.leads
    SET status = 'scheduled', custom_column_id = NULL, updated_at = now()
    WHERE id = NEW.lead_id
      AND status IN ('open', 'in_progress');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_appt_move_lead_scheduled ON public.appointments;
CREATE TRIGGER trg_appt_move_lead_scheduled
  AFTER INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.auto_move_lead_to_scheduled();

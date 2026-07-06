
-- 1. Enum de motivos de no-show
DO $$ BEGIN
  CREATE TYPE public.noshow_reason AS ENUM (
    'doente','esqueceu','sem_tempo','desistiu','comprou_fora','nao_respondeu'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Coluna motivo em appointments
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS noshow_reason public.noshow_reason;

-- 3. Contador de etapa da cadência de recuperação em leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS noshow_recovery_step SMALLINT NOT NULL DEFAULT 0;

-- 4. Telefone do usuário (para alertas WhatsApp)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- 5. Nova coluna do Kanban "Recuperação No-Show" para tenants existentes
INSERT INTO public.kanban_columns (tenant_id, name, color, position, is_system, system_key)
SELECT id, 'Recuperação No-Show', '#f97316', 35, true, 'noshow_recovery'
FROM public.tenants
ON CONFLICT (tenant_id, system_key) DO NOTHING;

-- 6. Atualiza seed para novos tenants (recria função)
CREATE OR REPLACE FUNCTION public.seed_kanban_columns_for_tenant()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.kanban_columns (tenant_id, name, color, position, is_system, system_key)
  VALUES
    (NEW.id, 'Leads Prontos',        '#3b82f6', 10, true, 'open'),
    (NEW.id, 'Em Atendimento',       '#f59e0b', 20, true, 'in_progress'),
    (NEW.id, 'Agendado',             '#8b5cf6', 30, true, 'scheduled'),
    (NEW.id, 'Recuperação No-Show',  '#f97316', 35, true, 'noshow_recovery'),
    (NEW.id, 'Check-IN OK',          '#10b981', 40, true, 'checked_in'),
    (NEW.id, 'Em Negociação',        '#06b6d4', 45, true, 'negotiating'),
    (NEW.id, 'Fechado',              '#22c55e', 50, true, 'showed_up'),
    (NEW.id, 'Follow-up',            '#eab308', 55, true, 'followup'),
    (NEW.id, 'Perdido',              '#ef4444', 60, true, 'lost')
  ON CONFLICT (tenant_id, system_key) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- 7. Configurações de alertas de no-show (uma linha por tenant)
CREATE TABLE IF NOT EXISTS public.noshow_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  interval_preset TEXT NOT NULL DEFAULT 'standard', -- 'standard' (15/30/45) | 'light' (30/60)
  notify_attendant_whatsapp BOOLEAN NOT NULL DEFAULT true,
  notify_manager_whatsapp BOOLEAN NOT NULL DEFAULT false,
  manager_phone TEXT,
  daily_summary_enabled BOOLEAN NOT NULL DEFAULT true,
  daily_summary_time TIME NOT NULL DEFAULT '19:00',
  recovery_msg_t0    TEXT NOT NULL DEFAULT 'Oi {nome}, senti sua falta hoje na consulta. Tudo bem contigo?',
  recovery_msg_t48h  TEXT NOT NULL DEFAULT 'Oi {nome}! Consegue vir amanhã ou depois? Tenho 10h e 15h disponíveis.',
  recovery_msg_t7d   TEXT NOT NULL DEFAULT 'Última chance essa semana pra ajustar sua visão. Posso reservar um horário pra você?',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.noshow_settings TO authenticated;
GRANT ALL ON public.noshow_settings TO service_role;
ALTER TABLE public.noshow_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read tenant noshow_settings"
  ON public.noshow_settings FOR SELECT TO authenticated
  USING (tenant_id = public.get_current_user_tenant());

CREATE POLICY "Admins can manage noshow_settings"
  ON public.noshow_settings FOR ALL TO authenticated
  USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE TRIGGER trg_noshow_settings_updated_at
  BEFORE UPDATE ON public.noshow_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed inicial para tenants existentes
INSERT INTO public.noshow_settings (tenant_id)
SELECT id FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- Trigger para criar config automaticamente em novos tenants
CREATE OR REPLACE FUNCTION public.seed_noshow_settings_for_tenant()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.noshow_settings (tenant_id) VALUES (NEW.id)
  ON CONFLICT (tenant_id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_seed_noshow_settings ON public.tenants;
CREATE TRIGGER trg_seed_noshow_settings
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.seed_noshow_settings_for_tenant();

-- 8. Fila de alertas de no-show
CREATE TABLE IF NOT EXISTS public.noshow_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  attendant_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  kind TEXT NOT NULL, -- 't15' | 't30' | 't45' | 'daily_summary' | 'recovery_t0' | 'recovery_t48h' | 'recovery_t7d'
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | sent | skipped | failed
  channel TEXT, -- 'in_app' | 'whatsapp' | 'both'
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_noshow_alerts_pending
  ON public.noshow_alerts (status, scheduled_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_noshow_alerts_appointment
  ON public.noshow_alerts (appointment_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.noshow_alerts TO authenticated;
GRANT ALL ON public.noshow_alerts TO service_role;
ALTER TABLE public.noshow_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read tenant noshow_alerts"
  ON public.noshow_alerts FOR SELECT TO authenticated
  USING (tenant_id = public.get_current_user_tenant());

CREATE POLICY "Admins can manage noshow_alerts"
  ON public.noshow_alerts FOR ALL TO authenticated
  USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE TRIGGER trg_noshow_alerts_updated_at
  BEFORE UPDATE ON public.noshow_alerts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 9. Trigger: quando appointment é criado/reagendado, agenda os alertas de no-show
CREATE OR REPLACE FUNCTION public.schedule_noshow_alerts()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_settings RECORD;
  v_offsets INT[];
  v_kinds   TEXT[];
  v_i INT;
  v_when TIMESTAMPTZ;
BEGIN
  -- terminal: cancela pendentes
  IF NEW.status IN ('cancelled','completed','no_show') THEN
    UPDATE public.noshow_alerts
       SET status = 'skipped',
           error_message = COALESCE(error_message, 'Agendamento ' || NEW.status::text)
     WHERE appointment_id = NEW.id AND status = 'pending';
    RETURN NEW;
  END IF;

  -- check-in feito: cancela pendentes
  IF NEW.checkin_at IS NOT NULL AND (TG_OP = 'UPDATE') AND OLD.checkin_at IS NULL THEN
    UPDATE public.noshow_alerts
       SET status = 'skipped', error_message = 'Check-in realizado'
     WHERE appointment_id = NEW.id AND status = 'pending' AND kind IN ('t15','t30','t45');
    RETURN NEW;
  END IF;

  -- só cria alertas se INSERT ou scheduled_at mudou
  IF NOT (TG_OP = 'INSERT' OR NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_settings FROM public.noshow_settings WHERE tenant_id = NEW.tenant_id;
  IF v_settings.id IS NULL OR NOT v_settings.enabled THEN
    RETURN NEW;
  END IF;

  DELETE FROM public.noshow_alerts
   WHERE appointment_id = NEW.id AND status = 'pending' AND kind IN ('t15','t30','t45');

  IF v_settings.interval_preset = 'light' THEN
    v_offsets := ARRAY[30, 60];
    v_kinds   := ARRAY['t30','t45']; -- reusa slots
  ELSE
    v_offsets := ARRAY[15, 30, 45];
    v_kinds   := ARRAY['t15','t30','t45'];
  END IF;

  FOR v_i IN 1..array_length(v_offsets, 1) LOOP
    v_when := NEW.scheduled_at + (v_offsets[v_i] || ' minutes')::interval;
    IF v_when > now() THEN
      INSERT INTO public.noshow_alerts (
        tenant_id, appointment_id, lead_id, attendant_id, kind, scheduled_at
      ) VALUES (
        NEW.tenant_id, NEW.id, NEW.lead_id,
        COALESCE(NEW.professional_id, (SELECT assigned_user_id FROM public.leads WHERE id = NEW.lead_id)),
        v_kinds[v_i], v_when
      );
    END IF;
  END LOOP;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_schedule_noshow_alerts ON public.appointments;
CREATE TRIGGER trg_schedule_noshow_alerts
  AFTER INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.schedule_noshow_alerts();

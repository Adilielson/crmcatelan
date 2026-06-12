
CREATE TABLE public.appointment_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  lead_id uuid,
  kind text NOT NULL CHECK (kind IN ('confirm_24h','confirm_retry_2h','day_morning','final_1h')),
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','skipped','failed','confirmed')),
  sent_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_appointment_reminders_due ON public.appointment_reminders(status, scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_appointment_reminders_appointment ON public.appointment_reminders(appointment_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_reminders TO authenticated;
GRANT ALL ON public.appointment_reminders TO service_role;

ALTER TABLE public.appointment_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members read appointment reminders"
  ON public.appointment_reminders FOR SELECT TO authenticated
  USING (tenant_id = public.get_current_user_tenant());

CREATE POLICY "tenant members manage appointment reminders"
  ON public.appointment_reminders FOR ALL TO authenticated
  USING (tenant_id = public.get_current_user_tenant())
  WITH CHECK (tenant_id = public.get_current_user_tenant());

-- Trigger: gera/atualiza lembretes a partir do appointment
CREATE OR REPLACE FUNCTION public.schedule_appointment_reminders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_confirm_24h timestamptz;
  v_retry_2h    timestamptz;
  v_day_morning timestamptz;
  v_final_1h    timestamptz;
BEGIN
  -- Status terminal: cancela todos os pendentes
  IF NEW.status IN ('cancelled','completed','no_show') THEN
    UPDATE public.appointment_reminders
       SET status = 'skipped',
           error_message = COALESCE(error_message, 'Agendamento ' || NEW.status::text)
     WHERE appointment_id = NEW.id AND status = 'pending';
    RETURN NEW;
  END IF;

  -- Confirmou: marca lembretes de confirmação ainda pendentes como confirmados
  IF NEW.status = 'confirmed' AND (TG_OP = 'UPDATE') AND (OLD.status IS DISTINCT FROM 'confirmed') THEN
    UPDATE public.appointment_reminders
       SET status = 'confirmed'
     WHERE appointment_id = NEW.id
       AND status = 'pending'
       AND kind IN ('confirm_24h','confirm_retry_2h');
  END IF;

  -- Se INSERT ou scheduled_at mudou, (re)cria os lembretes pendentes
  IF (TG_OP = 'INSERT') OR (NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at) THEN
    DELETE FROM public.appointment_reminders
     WHERE appointment_id = NEW.id AND status = 'pending';

    v_confirm_24h := NEW.scheduled_at - interval '24 hours';
    v_retry_2h    := NEW.scheduled_at - interval '22 hours';
    v_day_morning := NEW.scheduled_at - interval '3 hours';
    v_final_1h    := NEW.scheduled_at - interval '1 hour';

    IF v_confirm_24h > now() AND NEW.status NOT IN ('confirmed','cancelled','completed','no_show') THEN
      INSERT INTO public.appointment_reminders (tenant_id, appointment_id, lead_id, kind, scheduled_at)
      VALUES (NEW.tenant_id, NEW.id, NEW.lead_id, 'confirm_24h', v_confirm_24h);
    END IF;

    IF v_retry_2h > now() AND NEW.status NOT IN ('confirmed','cancelled','completed','no_show') THEN
      INSERT INTO public.appointment_reminders (tenant_id, appointment_id, lead_id, kind, scheduled_at)
      VALUES (NEW.tenant_id, NEW.id, NEW.lead_id, 'confirm_retry_2h', v_retry_2h);
    END IF;

    IF v_day_morning > now() THEN
      INSERT INTO public.appointment_reminders (tenant_id, appointment_id, lead_id, kind, scheduled_at)
      VALUES (NEW.tenant_id, NEW.id, NEW.lead_id, 'day_morning', v_day_morning);
    END IF;

    IF v_final_1h > now() THEN
      INSERT INTO public.appointment_reminders (tenant_id, appointment_id, lead_id, kind, scheduled_at)
      VALUES (NEW.tenant_id, NEW.id, NEW.lead_id, 'final_1h', v_final_1h);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_schedule_appointment_reminders ON public.appointments;
CREATE TRIGGER trg_schedule_appointment_reminders
AFTER INSERT OR UPDATE OF scheduled_at, status ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.schedule_appointment_reminders();

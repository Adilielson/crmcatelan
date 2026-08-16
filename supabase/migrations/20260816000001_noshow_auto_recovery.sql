-- Phase 5: No-Show Auto Recovery
-- Quando appointment.status → 'no_show':
--   1. Move lead para coluna "Recuperação No-Show" no kanban
--   2. Cria alertas de recuperação (recovery_t0, recovery_t48h, recovery_t7d)
-- Também adiciona cron para process-noshow-alerts a cada 5 min.

CREATE OR REPLACE FUNCTION public.schedule_noshow_alerts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_settings RECORD;
  r RECORD;
  v_when TIMESTAMPTZ;
  v_recovery_col_id UUID;
BEGIN
  -- ── Confirmação de no_show ─────────────────────────────────────────────────
  IF NEW.status = 'no_show' AND (TG_OP = 'INSERT' OR (OLD.status IS DISTINCT FROM 'no_show')) THEN
    -- Cancela alertas de presença pendentes
    UPDATE public.noshow_alerts
       SET status = 'skipped', error_message = 'Marcado como no_show'
     WHERE appointment_id = NEW.id
       AND status = 'pending'
       AND kind NOT LIKE 'recovery_%';

    -- Remove recovery alerts pendentes para recriar frescos
    DELETE FROM public.noshow_alerts
     WHERE appointment_id = NEW.id AND kind LIKE 'recovery_%' AND status = 'pending';

    -- Agenda alertas de recuperação a partir de agora
    SELECT * INTO v_settings FROM public.noshow_settings WHERE tenant_id = NEW.tenant_id;
    IF v_settings.id IS NOT NULL AND v_settings.enabled THEN
      FOR r IN
        SELECT step_key, offset_minutes
          FROM public.reminder_templates
         WHERE tenant_id = NEW.tenant_id
           AND kind = 'noshow'
           AND step_key LIKE 'recovery_%'
           AND enabled = true
         ORDER BY position
      LOOP
        v_when := now() + (r.offset_minutes || ' minutes')::interval;
        INSERT INTO public.noshow_alerts (
          tenant_id, appointment_id, lead_id, attendant_id, kind, scheduled_at
        ) VALUES (
          NEW.tenant_id, NEW.id, NEW.lead_id,
          COALESCE(NEW.professional_id, (SELECT assigned_user_id FROM public.leads WHERE id = NEW.lead_id)),
          r.step_key, v_when
        );
      END LOOP;
    END IF;

    -- Move lead para coluna de recuperação no kanban
    IF NEW.lead_id IS NOT NULL THEN
      SELECT id INTO v_recovery_col_id
        FROM public.kanban_columns
       WHERE tenant_id = NEW.tenant_id AND system_key = 'noshow_recovery'
       LIMIT 1;

      IF v_recovery_col_id IS NOT NULL THEN
        UPDATE public.leads
           SET custom_column_id    = v_recovery_col_id,
               noshow_recovery_step = 0,
               status              = 'no_show',
               updated_at          = now()
         WHERE id = NEW.lead_id;
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  -- ── Cancelado ou concluído: cancela alertas pendentes ─────────────────────
  IF NEW.status IN ('cancelled', 'completed') THEN
    UPDATE public.noshow_alerts
       SET status = 'skipped',
           error_message = COALESCE(error_message, 'Agendamento ' || NEW.status::text)
     WHERE appointment_id = NEW.id AND status = 'pending';
    RETURN NEW;
  END IF;

  -- ── Check-in realizado: cancela alertas de presença ───────────────────────
  IF NEW.checkin_at IS NOT NULL AND TG_OP = 'UPDATE' AND OLD.checkin_at IS NULL THEN
    UPDATE public.noshow_alerts
       SET status = 'skipped', error_message = 'Check-in realizado'
     WHERE appointment_id = NEW.id AND status = 'pending' AND kind NOT LIKE 'recovery_%';
    RETURN NEW;
  END IF;

  -- ── Recria alertas de presença apenas em INSERT ou mudança de horário ─────
  IF NOT (TG_OP = 'INSERT' OR NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_settings FROM public.noshow_settings WHERE tenant_id = NEW.tenant_id;
  IF v_settings.id IS NULL OR NOT v_settings.enabled THEN
    RETURN NEW;
  END IF;

  DELETE FROM public.noshow_alerts
   WHERE appointment_id = NEW.id AND status = 'pending' AND kind NOT LIKE 'recovery_%';

  FOR r IN
    SELECT step_key, offset_minutes
      FROM public.reminder_templates
     WHERE tenant_id = NEW.tenant_id
       AND kind = 'noshow'
       AND enabled = true
       AND step_key NOT LIKE 'recovery_%'
     ORDER BY position
  LOOP
    v_when := NEW.scheduled_at + (r.offset_minutes || ' minutes')::interval;
    IF v_when > now() THEN
      INSERT INTO public.noshow_alerts (
        tenant_id, appointment_id, lead_id, attendant_id, kind, scheduled_at
      ) VALUES (
        NEW.tenant_id, NEW.id, NEW.lead_id,
        COALESCE(NEW.professional_id, (SELECT assigned_user_id FROM public.leads WHERE id = NEW.lead_id)),
        r.step_key, v_when
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Recria o trigger (caso não exista)
DROP TRIGGER IF EXISTS trg_schedule_noshow_alerts ON public.appointments;
CREATE TRIGGER trg_schedule_noshow_alerts
  AFTER INSERT OR UPDATE OF status, scheduled_at, checkin_at
  ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.schedule_noshow_alerts();

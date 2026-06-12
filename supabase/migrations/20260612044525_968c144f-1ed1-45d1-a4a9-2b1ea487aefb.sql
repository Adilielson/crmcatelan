
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.notify_stale_leads()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead RECORD;
  v_recipient UUID;
  v_threshold INTERVAL;
  v_status_label TEXT;
  v_waited TEXT;
  v_minutes INT;
BEGIN
  FOR v_lead IN
    SELECT l.id, l.tenant_id, l.full_name, l.status, l.assigned_user_id, l.updated_at,
           EXTRACT(EPOCH FROM (now() - l.updated_at))/60 AS minutes_waiting
    FROM public.leads l
    WHERE l.status IN ('open','in_progress','negotiating')
      AND (
        (l.status = 'open'        AND l.updated_at < now() - interval '1 hour') OR
        (l.status = 'in_progress' AND l.updated_at < now() - interval '4 hours') OR
        (l.status = 'negotiating' AND l.updated_at < now() - interval '4 hours')
      )
  LOOP
    v_minutes := v_lead.minutes_waiting::int;
    IF v_minutes >= 60 THEN
      v_waited := (v_minutes / 60)::text || 'h';
    ELSE
      v_waited := v_minutes::text || 'min';
    END IF;

    v_status_label := CASE v_lead.status
      WHEN 'open' THEN 'aguardando primeiro atendimento'
      WHEN 'in_progress' THEN 'parado em atendimento'
      WHEN 'negotiating' THEN 'parado em negociação'
      ELSE 'aguardando ação'
    END;

    -- Determine recipients: assigned user OR all tenant admins
    FOR v_recipient IN
      SELECT CASE
        WHEN v_lead.assigned_user_id IS NOT NULL THEN v_lead.assigned_user_id
        ELSE p.id
      END
      FROM public.profiles p
      WHERE (v_lead.assigned_user_id IS NOT NULL AND p.id = v_lead.assigned_user_id)
         OR (v_lead.assigned_user_id IS NULL
             AND p.tenant_id = v_lead.tenant_id
             AND p.role IN ('admin','super_admin')
             AND p.status = 'active')
    LOOP
      -- Dedup: skip if a lead_alert was already created for this lead/recipient in the last 24h
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.profile_id = v_recipient
          AND n.category = 'lead_alert'
          AND n.link = '/leads/' || v_lead.id::text
          AND n.created_at > now() - interval '24 hours'
      ) THEN
        INSERT INTO public.notifications (tenant_id, profile_id, title, message, type, category, link)
        VALUES (
          v_lead.tenant_id,
          v_recipient,
          'Lead aguardando atendimento',
          COALESCE(v_lead.full_name, 'Lead sem nome') || ' está ' || v_status_label || ' há ' || v_waited || '.',
          'in_app',
          'lead_alert',
          '/leads/' || v_lead.id::text
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- Re-schedule the cron job (idempotent)
DO $$
BEGIN
  PERFORM cron.unschedule('notify-stale-leads');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'notify-stale-leads',
  '*/15 * * * *',
  $$SELECT public.notify_stale_leads();$$
);

-- Enable realtime so the bell updates in real-time
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
DO $$
BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='notifications';
  IF NOT FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END $$;

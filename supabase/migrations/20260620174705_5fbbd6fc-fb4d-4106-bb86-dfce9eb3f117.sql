
-- =========================================================
-- 1) tenants.timezone
-- =========================================================
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo';

UPDATE public.tenants
   SET timezone = 'America/Cuiaba'
 WHERE id = '00000000-0000-0000-0000-000000000001';

-- =========================================================
-- 2) leads.last_inbound_at / last_outbound_at + backfill
-- =========================================================
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS last_inbound_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_outbound_at TIMESTAMPTZ;

-- Backfill a partir do histórico de mensagens
WITH agg AS (
  SELECT c.lead_id,
         MAX(CASE WHEN m.direction = 'inbound'  THEN m.created_at END) AS last_in,
         MAX(CASE WHEN m.direction = 'outbound' THEN m.created_at END) AS last_out
    FROM public.messages m
    JOIN public.conversations c ON c.id = m.conversation_id
   WHERE c.lead_id IS NOT NULL
   GROUP BY c.lead_id
)
UPDATE public.leads l
   SET last_inbound_at  = agg.last_in,
       last_outbound_at = agg.last_out
  FROM agg
 WHERE l.id = agg.lead_id;

CREATE INDEX IF NOT EXISTS leads_waiting_idx
  ON public.leads (tenant_id, status)
  WHERE status IN ('open','in_progress','negotiating');

-- =========================================================
-- 3) Trigger em messages → atualiza last_inbound/outbound_at no lead
--    (NÃO toca em updated_at para preservar a noção de "movimento")
-- =========================================================
CREATE OR REPLACE FUNCTION public.touch_lead_message_timestamps()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead UUID;
BEGIN
  SELECT lead_id INTO v_lead FROM public.conversations WHERE id = NEW.conversation_id;
  IF v_lead IS NULL THEN RETURN NEW; END IF;

  IF NEW.direction = 'inbound' THEN
    UPDATE public.leads SET last_inbound_at  = COALESCE(NEW.created_at, now()) WHERE id = v_lead;
  ELSIF NEW.direction = 'outbound' THEN
    UPDATE public.leads SET last_outbound_at = COALESCE(NEW.created_at, now()) WHERE id = v_lead;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_lead_message_timestamps ON public.messages;
CREATE TRIGGER trg_touch_lead_message_timestamps
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.touch_lead_message_timestamps();

-- =========================================================
-- 4) Função: minutos dentro do horário comercial entre dois instantes
-- =========================================================
CREATE OR REPLACE FUNCTION public.business_minutes_between(
  _tenant_id UUID,
  _from      TIMESTAMPTZ,
  _to        TIMESTAMPTZ
) RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tz       TEXT;
  v_from_loc TIMESTAMP;
  v_to_loc   TIMESTAMP;
  v_day      DATE;
  v_end_day  DATE;
  v_total    INT := 0;
  v_cfg      RECORD;
  v_open     TIMESTAMP;
  v_close    TIMESTAMP;
  v_lunch_s  TIMESTAMP;
  v_lunch_e  TIMESTAMP;
  v_seg_s    TIMESTAMP;
  v_seg_e    TIMESTAMP;
  v_blocked  BOOLEAN;
BEGIN
  IF _from IS NULL OR _to IS NULL OR _to <= _from THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(timezone, 'America/Sao_Paulo') INTO v_tz FROM public.tenants WHERE id = _tenant_id;
  IF v_tz IS NULL THEN v_tz := 'America/Sao_Paulo'; END IF;

  v_from_loc := (_from AT TIME ZONE v_tz);
  v_to_loc   := (_to   AT TIME ZONE v_tz);

  v_day     := v_from_loc::date;
  v_end_day := v_to_loc::date;

  WHILE v_day <= v_end_day LOOP
    SELECT * INTO v_cfg
      FROM public.agenda_business_hours
     WHERE tenant_id = _tenant_id AND weekday = EXTRACT(DOW FROM v_day)::int;

    IF v_cfg.is_open AND v_cfg.open_time IS NOT NULL AND v_cfg.close_time IS NOT NULL THEN
      -- dia inteiro bloqueado?
      SELECT EXISTS (
        SELECT 1 FROM public.agenda_blocked_dates
         WHERE tenant_id = _tenant_id AND blocked_date = v_day AND all_day = true
      ) INTO v_blocked;

      IF NOT v_blocked THEN
        v_open  := (v_day::text || ' ' || v_cfg.open_time::text)::timestamp;
        v_close := (v_day::text || ' ' || v_cfg.close_time::text)::timestamp;

        -- segmento do dia que se intersecta com [from, to]
        v_seg_s := GREATEST(v_open,  v_from_loc);
        v_seg_e := LEAST   (v_close, v_to_loc);

        IF v_seg_e > v_seg_s THEN
          v_total := v_total + EXTRACT(EPOCH FROM (v_seg_e - v_seg_s))::int / 60;

          -- desconta intervalo de almoço se intersectar o segmento
          IF v_cfg.lunch_start IS NOT NULL AND v_cfg.lunch_end IS NOT NULL THEN
            v_lunch_s := (v_day::text || ' ' || v_cfg.lunch_start::text)::timestamp;
            v_lunch_e := (v_day::text || ' ' || v_cfg.lunch_end::text)::timestamp;
            IF v_lunch_e > v_seg_s AND v_lunch_s < v_seg_e THEN
              v_total := v_total - EXTRACT(EPOCH FROM (LEAST(v_lunch_e, v_seg_e) - GREATEST(v_lunch_s, v_seg_s)))::int / 60;
            END IF;
          END IF;

          -- desconta bloqueios parciais do dia que intersectam o segmento
          v_total := v_total - COALESCE((
            SELECT SUM(
              GREATEST(0, EXTRACT(EPOCH FROM (
                LEAST   ((v_day::text || ' ' || b.block_end::text)::timestamp,   v_seg_e)
              - GREATEST((v_day::text || ' ' || b.block_start::text)::timestamp, v_seg_s)
              ))::int / 60)
            )
            FROM public.agenda_blocked_dates b
            WHERE b.tenant_id = _tenant_id
              AND b.blocked_date = v_day
              AND b.all_day = false
              AND b.block_start IS NOT NULL AND b.block_end IS NOT NULL
          ), 0);
        END IF;
      END IF;
    END IF;

    v_day := v_day + 1;
  END LOOP;

  RETURN GREATEST(v_total, 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.business_minutes_between(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.business_minutes_between(uuid, timestamptz, timestamptz) TO authenticated, service_role;

-- =========================================================
-- 5) notify_stale_leads — usa inbound vs outbound + minutos comerciais
-- =========================================================
CREATE OR REPLACE FUNCTION public.notify_stale_leads()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead       RECORD;
  v_recipient  UUID;
  v_status_lbl TEXT;
  v_waited     TEXT;
  v_minutes    INT;
  v_threshold  INT;
  v_anchor     TIMESTAMPTZ;
BEGIN
  FOR v_lead IN
    SELECT l.id, l.tenant_id, l.full_name, l.status, l.assigned_user_id,
           l.updated_at, l.last_inbound_at, l.last_outbound_at
      FROM public.leads l
     WHERE l.status IN ('open','in_progress','negotiating')
       AND (
         -- aguardando resposta da loja
         (l.last_inbound_at IS NOT NULL
          AND (l.last_outbound_at IS NULL OR l.last_inbound_at > l.last_outbound_at))
         -- OU lead novo sem qualquer conversa ainda
         OR (l.status = 'open' AND l.last_inbound_at IS NULL)
       )
  LOOP
    v_threshold := CASE v_lead.status
                     WHEN 'open' THEN 60
                     WHEN 'in_progress' THEN 240
                     WHEN 'negotiating' THEN 240
                     ELSE 240
                   END;

    v_anchor := COALESCE(v_lead.last_inbound_at, v_lead.updated_at);
    v_minutes := public.business_minutes_between(v_lead.tenant_id, v_anchor, now());

    IF v_minutes < v_threshold THEN
      CONTINUE;
    END IF;

    IF v_minutes >= 60 THEN
      v_waited := (v_minutes / 60)::text || 'h';
    ELSE
      v_waited := v_minutes::text || 'min';
    END IF;

    v_status_lbl := CASE v_lead.status
      WHEN 'open' THEN 'aguardando primeiro atendimento'
      WHEN 'in_progress' THEN 'sem resposta em atendimento'
      WHEN 'negotiating' THEN 'sem resposta em negociação'
      ELSE 'aguardando ação'
    END;

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
          COALESCE(v_lead.full_name, 'Lead sem nome') || ' está ' || v_status_lbl || ' há ' || v_waited || ' (horário comercial).',
          'in_app',
          'lead_alert',
          '/leads/' || v_lead.id::text
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- mantém o REVOKE da revisão de segurança (só service_role/cron)
REVOKE EXECUTE ON FUNCTION public.notify_stale_leads() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.notify_stale_leads() TO service_role;

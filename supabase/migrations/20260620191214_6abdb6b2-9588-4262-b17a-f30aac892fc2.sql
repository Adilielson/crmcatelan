CREATE OR REPLACE FUNCTION public.sync_lead_from_whatsapp_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead RECORD;
  v_phone TEXT;
  v_sent_at TIMESTAMPTZ;
BEGIN
  v_phone := regexp_replace(COALESCE(NEW.recipient_phone, ''), '\D', '', 'g');
  IF v_phone = '' THEN
    RETURN NEW;
  END IF;

  v_sent_at := COALESCE(NEW.sent_at, now());

  SELECT id, status, last_inbound_at, last_outbound_at
    INTO v_lead
  FROM public.leads
  WHERE tenant_id::text = NEW.tenant_id::text
    AND regexp_replace(COALESCE(phone, ''), '\D', '', 'g') = v_phone
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_lead.id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'received' THEN
    UPDATE public.leads
       SET last_inbound_at = GREATEST(COALESCE(last_inbound_at, v_sent_at), v_sent_at)
     WHERE id = v_lead.id;
  ELSIF NEW.status = 'sent' THEN
    UPDATE public.leads
       SET last_outbound_at = GREATEST(COALESCE(last_outbound_at, v_sent_at), v_sent_at),
           status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END,
           custom_column_id = CASE WHEN status = 'open' THEN NULL ELSE custom_column_id END,
           updated_at = CASE WHEN status = 'open' THEN now() ELSE updated_at END
     WHERE id = v_lead.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_lead_from_whatsapp_log ON public.whatsapp_message_logs;
CREATE TRIGGER trg_sync_lead_from_whatsapp_log
AFTER INSERT ON public.whatsapp_message_logs
FOR EACH ROW
EXECUTE FUNCTION public.sync_lead_from_whatsapp_log();

WITH agg AS (
  SELECT
    l.id,
    MAX(w.sent_at) FILTER (WHERE w.status = 'received') AS last_received,
    MAX(w.sent_at) FILTER (WHERE w.status = 'sent') AS last_sent
  FROM public.leads l
  JOIN public.whatsapp_message_logs w
    ON w.tenant_id::text = l.tenant_id::text
   AND regexp_replace(COALESCE(w.recipient_phone, ''), '\D', '', 'g') = regexp_replace(COALESCE(l.phone, ''), '\D', '', 'g')
  GROUP BY l.id
)
UPDATE public.leads l
   SET last_inbound_at = COALESCE(agg.last_received, l.last_inbound_at),
       last_outbound_at = COALESCE(agg.last_sent, l.last_outbound_at),
       status = CASE
         WHEN l.status = 'open' AND agg.last_sent IS NOT NULL THEN 'in_progress'
         ELSE l.status
       END,
       custom_column_id = CASE
         WHEN l.status = 'open' AND agg.last_sent IS NOT NULL THEN NULL
         ELSE l.custom_column_id
       END,
       updated_at = CASE
         WHEN l.status = 'open' AND agg.last_sent IS NOT NULL THEN now()
         ELSE l.updated_at
       END
  FROM agg
 WHERE l.id = agg.id;

REVOKE EXECUTE ON FUNCTION public.sync_lead_from_whatsapp_log() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_lead_from_whatsapp_log() TO service_role;
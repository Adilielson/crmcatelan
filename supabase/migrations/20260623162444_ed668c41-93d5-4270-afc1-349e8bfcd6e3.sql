-- Garante sincronização das timestamps do lead a partir do log de mensagens do WhatsApp.
-- Causa raiz: a função public.sync_lead_from_whatsapp_log() existia, mas nenhum
-- trigger estava anexado à tabela whatsapp_message_logs. Sem o trigger, ao receber
-- mensagens (recebidas ou enviadas pela atendente via celular), os campos
-- leads.last_inbound_at / last_outbound_at não eram atualizados, e o cálculo de
-- SLA / "Parado em Leads Prontos há Xh" ficava incorreto.

DROP TRIGGER IF EXISTS trg_sync_lead_from_whatsapp_log ON public.whatsapp_message_logs;
CREATE TRIGGER trg_sync_lead_from_whatsapp_log
AFTER INSERT ON public.whatsapp_message_logs
FOR EACH ROW
EXECUTE FUNCTION public.sync_lead_from_whatsapp_log();

-- Também garante o trigger das mensagens internas (tabela messages → conversations → leads),
-- usado pelo módulo de chat interno do CRM.
DROP TRIGGER IF EXISTS trg_touch_lead_message_timestamps ON public.messages;
CREATE TRIGGER trg_touch_lead_message_timestamps
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.touch_lead_message_timestamps();

-- Backfill: para todo lead que tem evento "fromMe=true" em webhook_debug_logs sem
-- correspondente em whatsapp_message_logs, atualiza last_outbound_at / status com
-- base no maior timestamp de mensagem enviada pela atendente.
WITH last_outbound AS (
  SELECT
    regexp_replace(split_part(w.payload->'message'->>'chatid', '@', 1), '\D', '', 'g') AS phone,
    max(w.received_at) AS last_sent_at
  FROM public.webhook_debug_logs w
  WHERE w.payload->'message'->>'fromMe' = 'true'
    AND coalesce(w.payload->'message'->>'text','') <> ''
  GROUP BY 1
)
UPDATE public.leads l
SET last_outbound_at = GREATEST(COALESCE(l.last_outbound_at, lo.last_sent_at), lo.last_sent_at),
    status = CASE WHEN l.status = 'open' THEN 'in_progress'::lead_status ELSE l.status END,
    custom_column_id = CASE WHEN l.status = 'open' THEN NULL ELSE l.custom_column_id END,
    updated_at = GREATEST(l.updated_at, lo.last_sent_at)
FROM last_outbound lo
WHERE regexp_replace(coalesce(l.phone,''), '\D', '', 'g') = lo.phone
  AND (l.last_outbound_at IS NULL OR l.last_outbound_at < lo.last_sent_at);
-- Migration definitiva: WhatsApp Config + Logs
-- Segura para re-executar (idempotente)

-- Remove tabelas antigas se existirem
DROP TABLE IF EXISTS whatsapp_message_logs CASCADE;
DROP TABLE IF EXISTS whatsapp_config CASCADE;

-- whatsapp_config: tenant_id como text (sem FK — app usa mock auth 'tenant-1')
CREATE TABLE whatsapp_config (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id      text        NOT NULL,
  instance_token text        NOT NULL,
  is_active      boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_config_tenant_unique UNIQUE (tenant_id)
);

CREATE TABLE whatsapp_message_logs (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       text        NOT NULL,
  recipient_phone text        NOT NULL,
  message_type    text        NOT NULL,
  status          text        NOT NULL,
  error_message   text,
  sent_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON whatsapp_config(tenant_id);
CREATE INDEX ON whatsapp_message_logs(tenant_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION set_updated_at_wac()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_wac_updated_at ON whatsapp_config;
CREATE TRIGGER trg_wac_updated_at
  BEFORE UPDATE ON whatsapp_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_wac();

-- RLS: habilitado com política permissiva
-- (app usa Zustand mock auth, não Supabase Auth real)
ALTER TABLE whatsapp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_message_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp_config_all"        ON whatsapp_config;
DROP POLICY IF EXISTS "whatsapp_config_select"      ON whatsapp_config;
DROP POLICY IF EXISTS "whatsapp_config_insert"      ON whatsapp_config;
DROP POLICY IF EXISTS "whatsapp_config_update"      ON whatsapp_config;
DROP POLICY IF EXISTS "whatsapp_config_delete"      ON whatsapp_config;
DROP POLICY IF EXISTS "whatsapp_logs_all"           ON whatsapp_message_logs;
DROP POLICY IF EXISTS "whatsapp_logs_select"        ON whatsapp_message_logs;
DROP POLICY IF EXISTS "whatsapp_logs_insert"        ON whatsapp_message_logs;

CREATE POLICY "whatsapp_config_all"
  ON whatsapp_config FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "whatsapp_logs_all"
  ON whatsapp_message_logs FOR ALL USING (true) WITH CHECK (true);

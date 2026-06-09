-- Recria tabelas WhatsApp sem FK obrigatória ao tenants
-- e com RLS permissivo (app usa mock auth, não Supabase Auth real ainda)

-- Remove tabelas antigas se existirem
DROP TABLE IF EXISTS whatsapp_message_logs;
DROP TABLE IF EXISTS whatsapp_config;

-- whatsapp_config sem FK ao tenants (evita falha se tenants não existir)
CREATE TABLE IF NOT EXISTS whatsapp_config (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id      text        NOT NULL,
  instance_token text        NOT NULL,
  is_active      boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_config_tenant_id_unique UNIQUE (tenant_id)
);

CREATE TABLE IF NOT EXISTS whatsapp_message_logs (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       text        NOT NULL,
  recipient_phone text        NOT NULL,
  message_type    text        NOT NULL CHECK (message_type IN ('text', 'image', 'document')),
  status          text        NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  error_message   text,
  sent_at         timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_wac_tenant ON whatsapp_config(tenant_id);
CREATE INDEX IF NOT EXISTS idx_waml_tenant ON whatsapp_message_logs(tenant_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_wac_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_wac_updated_at ON whatsapp_config;
CREATE TRIGGER trg_wac_updated_at
  BEFORE UPDATE ON whatsapp_config
  FOR EACH ROW EXECUTE FUNCTION set_wac_updated_at();

-- RLS: habilita mas com política permissiva
-- (quando Supabase Auth for implementado, substituir por políticas por tenant)
ALTER TABLE whatsapp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_message_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp_config_select" ON whatsapp_config;
DROP POLICY IF EXISTS "whatsapp_config_insert" ON whatsapp_config;
DROP POLICY IF EXISTS "whatsapp_config_update" ON whatsapp_config;
DROP POLICY IF EXISTS "whatsapp_config_delete" ON whatsapp_config;
DROP POLICY IF EXISTS "whatsapp_logs_select" ON whatsapp_message_logs;
DROP POLICY IF EXISTS "whatsapp_logs_insert" ON whatsapp_message_logs;

CREATE POLICY "whatsapp_config_all" ON whatsapp_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "whatsapp_logs_all" ON whatsapp_message_logs FOR ALL USING (true) WITH CHECK (true);

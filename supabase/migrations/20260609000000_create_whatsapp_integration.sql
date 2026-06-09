-- WhatsApp Integration Tables
-- Token stored server-side only; never in localStorage or frontend state.

CREATE TABLE IF NOT EXISTS whatsapp_config (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  instance_token text     NOT NULL,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_config_tenant_id_unique UNIQUE (tenant_id)
);

CREATE TABLE IF NOT EXISTS whatsapp_message_logs (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  recipient_phone text        NOT NULL,
  message_type    text        NOT NULL CHECK (message_type IN ('text', 'image', 'document')),
  status          text        NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  error_message   text,
  sent_at         timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_config_tenant_id ON whatsapp_config(tenant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_message_logs_tenant_id ON whatsapp_message_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_message_logs_sent_at ON whatsapp_message_logs(sent_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_whatsapp_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_whatsapp_config_updated_at
  BEFORE UPDATE ON whatsapp_config
  FOR EACH ROW EXECUTE FUNCTION update_whatsapp_config_updated_at();

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE whatsapp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_message_logs ENABLE ROW LEVEL SECURITY;

-- whatsapp_config: membros da organização podem ler sua própria config
CREATE POLICY "whatsapp_config_select"
  ON whatsapp_config FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- whatsapp_config: somente admin/super_admin podem criar/atualizar/excluir
CREATE POLICY "whatsapp_config_insert"
  ON whatsapp_config FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "whatsapp_config_update"
  ON whatsapp_config FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "whatsapp_config_delete"
  ON whatsapp_config FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- whatsapp_message_logs: membros podem ler e inserir logs da sua organização
CREATE POLICY "whatsapp_logs_select"
  ON whatsapp_message_logs FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "whatsapp_logs_insert"
  ON whatsapp_message_logs FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

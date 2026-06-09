-- Adiciona colunas de rastreamento de conexão ao whatsapp_config
-- (necessário para que o webhook atualize o status corretamente)

ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS is_connected       boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS webhook_registered boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS connected_phone    text,
  ADD COLUMN IF NOT EXISTS connected_name     text;

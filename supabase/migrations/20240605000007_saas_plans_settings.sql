-- 1. Plans table to store canonical definitions
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL, -- 'basic', 'pro', 'enterprise'
    display_name TEXT NOT NULL,
    price_monthly DECIMAL(12,2) DEFAULT 0,
    price_yearly DECIMAL(12,2) DEFAULT 0,
    user_limit INTEGER DEFAULT 5,
    lead_limit INTEGER DEFAULT 100,
    ia_token_quota INTEGER DEFAULT 50000,
    features JSONB DEFAULT '[]', -- ['kanban', 'marketing', 'ai_training', 'advanced_reports']
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default plans
INSERT INTO plans (name, display_name, price_monthly, user_limit, lead_limit, ia_token_quota, features)
VALUES 
('basic', 'Plano Basic', 199.00, 2, 100, 20000, '["kanban", "agenda"]'),
('pro', 'Plano Pro', 499.00, 10, 1000, 100000, '["kanban", "agenda", "marketing", "ai_training"]'),
('enterprise', 'Plano Enterprise', 1200.00, 50, 10000, 500000, '["kanban", "agenda", "marketing", "ai_training", "advanced_reports"]');

-- 2. Global Settings (Single row or Key-Value)
CREATE TABLE IF NOT EXISTS global_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO global_settings (key, value, description)
VALUES 
('maintenance_mode', 'false', 'Se verdadeiro, bloqueia acesso de clientes ao CRM'),
('default_ia_model', '"gpt-4o"', 'Modelo padrão da OpenAI para o SDR'),
('system_broadcast', 'null', 'Mensagem exibida para todos os usuários logados');

-- 3. Link tenants to plans more strictly if needed
-- (Assuming we just keep the 'plan' column in tenants for now, referencing plans.name)


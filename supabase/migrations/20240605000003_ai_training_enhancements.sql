-- Add detailed training fields to ai_configs
ALTER TABLE ai_configs 
ADD COLUMN IF NOT EXISTS knowledge_base_faq TEXT,
ADD COLUMN IF NOT EXISTS sample_scripts TEXT,
ADD COLUMN IF NOT EXISTS rejection_instructions TEXT,
ADD COLUMN IF NOT EXISTS response_delay INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS scheduling_link TEXT,
ADD COLUMN IF NOT EXISTS response_restrictions TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS training_mode BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS lead_expiration_limit INTEGER DEFAULT 1440,
ADD COLUMN IF NOT EXISTS qualification_threshold INTEGER DEFAULT 70;

-- Knowledge Documents table
CREATE TABLE IF NOT EXISTS ai_knowledge_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    status TEXT DEFAULT 'processing', -- processing, ready, error
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Config Versioning
CREATE TABLE IF NOT EXISTS ai_config_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ai_config_id UUID REFERENCES ai_configs(id) ON DELETE CASCADE,
    config_snapshot JSONB NOT NULL,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

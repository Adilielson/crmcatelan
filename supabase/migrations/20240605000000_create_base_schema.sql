-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'manager', 'seller', 'marketing_partner');
CREATE TYPE lead_status AS ENUM ('open', 'in_progress', 'scheduled', 'showed_up', 'no_show', 'lost');
CREATE TYPE appointment_status AS ENUM ('pending', 'confirmed', 'completed', 'no_show', 'cancelled');
CREATE TYPE conversation_status AS ENUM ('open', 'waiting_seller', 'finished', 'automated_ia');
CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE marketing_platform AS ENUM ('facebook_ads', 'google_ads', 'tiktok_ads');

-- 1. Tenants (Óticas)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    cnpj TEXT UNIQUE,
    status TEXT DEFAULT 'trial',
    slug TEXT UNIQUE NOT NULL,
    whatsapp_api_token TEXT,
    plan TEXT DEFAULT 'basic',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Units (Lojas)
CREATE TABLE units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    business_hours JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Users Profiles (Extending Auth)
CREATE TABLE profiles (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    full_name TEXT,
    role user_role DEFAULT 'seller',
    status TEXT DEFAULT 'active',
    avatar_url TEXT,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction table for Users <-> Units (A manager can have multiple units)
CREATE TABLE profile_units (
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    PRIMARY KEY (profile_id, unit_id)
);

-- 4. Marketing Sources
CREATE TABLE marketing_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    ad_id TEXT,
    platform marketing_platform,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Leads
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    source_id UUID REFERENCES marketing_sources(id) ON DELETE SET NULL,
    assigned_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    status lead_status DEFAULT 'open',
    sales_value DECIMAL(12,2) DEFAULT 0,
    priority TEXT DEFAULT 'medium',
    next_contact_at TIMESTAMPTZ,
    tags TEXT[] DEFAULT '{}',
    
    -- IA Fields
    score_ia INTEGER CHECK (score_ia >= 0 AND score_ia <= 100),
    ia_summary TEXT,
    ia_sentiment TEXT,
    ia_urgency TEXT,
    ia_profile TEXT,
    ia_disqualified_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Lead Pipeline History
CREATE TABLE lead_pipeline_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    stage_from lead_status,
    stage_to lead_status,
    changed_by UUID REFERENCES profiles(id),
    duration INTERVAL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Conversations
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    status conversation_status DEFAULT 'automated_ia',
    whatsapp_chat_id TEXT,
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Messages
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    direction message_direction NOT NULL,
    content TEXT,
    message_type TEXT DEFAULT 'text',
    media_url TEXT,
    whatsapp_message_id TEXT,
    ia_transcription TEXT,
    tokens_used INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Appointments (Agenda)
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    professional_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    status appointment_status DEFAULT 'pending',
    type_exam TEXT,
    notes TEXT,
    cancellation_reason TEXT,
    checkin_at TIMESTAMPTZ,
    checkout_at TIMESTAMPTZ,
    propensity_score DECIMAL(3,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. AI Configurations
CREATE TABLE ai_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    prompt_system TEXT,
    knowledge_base TEXT,
    qualification_questions JSONB DEFAULT '[]',
    triggers TEXT,
    model_temperature DECIMAL(3,2) DEFAULT 0.7,
    goal TEXT DEFAULT 'appointment',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Marketing Integrations
CREATE TABLE marketing_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    platform marketing_platform NOT NULL,
    pixel_id TEXT,
    api_token TEXT,
    event_mapping JSONB DEFAULT '{}',
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

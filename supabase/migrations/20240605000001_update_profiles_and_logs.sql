-- Add missing fields to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS allowed_modules TEXT[] DEFAULT '{crm, calendar, leads}',
ADD COLUMN IF NOT EXISTS external_crm_id TEXT;

-- Create Activity Logs table
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    metadata JSONB DEFAULT '{}',
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_profile_id ON activity_logs(profile_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_tenant_id ON activity_logs(tenant_id);

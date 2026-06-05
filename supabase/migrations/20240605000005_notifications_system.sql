-- Notification types enum
CREATE TYPE notification_type AS ENUM ('in_app', 'email', 'push');
CREATE TYPE notification_category AS ENUM ('ai_training', 'performance', 'system_error', 'lead_alert');

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type notification_type DEFAULT 'in_app',
    category notification_category NOT NULL,
    read_at TIMESTAMPTZ,
    link TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    category notification_category NOT NULL,
    email_enabled BOOLEAN DEFAULT true,
    push_enabled BOOLEAN DEFAULT true,
    in_app_enabled BOOLEAN DEFAULT true,
    UNIQUE(profile_id, category)
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_notifications_profile_id_read_at ON notifications(profile_id, read_at);

export type UserRole = 'super_admin' | 'admin' | 'manager' | 'seller' | 'marketing_partner';
export type LeadStatus = 'open' | 'in_progress' | 'scheduled' | 'showed_up' | 'no_show' | 'lost';
export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'no_show' | 'cancelled';
export type ConversationStatus = 'open' | 'waiting_seller' | 'finished' | 'automated_ia';
export type MessageDirection = 'inbound' | 'outbound';
export type MarketingPlatform = 'facebook_ads' | 'google_ads' | 'tiktok_ads';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenant_id: string;
}

export interface Tenant {
  id: string;
  name: string;
  cnpj?: string;
  status: string;
  slug: string;
  whatsapp_api_token?: string;
  plan: string;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Unit {
  id: string;
  tenant_id: string;
  name: string;
  address?: string;
  phone?: string;
  business_hours: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  tenant_id: string;
  full_name?: string;
  role: UserRole;
  status: string;
  avatar_url?: string;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  tenant_id: string;
  unit_id?: string;
  source_id?: string;
  assigned_user_id?: string;
  full_name: string;
  email?: string;
  phone?: string;
  status: LeadStatus;
  sales_value: number;
  priority: string;
  next_contact_at?: string;
  tags: string[];
  score_ia?: number;
  ia_summary?: string;
  ia_sentiment?: string;
  ia_urgency?: string;
  ia_profile?: string;
  ia_disqualified_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  tenant_id: string;
  lead_id: string;
  unit_id?: string;
  professional_id?: string;
  scheduled_at: string;
  status: AppointmentStatus;
  type_exam?: string;
  notes?: string;
  cancellation_reason?: string;
  checkin_at?: string;
  checkout_at?: string;
  propensity_score?: number;
  created_at: string;
  updated_at: string;
}

export interface AIConfig {
  id: string;
  tenant_id: string;
  prompt_system?: string;
  knowledge_base?: string;
  qualification_questions: any[];
  triggers?: string;
  model_temperature: number;
  goal: string;
  created_at: string;
  updated_at: string;
}

export interface MarketingIntegration {
  id: string;
  tenant_id: string;
  platform: MarketingPlatform;
  pixel_id?: string;
  api_token?: string;
  event_mapping: Record<string, any>;
  status: string;
  created_at: string;
  updated_at: string;
}


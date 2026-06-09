export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string
          name: string
          cnpj: string | null
          status: string
          slug: string
          whatsapp_api_token: string | null
          plan: string
          settings: Json
          contato_responsavel: string | null
          limite_usuarios: number | null
          ia_token_quota: number | null
          ia_token_used: number | null
          storage_used_bytes: number | null
          storage_limit_bytes: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          cnpj?: string | null
          status?: string
          slug: string
          whatsapp_api_token?: string | null
          plan?: string
          settings?: Json
          contato_responsavel?: string | null
          limite_usuarios?: number | null
          ia_token_quota?: number | null
          ia_token_used?: number | null
          storage_used_bytes?: number | null
          storage_limit_bytes?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          cnpj?: string | null
          status?: string
          slug?: string
          whatsapp_api_token?: string | null
          plan?: string
          settings?: Json
          contato_responsavel?: string | null
          limite_usuarios?: number | null
          ia_token_quota?: number | null
          ia_token_used?: number | null
          storage_used_bytes?: number | null
          storage_limit_bytes?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          tenant_id: string
          full_name: string | null
          role: 'super_admin' | 'admin' | 'manager' | 'seller' | 'marketing_partner'
          status: string
          avatar_url: string | null
          last_login_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          tenant_id: string
          full_name?: string | null
          role?: 'super_admin' | 'admin' | 'manager' | 'seller' | 'marketing_partner'
          status?: string
          avatar_url?: string | null
          last_login_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          full_name?: string | null
          role?: 'super_admin' | 'admin' | 'manager' | 'seller' | 'marketing_partner'
          status?: string
          avatar_url?: string | null
          last_login_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      whatsapp_config: {
        Row: {
          id: string
          tenant_id: string
          instance_token: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          instance_token: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          instance_token?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      whatsapp_message_logs: {
        Row: {
          id: string
          tenant_id: string
          recipient_phone: string
          message_type: 'text' | 'image' | 'document'
          status: 'sent' | 'failed' | 'pending'
          error_message: string | null
          sent_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          recipient_phone: string
          message_type: 'text' | 'image' | 'document'
          status: 'sent' | 'failed' | 'pending'
          error_message?: string | null
          sent_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          recipient_phone?: string
          message_type?: 'text' | 'image' | 'document'
          status?: 'sent' | 'failed' | 'pending'
          error_message?: string | null
          sent_at?: string
        }
      }
      leads: {
        Row: {
          id: string
          tenant_id: string
          unit_id: string | null
          source_id: string | null
          assigned_user_id: string | null
          full_name: string
          email: string | null
          phone: string | null
          status: 'open' | 'in_progress' | 'scheduled' | 'showed_up' | 'no_show' | 'lost'
          sales_value: number
          priority: string
          next_contact_at: string | null
          tags: string[]
          score_ia: number | null
          ia_summary: string | null
          ia_sentiment: string | null
          ia_urgency: string | null
          ia_profile: string | null
          ia_disqualified_reason: string | null
          utm_source: string | null
          utm_medium: string | null
          utm_campaign: string | null
          ad_id: string | null
          conversion_event: string | null
          conversion_value: number | null
          attribution_date: string | null
          external_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          unit_id?: string | null
          source_id?: string | null
          assigned_user_id?: string | null
          full_name: string
          email?: string | null
          phone?: string | null
          status?: 'open' | 'in_progress' | 'scheduled' | 'showed_up' | 'no_show' | 'lost'
          sales_value?: number
          priority?: string
          next_contact_at?: string | null
          tags?: string[]
          score_ia?: number | null
          ia_summary?: string | null
          ia_sentiment?: string | null
          ia_urgency?: string | null
          ia_profile?: string | null
          ia_disqualified_reason?: string | null
          utm_source?: string | null
          utm_medium?: string | null
          utm_campaign?: string | null
          ad_id?: string | null
          conversion_event?: string | null
          conversion_value?: number | null
          attribution_date?: string | null
          external_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          unit_id?: string | null
          source_id?: string | null
          assigned_user_id?: string | null
          full_name?: string
          email?: string | null
          phone?: string | null
          status?: 'open' | 'in_progress' | 'scheduled' | 'showed_up' | 'no_show' | 'lost'
          sales_value?: number
          priority?: string
          next_contact_at?: string | null
          tags?: string[]
          score_ia?: number | null
          ia_summary?: string | null
          ia_sentiment?: string | null
          ia_urgency?: string | null
          ia_profile?: string | null
          ia_disqualified_reason?: string | null
          utm_source?: string | null
          utm_medium?: string | null
          utm_campaign?: string | null
          ad_id?: string | null
          conversion_event?: string | null
          conversion_value?: number | null
          attribution_date?: string | null
          external_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

// Keep the legacy types for compatibility with existing code
export type UserRole = 'super_admin' | 'admin' | 'manager' | 'seller' | 'marketing_partner';
export type LeadStatus = 'open' | 'in_progress' | 'scheduled' | 'showed_up' | 'no_show' | 'lost';
export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'no_show' | 'cancelled';

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
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  ad_id?: string;
  conversion_event?: string;
  conversion_value?: number;
  attribution_date?: string;
  external_id?: string;
  created_at: string;
  updated_at: string;
}



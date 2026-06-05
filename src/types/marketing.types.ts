import { Tenant } from './database.types';

export interface MarketingSource {
  id: string;
  name: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  ad_id?: string;
  tenant_id: string;
}

export interface MarketingIntegration {
  id: string;
  platform: 'facebook_ads' | 'google_ads' | 'tiktok_ads';
  pixel_id?: string;
  access_token?: string;
  status: 'active' | 'inactive' | 'error';
  tenant_id: string;
}

export interface Plan {
  id: string;
  name: string;
  max_users: number;
  max_leads_per_month: number;
  ai_tokens_limit: number;
  price: number;
}

export interface TenantSettings extends Tenant {
  subscription_status: 'trial' | 'active' | 'past_due' | 'canceled';
  plan_id: string;
  ai_tokens_used: number;
  whatsapp_status: 'connected' | 'disconnected' | 'error';
}

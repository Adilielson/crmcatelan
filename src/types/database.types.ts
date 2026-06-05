export type UserRole = 'super_admin' | 'admin' | 'manager' | 'agent' | 'marketing';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenant_id: string;
  avatar_url?: string;
}

export type LeadStatus = 'open' | 'in_progress' | 'scheduled' | 'showed' | 'no_show' | 'lost';

export interface Lead {
  id: string;
  name: string;
  phone: string;
  status: LeadStatus;
  estimated_value?: number;
  marketing_source_id?: string;
  next_contact_at?: string;
  ai_score?: number; // 0-100
  assigned_to?: string; // User ID
  tenant_id: string;
  created_at: string;
}

export interface Appointment {
  id: string;
  lead_id: string;
  start_time: string;
  end_time: string;
  status: 'pending' | 'confirmed' | 'completed' | 'no_show' | 'cancelled';
  type?: string;
  notes?: string;
  tenant_id: string;
}

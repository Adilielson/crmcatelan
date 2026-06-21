import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type LeadEventType =
  | 'stage_change'
  | 'assignment_change'
  | 'appointment_created'
  | 'appointment_rescheduled'
  | 'appointment_confirmed'
  | 'appointment_cancelled'
  | 'appointment_completed'
  | 'appointment_no_show'
  | 'appointment_checkin'
  | 'appointment_checkout'
  | 'purchase'
  | 'lead_created';

export interface LeadEvent {
  id: string;
  lead_id: string | null;
  event_type: LeadEventType;
  stage_from: string | null;
  stage_to: string | null;
  changed_by: string | null;
  duration: string | null;
  reason: string | null;
  metadata: Record<string, any> | null;
  created_at: string | null;
}

export function useLeadHistory(leadId: string | null | undefined) {
  return useQuery({
    queryKey: ['lead-history', leadId],
    enabled: !!leadId,
    queryFn: async (): Promise<LeadEvent[]> => {
      const { data, error } = await (supabase as any)
        .from('lead_pipeline_history')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as LeadEvent[];
    },
  });
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LeadPipelineHistoryRow {
  id: string;
  lead_id: string | null;
  stage_from: string | null;
  stage_to: string | null;
  duration: string | null;
  changed_by: string | null;
  created_at: string | null;
}

export function useLeadHistory(leadId: string | null | undefined) {
  return useQuery({
    queryKey: ['lead-history', leadId],
    enabled: !!leadId,
    queryFn: async (): Promise<LeadPipelineHistoryRow[]> => {
      const { data, error } = await (supabase as any)
        .from('lead_pipeline_history')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as LeadPipelineHistoryRow[];
    },
  });
}

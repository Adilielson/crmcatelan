import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/hooks/use-auth';

export interface FollowupRow {
  id: string;
  tenant_id: string;
  lead_id: string;
  day_offset: number;
  channel: 'whatsapp' | 'call' | string;
  template_key: string;
  scheduled_at: string;
  status: 'pending' | 'sent' | 'failed' | 'skipped' | 'responded' | string;
  sent_at: string | null;
  error_message: string | null;
  response_at: string | null;
}

export function useTodayFollowups() {
  const tenantId = useAuthStore((s) => s.tenant?.id ?? null);
  return useQuery({
    queryKey: ['lead_followups', 'today', tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<FollowupRow[]> => {
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const { data, error } = await (supabase as any)
        .from('lead_followups')
        .select('*')
        .eq('tenant_id', tenantId!)
        .eq('status', 'pending')
        .lte('scheduled_at', end.toISOString())
        .order('scheduled_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as FollowupRow[];
    },
    refetchInterval: 60_000,
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/hooks/use-auth';
import { toast } from 'sonner';

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

/**
 * Marca um follow-up como respondido e move o lead para "Em Negociação".
 * Reutilizável: a IA poderá chamar a mesma função automaticamente no futuro
 * quando detectar uma resposta do lead, sem refatorar.
 */
export function useRespondToFollowup() {
  const qc = useQueryClient();
  const tenantId = useAuthStore((s) => s.tenant?.id ?? null);
  return useMutation({
    mutationFn: async (payload: { followupId: string; leadId: string }) => {
      // 1) Atualiza o follow-up
      const { error: fErr } = await (supabase as any)
        .from('lead_followups')
        .update({
          status: 'responded',
          response_at: new Date().toISOString(),
        })
        .eq('id', payload.followupId);
      if (fErr) throw fErr;

      // 2) Move o lead para "Em Negociação"
      const { error: lErr } = await (supabase as any)
        .from('leads')
        .update({
          status: 'negotiating',
          custom_column_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payload.leadId);
      if (lErr) throw lErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead_followups', 'today', tenantId] });
      qc.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead movido para Em Negociação');
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao marcar como respondido'),
  });
}

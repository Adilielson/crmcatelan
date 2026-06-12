import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/hooks/use-auth';

export type ReminderKind = 'confirm_24h' | 'confirm_retry_2h' | 'day_morning' | 'final_1h';
export type ReminderStatus = 'pending' | 'sent' | 'skipped' | 'failed' | 'confirmed';

export interface LeadReminder {
  id: string;
  lead_id: string | null;
  appointment_id: string;
  kind: ReminderKind;
  status: ReminderStatus;
  scheduled_at: string;
  sent_at: string | null;
  error_message: string | null;
}

export const REMINDER_LABEL: Record<ReminderKind, string> = {
  confirm_24h: 'Confirmação (24h antes)',
  confirm_retry_2h: 'Reenvio de confirmação',
  day_morning: 'Lembrete do dia',
  final_1h: 'Lembrete final (1h antes)',
};

export const REMINDER_STATUS_LABEL: Record<ReminderStatus, string> = {
  pending: 'Pendente',
  sent: 'Enviado',
  confirmed: 'Confirmado pelo lead',
  failed: 'Falhou',
  skipped: 'Cancelado',
};

export function useLeadReminders() {
  const tenantId = useAuthStore((s) => s.tenant?.id ?? null);
  return useQuery({
    queryKey: ['lead-reminders', tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<Map<string, LeadReminder[]>> => {
      const { data, error } = await (supabase as any)
        .from('appointment_reminders')
        .select('id, lead_id, appointment_id, kind, status, scheduled_at, sent_at, error_message')
        .eq('tenant_id', tenantId!)
        .order('scheduled_at', { ascending: true });
      if (error) throw error;
      const map = new Map<string, LeadReminder[]>();
      for (const r of (data ?? []) as LeadReminder[]) {
        if (!r.lead_id) continue;
        const list = map.get(r.lead_id) ?? [];
        list.push(r);
        map.set(r.lead_id, list);
      }
      return map;
    },
    staleTime: 30_000,
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/hooks/use-auth';
import { toast } from 'sonner';

export interface NoShowSettings {
  id: string;
  tenant_id: string;
  enabled: boolean;
  interval_preset: 'standard' | 'light';
  notify_attendant_whatsapp: boolean;
  notify_manager_whatsapp: boolean;
  manager_phone: string | null;
  daily_summary_enabled: boolean;
  daily_summary_time: string; // HH:MM:SS
  recovery_msg_t0: string;
  recovery_msg_t48h: string;
  recovery_msg_t7d: string;
}

function useTenantId() {
  return useAuthStore((s) => s.tenant?.id ?? null);
}

export function useNoShowSettings() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ['noshow_settings', tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<NoShowSettings | null> => {
      const { data, error } = await (supabase as any)
        .from('noshow_settings')
        .select('*')
        .eq('tenant_id', tenantId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as NoShowSettings | null;
    },
  });
}

export function useUpdateNoShowSettings() {
  const qc = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: async (patch: Partial<NoShowSettings>) => {
      if (!tenantId) throw new Error('Tenant não identificado');
      const { error } = await (supabase as any)
        .from('noshow_settings')
        .upsert({ tenant_id: tenantId, ...patch }, { onConflict: 'tenant_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['noshow_settings', tenantId] });
      toast.success('Configurações salvas');
    },
    onError: (e: any) => toast.error(`Erro ao salvar: ${e.message}`),
  });
}

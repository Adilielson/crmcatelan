import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { updateTenantTimezone } from '@/lib/business-hours.functions';

export const BR_TIMEZONES: { value: string; label: string }[] = [
  { value: 'America/Sao_Paulo', label: 'Brasília — São Paulo, Rio, MG, Sul, Centro-Oeste (UTC−3)' },
  { value: 'America/Cuiaba', label: 'Mato Grosso — Cuiabá (UTC−4)' },
  { value: 'America/Campo_Grande', label: 'Mato Grosso do Sul — Campo Grande (UTC−4)' },
  { value: 'America/Manaus', label: 'Amazonas / Rondônia / Roraima — Manaus (UTC−4)' },
  { value: 'America/Belem', label: 'Pará (leste) / AP / MA / TO — Belém (UTC−3)' },
  { value: 'America/Fortaleza', label: 'Nordeste — Fortaleza, Recife, Salvador (UTC−3)' },
  { value: 'America/Rio_Branco', label: 'Acre — Rio Branco (UTC−5)' },
  { value: 'America/Noronha', label: 'Fernando de Noronha (UTC−2)' },
];

export function useTenantTimezone() {
  const tenantId = useAuthStore((s) => s.tenant?.id ?? null);
  return useQuery({
    queryKey: ['tenant_timezone', tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<string> => {
      const { data, error } = await (supabase as any)
        .from('tenants')
        .select('timezone')
        .eq('id', tenantId!)
        .maybeSingle();
      if (error) throw error;
      return (data?.timezone as string | undefined) ?? 'America/Sao_Paulo';
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateTenantTimezone() {
  const qc = useQueryClient();
  const tenantId = useAuthStore((s) => s.tenant?.id ?? null);
  const updateFn = useServerFn(updateTenantTimezone);
  return useMutation({
    mutationFn: async (timezone: string) => {
      if (!tenantId) throw new Error('Tenant não identificado');
      // RLS on `tenants` only allows super_admin to UPDATE; go through a
      // server function that authorizes admin/manager and uses the admin client.
      await updateFn({ data: { timezone } });
    },
    onSuccess: (_data, timezone) => {
      qc.setQueryData(['tenant_timezone', tenantId], timezone);
      qc.invalidateQueries({ queryKey: ['tenant_timezone', tenantId] });
      toast.success('Fuso horário atualizado');
    },
    onError: (e: any) => toast.error(`Erro: ${e.message ?? e}`),
  });
}

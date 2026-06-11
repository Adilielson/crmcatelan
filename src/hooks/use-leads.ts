import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/hooks/use-auth';
import { toast } from 'sonner';

export type LeadStage = 'open' | 'in_progress' | 'scheduled' | 'checked_in' | 'negotiating' | 'showed_up' | 'followup' | 'no_show' | 'lost';

export const STAGES: { value: LeadStage; label: string }[] = [
  { value: 'open', label: 'Leads Prontos' },
  { value: 'in_progress', label: 'Em Atendimento' },
  { value: 'scheduled', label: 'Agendado' },
  { value: 'checked_in', label: 'Check-IN OK' },
  { value: 'negotiating', label: 'Em Negociação' },
  { value: 'showed_up', label: 'Fechado' },
  { value: 'followup', label: 'Follow-up' },
  { value: 'lost', label: 'Perdido' },
];

export const stageLabel = (s: string) =>
  STAGES.find((x) => x.value === s)?.label ?? s;

export interface DBLead {
  id: string;
  tenant_id: string;
  unit_id: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  status: LeadStage;
  sales_value: number | null;
  source: string | null;
  notes: string | null;
  score_ia: number | null;
  ia_summary: string | null;
  assigned_user_id: string | null;
  custom_column_id: string | null;
  payment_method: string | null;
  products_sold: string | null;
  closed_at: string | null;
  ia_sentimento: string | null;
  ia_urgencia: string | null;
  ia_interesses: string[] | null;
  ia_tags: string[] | null;
  ia_receita_grau: string | null;
  ia_receita_validade: string | null;
  created_at: string;
  updated_at: string;
}

function useTenantId() {
  return useAuthStore((s) => s.tenant?.id ?? null);
}

export function useLeads() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ['leads', tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<DBLead[]> => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DBLead[];
    },
  });
}

export function useCreateLead() {
  const qc = useQueryClient();
  const tenantId = useTenantId();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  return useMutation({
    mutationFn: async (payload: {
      full_name: string;
      phone?: string;
      email?: string;
      sales_value?: number;
      source?: string;
      notes?: string;
      status?: LeadStage;
    }) => {
      if (!tenantId) throw new Error('Tenant não identificado');
      const { data, error } = await (supabase as any)
        .from('leads')
        .insert({
          tenant_id: tenantId,
          status: payload.status ?? 'open',
          assigned_user_id: userId,
          ...payload,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads', tenantId] });
      toast.success('Lead criado com sucesso');
    },
    onError: (e: any) => toast.error(`Erro ao criar lead: ${e.message}`),
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  const tenantId = useTenantId();
  const key = ['leads', tenantId] as const;
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const { data, error } = await (supabase as any)
        .from('leads')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, updates }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<DBLead[]>(key);
      qc.setQueryData<DBLead[]>(key, (old) =>
        (old ?? []).map((l) => (l.id === id ? ({ ...l, ...updates } as DBLead) : l)),
      );
      return { previous };
    },
    onError: (e: any, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
      toast.error(`Erro ao atualizar: ${e.message}`);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('leads').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads', tenantId] });
      toast.success('Lead excluído');
    },
    onError: (e: any) => toast.error(`Erro ao excluir: ${e.message}`),
  });
}

export interface UnitRow { id: string; name: string; address: string | null }

export function useUnits() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ['units', tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<UnitRow[]> => {
      const { data, error } = await supabase
        .from('units')
        .select('id, name, address')
        .eq('tenant_id', tenantId!);
      if (error) throw error;
      return (data ?? []) as unknown as UnitRow[];
    },
  });
}

export function useSeedSampleLeads() {
  const qc = useQueryClient();
  const tenantId = useTenantId();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  return useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('Tenant não identificado');
      const samples = [
        { full_name: 'Carlos Pereira', phone: '5527999990010', email: 'carlos@example.com', sales_value: 1800, source: 'google', status: 'open' as const },
        { full_name: 'Ana Beatriz', phone: '5527999990011', email: 'ana@example.com', sales_value: 3200, source: 'whatsapp', status: 'in_progress' as const },
        { full_name: 'Roberto Lima', phone: '5527999990012', email: 'roberto@example.com', sales_value: 950, source: 'direct', status: 'open' as const },
      ];
      const { error } = await (supabase as any)
        .from('leads')
        .insert(samples.map((s) => ({ ...s, tenant_id: tenantId, assigned_user_id: userId })));
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads', tenantId] });
      toast.success('3 leads de exemplo importados');
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });
}

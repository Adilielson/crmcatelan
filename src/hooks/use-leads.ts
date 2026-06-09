import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DEV_TENANT_ID } from '@/hooks/use-auth';
import { toast } from 'sonner';

export type LeadStage = 'open' | 'in_progress' | 'scheduled' | 'showed_up' | 'no_show' | 'lost';

export const STAGES: { value: LeadStage; label: string }[] = [
  { value: 'open', label: 'Leads Prontos' },
  { value: 'in_progress', label: 'Em Atendimento' },
  { value: 'scheduled', label: 'Agendado' },
  { value: 'lost', label: 'Perdido' },
  { value: 'showed_up', label: 'Fechado' },
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
  created_at: string;
  updated_at: string;
}

const LEADS_KEY = ['leads', DEV_TENANT_ID] as const;

export function useLeads() {
  return useQuery({
    queryKey: LEADS_KEY,
    queryFn: async (): Promise<DBLead[]> => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('tenant_id', DEV_TENANT_ID)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DBLead[];
    },
  });
}

export function useCreateLead() {
  const qc = useQueryClient();
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
      const { data, error } = await supabase
        .from('leads')
        .insert({
          tenant_id: DEV_TENANT_ID,
          status: payload.status ?? 'open',
          ...payload,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LEADS_KEY });
      toast.success('Lead criado com sucesso');
    },
    onError: (e: any) => toast.error(`Erro ao criar lead: ${e.message}`),
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<DBLead> }) => {
      const { data, error } = await supabase
        .from('leads')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, updates }) => {
      await qc.cancelQueries({ queryKey: LEADS_KEY });
      const previous = qc.getQueryData<DBLead[]>(LEADS_KEY);
      qc.setQueryData<DBLead[]>(LEADS_KEY, (old) =>
        (old ?? []).map((l) => (l.id === id ? { ...l, ...updates } : l)),
      );
      return { previous };
    },
    onError: (e: any, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(LEADS_KEY, ctx.previous);
      toast.error(`Erro ao atualizar: ${e.message}`);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: LEADS_KEY }),
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('leads').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LEADS_KEY });
      toast.success('Lead excluído');
    },
    onError: (e: any) => toast.error(`Erro ao excluir: ${e.message}`),
  });
}

export function useUnits() {
  return useQuery({
    queryKey: ['units', DEV_TENANT_ID],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('units')
        .select('id, name, address')
        .eq('tenant_id', DEV_TENANT_ID);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSeedSampleLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const samples = [
        { full_name: 'Carlos Pereira', phone: '5527999990010', email: 'carlos@example.com', sales_value: 1800, source: 'google', status: 'open' as const },
        { full_name: 'Ana Beatriz', phone: '5527999990011', email: 'ana@example.com', sales_value: 3200, source: 'whatsapp', status: 'in_progress' as const },
        { full_name: 'Roberto Lima', phone: '5527999990012', email: 'roberto@example.com', sales_value: 950, source: 'direct', status: 'open' as const },
      ];
      const { error } = await supabase
        .from('leads')
        .insert(samples.map((s) => ({ ...s, tenant_id: DEV_TENANT_ID })) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LEADS_KEY });
      toast.success('3 leads de exemplo importados');
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });
}

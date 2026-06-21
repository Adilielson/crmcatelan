import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/hooks/use-auth';
import { toast } from 'sonner';

export interface KanbanColumn {
  id: string;
  tenant_id: string;
  name: string;
  color: string;
  position: number;
  sla_days: number;
  is_system: boolean;
  system_key: string | null;
  created_at: string;
  updated_at: string;
}

export function useKanbanColumns() {
  const tenantId = useAuthStore((s) => s.tenant?.id ?? null);
  return useQuery({
    queryKey: ['kanban_columns', tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<KanbanColumn[]> => {
      const { data, error } = await (supabase as any)
        .from('kanban_columns')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('position', { ascending: true });
      if (error) throw error;
      return (data ?? []) as KanbanColumn[];
    },
  });
}

export function useCreateKanbanColumn() {
  const qc = useQueryClient();
  const tenantId = useAuthStore((s) => s.tenant?.id ?? null);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  return useMutation({
    mutationFn: async (payload: { name: string; color: string; position: number }) => {
      if (!tenantId) throw new Error('Tenant não identificado');
      const { data, error } = await (supabase as any)
        .from('kanban_columns')
        .insert({
          tenant_id: tenantId,
          name: payload.name,
          color: payload.color,
          position: payload.position,
          is_system: false,
          created_by: userId,
        })
        .select()
        .single();
      if (error) throw error;
      return data as KanbanColumn;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kanban_columns', tenantId] });
      toast.success('Coluna criada');
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao criar coluna'),
  });
}

export function useUpdateKanbanColumn() {
  const qc = useQueryClient();
  const tenantId = useAuthStore((s) => s.tenant?.id ?? null);
  return useMutation({
    mutationFn: async (payload: { id: string; updates: Partial<Pick<KanbanColumn, 'name' | 'color' | 'position' | 'sla_days'>> }) => {
      const { error } = await (supabase as any)
        .from('kanban_columns')
        .update(payload.updates)
        .eq('id', payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kanban_columns', tenantId] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao atualizar coluna'),
  });
}

export function useDeleteKanbanColumn() {
  const qc = useQueryClient();
  const tenantId = useAuthStore((s) => s.tenant?.id ?? null);
  return useMutation({
    mutationFn: async (id: string) => {
      // First, move leads in this column back to 'open' status
      await (supabase as any)
        .from('leads')
        .update({ custom_column_id: null, status: 'open' })
        .eq('custom_column_id', id);

      const { error } = await (supabase as any)
        .from('kanban_columns')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kanban_columns', tenantId] });
      qc.invalidateQueries({ queryKey: ['leads', tenantId] });
      toast.success('Coluna removida');
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao remover coluna'),
  });
}

export function useReorderKanbanColumns() {
  const qc = useQueryClient();
  const tenantId = useAuthStore((s) => s.tenant?.id ?? null);
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      // Assign positions in multiples of 10 to keep room for future inserts
      const updates = orderedIds.map((id, idx) =>
        (supabase as any)
          .from('kanban_columns')
          .update({ position: (idx + 1) * 10 })
          .eq('id', id),
      );
      const results = await Promise.all(updates);
      const err = results.find((r: any) => r.error);
      if (err?.error) throw err.error;
    },
    onMutate: async (orderedIds: string[]) => {
      await qc.cancelQueries({ queryKey: ['kanban_columns', tenantId] });
      const prev = qc.getQueryData<KanbanColumn[]>(['kanban_columns', tenantId]);
      if (prev) {
        const byId = new Map(prev.map((c) => [c.id, c] as const));
        const next = orderedIds
          .map((id, idx) => {
            const c = byId.get(id);
            return c ? { ...c, position: (idx + 1) * 10 } : null;
          })
          .filter(Boolean) as KanbanColumn[];
        qc.setQueryData(['kanban_columns', tenantId], next);
      }
      return { prev };
    },
    onError: (e: any, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['kanban_columns', tenantId], ctx.prev);
      toast.error(e.message ?? 'Erro ao reordenar colunas');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['kanban_columns', tenantId] });
    },
  });
}

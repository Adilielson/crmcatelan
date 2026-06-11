import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/hooks/use-auth';
import { toast } from 'sonner';

export interface ConsultationSummary {
  id: string;
  tenant_id: string;
  lead_id: string;
  filled_by: string | null;
  needs_glasses: 'yes' | 'no' | 'reading' | 'distance' | 'both' | null;
  lens_type: string | null;
  od_spherical: number | null;
  od_cylindrical: number | null;
  od_axis: number | null;
  od_addition: number | null;
  oe_spherical: number | null;
  oe_cylindrical: number | null;
  oe_axis: number | null;
  oe_addition: number | null;
  prescription_valid_until: string | null;
  frame_recommendation: string | null;
  treatments: string[] | null;
  price_range_presented: string | null;
  products_shown: string | null;
  no_close_reason: string | null;
  no_close_reason_detail: string | null;
  professional_notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ConsultationSummaryInput = Partial<
  Omit<ConsultationSummary, 'id' | 'tenant_id' | 'lead_id' | 'created_at' | 'updated_at' | 'filled_by'>
>;

export function useConsultationSummary(leadId: string | null | undefined) {
  return useQuery({
    queryKey: ['consultation-summary', leadId],
    enabled: !!leadId,
    queryFn: async (): Promise<ConsultationSummary | null> => {
      const { data, error } = await (supabase as any)
        .from('lead_consultation_summary')
        .select('*')
        .eq('lead_id', leadId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as ConsultationSummary | null;
    },
  });
}

export function useUpsertConsultationSummary() {
  const qc = useQueryClient();
  const tenantId = useAuthStore((s) => s.tenant?.id ?? null);
  const userId = useAuthStore((s) => s.user?.id ?? null);

  return useMutation({
    mutationFn: async ({ leadId, data }: { leadId: string; data: ConsultationSummaryInput }) => {
      if (!tenantId) throw new Error('Tenant não identificado');
      const payload = {
        tenant_id: tenantId,
        lead_id: leadId,
        filled_by: userId,
        ...data,
      };
      const { data: row, error } = await (supabase as any)
        .from('lead_consultation_summary')
        .upsert(payload, { onConflict: 'lead_id' })
        .select()
        .single();
      if (error) throw error;
      return row;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['consultation-summary', vars.leadId] });
      toast.success('Resumo da consulta salvo');
    },
    onError: (e: any) => toast.error(`Erro ao salvar resumo: ${e.message}`),
  });
}

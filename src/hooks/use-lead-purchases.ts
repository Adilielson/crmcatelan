import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/hooks/use-auth';
import { toast } from 'sonner';

export interface LeadPurchase {
  id: string;
  tenant_id: string;
  lead_id: string;
  unit_id: string | null;
  appointment_id: string | null;
  attendant_id: string | null;
  purchase_date: string;
  amount: number;
  product_description: string | null;
  payment_method: string | null;
  installments: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useLeadPurchases(leadId: string | null | undefined) {
  return useQuery({
    queryKey: ['lead-purchases', leadId],
    enabled: !!leadId,
    queryFn: async (): Promise<LeadPurchase[]> => {
      const { data, error } = await (supabase as any)
        .from('lead_purchases')
        .select('*')
        .eq('lead_id', leadId)
        .order('purchase_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as LeadPurchase[];
    },
  });
}

export function useAllPurchases() {
  const tenantId = useAuthStore((s) => s.tenant?.id ?? null);
  return useQuery({
    queryKey: ['lead-purchases-all', tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<LeadPurchase[]> => {
      const { data, error } = await (supabase as any)
        .from('lead_purchases')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('purchase_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as LeadPurchase[];
    },
  });
}

export interface CreatePurchaseInput {
  lead_id: string;
  amount: number;
  purchase_date: string; // YYYY-MM-DD
  product_description?: string | null;
  payment_method?: string | null;
  installments?: number | null;
  attendant_id?: string | null;
  appointment_id?: string | null;
  unit_id?: string | null;
  notes?: string | null;
}

export function useCreateLeadPurchase() {
  const qc = useQueryClient();
  const tenantId = useAuthStore((s) => s.tenant?.id ?? null);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  return useMutation({
    mutationFn: async (input: CreatePurchaseInput) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      const payload = {
        tenant_id: tenantId,
        created_by: userId,
        attendant_id: input.attendant_id ?? userId,
        ...input,
      };
      const { data, error } = await (supabase as any)
        .from('lead_purchases')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as LeadPurchase;
    },
    onSuccess: (_d, vars) => {
      toast.success('Compra registrada');
      qc.invalidateQueries({ queryKey: ['lead-purchases', vars.lead_id] });
      qc.invalidateQueries({ queryKey: ['lead-purchases-all'] });
      qc.invalidateQueries({ queryKey: ['lead-history', vars.lead_id] });
    },
    onError: (e: any) => toast.error('Erro ao registrar compra: ' + (e?.message ?? e)),
  });
}

export function purchaseStats(purchases: LeadPurchase[]) {
  const total = purchases.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const count = purchases.length;
  const avg = count > 0 ? total / count : 0;
  const last = purchases[0] ?? null;
  return { total, count, avg, last };
}

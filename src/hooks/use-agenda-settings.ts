import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/hooks/use-auth';
import { toast } from 'sonner';

export interface BusinessHour {
  id: string;
  tenant_id: string;
  weekday: number; // 0=Dom .. 6=Sáb
  is_open: boolean;
  open_time: string | null;   // 'HH:MM:SS'
  close_time: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
}

export interface BlockedDate {
  id: string;
  tenant_id: string;
  blocked_date: string;       // yyyy-MM-dd
  all_day: boolean;
  block_start: string | null;
  block_end: string | null;
  reason: string | null;
}

export const WEEKDAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function useTenantId() {
  return useAuthStore((s) => s.tenant?.id ?? null);
}

export function useBusinessHours() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ['business_hours', tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<BusinessHour[]> => {
      const { data, error } = await (supabase as any)
        .from('agenda_business_hours')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('weekday', { ascending: true });
      if (error) throw error;
      return (data ?? []) as BusinessHour[];
    },
  });
}

export function useBlockedDates() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ['blocked_dates', tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<BlockedDate[]> => {
      const { data, error } = await (supabase as any)
        .from('agenda_blocked_dates')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('blocked_date', { ascending: true });
      if (error) throw error;
      return (data ?? []) as BlockedDate[];
    },
  });
}

export function useUpsertBusinessHour() {
  const qc = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: async (row: Partial<BusinessHour> & { weekday: number }) => {
      if (!tenantId) throw new Error('Tenant não identificado');
      const { error } = await (supabase as any)
        .from('agenda_business_hours')
        .upsert(
          { ...row, tenant_id: tenantId },
          { onConflict: 'tenant_id,weekday' },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business_hours', tenantId] }),
    onError: (e: any) => toast.error(`Erro ao salvar: ${e.message}`),
  });
}

export function useAddBlockedDate() {
  const qc = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: async (input: { blocked_date: string; all_day: boolean; block_start?: string; block_end?: string; reason?: string }) => {
      if (!tenantId) throw new Error('Tenant não identificado');
      const { error } = await (supabase as any)
        .from('agenda_blocked_dates')
        .insert({ ...input, tenant_id: tenantId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['blocked_dates', tenantId] });
      toast.success('Bloqueio adicionado');
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });
}

export function useDeleteBlockedDate() {
  const qc = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('agenda_blocked_dates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['blocked_dates', tenantId] });
      toast.success('Bloqueio removido');
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });
}

// Utilitários de validação
export function trimSec(t?: string | null) {
  if (!t) return null;
  return t.slice(0, 5); // HH:MM
}

export interface AvailabilityCheck {
  ok: boolean;
  reason?: string;
}

export function checkAvailability(
  date: string,                   // yyyy-MM-dd
  start: string,                  // HH:mm
  end: string,                    // HH:mm
  hours: BusinessHour[],
  blocked: BlockedDate[],
): AvailabilityCheck {
  const d = new Date(date + 'T00:00:00');
  const weekday = d.getDay();
  const cfg = hours.find((h) => h.weekday === weekday);

  if (!cfg || !cfg.is_open) {
    return { ok: false, reason: `${WEEKDAY_LABELS[weekday]} está marcado como fechado.` };
  }
  const open = trimSec(cfg.open_time);
  const close = trimSec(cfg.close_time);
  if (open && close && (start < open || end > close)) {
    return { ok: false, reason: `Fora do horário de funcionamento (${open}–${close}).` };
  }
  const ls = trimSec(cfg.lunch_start);
  const le = trimSec(cfg.lunch_end);
  if (ls && le && start < le && end > ls) {
    return { ok: false, reason: `Conflito com a pausa de almoço (${ls}–${le}).` };
  }

  const blocks = blocked.filter((b) => b.blocked_date === date);
  for (const b of blocks) {
    if (b.all_day) {
      return { ok: false, reason: `Data bloqueada${b.reason ? `: ${b.reason}` : ''}.` };
    }
    const bs = trimSec(b.block_start);
    const be = trimSec(b.block_end);
    if (bs && be && start < be && end > bs) {
      return { ok: false, reason: `Conflito com bloqueio ${bs}–${be}${b.reason ? ` (${b.reason})` : ''}.` };
    }
  }
  return { ok: true };
}

export function isDayFullyClosed(
  date: Date,
  hours: BusinessHour[],
  blocked: BlockedDate[],
): boolean {
  const cfg = hours.find((h) => h.weekday === date.getDay());
  if (!cfg || !cfg.is_open) return true;
  const dateStr = date.toISOString().slice(0, 10);
  return blocked.some((b) => b.blocked_date === dateStr && b.all_day);
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/hooks/use-auth';

export interface TenantProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export function useTenantProfiles() {
  const tenantId = useAuthStore((s) => s.tenant?.id ?? null);
  return useQuery({
    queryKey: ['tenant-profiles', tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<TenantProfile[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('tenant_id', tenantId!);
      if (error) throw error;
      return (data ?? []) as TenantProfile[];
    },
    staleTime: 60_000,
  });
}

export function firstName(name: string | null | undefined): string {
  if (!name) return '';
  return name.trim().split(/\s+/)[0] ?? '';
}

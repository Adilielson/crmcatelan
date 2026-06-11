import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { getMyPermissions } from '@/lib/permissions.functions';
import { useAuthStore } from '@/hooks/use-auth';
import type { ModuleKey } from '@/lib/permissions';

export function usePermissions() {
  const { user } = useAuthStore();
  const fetchFn = useServerFn(getMyPermissions);
  const { data, isLoading } = useQuery({
    queryKey: ['my-permissions', user?.id],
    queryFn: () => fetchFn(),
    enabled: !!user,
    staleTime: 60_000,
  });
  const can = (key: ModuleKey): boolean => {
    if (!user) return false;
    if (user.role === 'super_admin' || user.role === 'admin') return true;
    if (!data) return true; // não bloqueia enquanto carrega — guard final é no servidor
    return data[key] === true;
  };
  return { can, perms: data, isLoading };
}

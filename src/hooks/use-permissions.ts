import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { getMyPermissions } from '@/lib/permissions.functions';
import { useAuthStore } from '@/hooks/use-auth';
import { ALL_MODULE_KEYS, type ModuleKey } from '@/lib/permissions';

// Valida que a resposta do servidor é realmente um mapa de permissões.
// Protege contra respostas inválidas (ex.: 401 transitório durante o F5)
// que, se cacheadas, fariam o menu sumir inteiro.
function isValidPermsMap(d: unknown): d is Record<ModuleKey, boolean> {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return false;
  const obj = d as Record<string, unknown>;
  // precisa ter pelo menos uma chave de módulo conhecida com valor booleano
  return ALL_MODULE_KEYS.some((k) => typeof obj[k] === 'boolean');
}

export function usePermissions() {
  const { user } = useAuthStore();
  const fetchFn = useServerFn(getMyPermissions);
  const { data, isLoading } = useQuery({
    queryKey: ['my-permissions', user?.id],
    queryFn: async () => {
      // Garante que a sessão (token) já foi restaurada antes de chamar o
      // servidor — evita 401 transitório logo após um refresh (F5).
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) throw new Error('Sessão ainda não restaurada');
      const result = await fetchFn();
      if (!isValidPermsMap(result)) {
        // resposta inválida → lança para o react-query tentar de novo,
        // em vez de cachear lixo e esconder o menu.
        throw new Error('Resposta de permissões inválida');
      }
      return result;
    },
    enabled: !!user,
    staleTime: 60_000,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    refetchOnWindowFocus: true,
  });
  const perms = isValidPermsMap(data) ? data : undefined;
  const can = (key: ModuleKey): boolean => {
    if (!user) return false;
    if (user.role === 'super_admin' || user.role === 'admin') return true;
    if (!perms) return true; // não bloqueia enquanto carrega — guard final é no servidor
    return perms[key] === true;
  };
  return { can, perms, isLoading };
}

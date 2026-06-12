/**
 * Leitura SÍNCRONA da sessão Supabase direto do localStorage.
 *
 * Por que existe: `supabase.auth.getSession()` usa navigator.locks e pode
 * ficar pendente PARA SEMPRE após um refresh (lock órfão / outra aba ou
 * iframe segurando o lock). Qualquer lógica de "destravar spinner" ou
 * "redirecionar para /login" NÃO pode depender de getSession().
 *
 * Esta função nunca trava: lê o token persistido (chave sb-*-auth-token)
 * e devolve o usuário, ou null se não há sessão salva.
 */
export interface LocalSession {
  userId: string;
  email: string;
}

export function readLocalSession(): LocalSession | null {
  if (typeof window === 'undefined') return null;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !/^sb-.+-auth-token$/.test(key)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      // formato atual: { access_token, refresh_token, user, expires_at, ... }
      // formatos antigos: { currentSession: { ... } }
      const session = parsed?.currentSession ?? parsed;
      const user = session?.user;
      if (user?.id) {
        return { userId: user.id as string, email: (user.email as string) ?? '' };
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

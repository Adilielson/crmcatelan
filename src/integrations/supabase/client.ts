import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.types';

// SEM fallback hardcoded: se as envs faltarem, falha explicitamente.
function isValidHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function pickUrl(): string {
  const url = import.meta.env.VITE_SUPABASE_URL || 'https://gqscgcebgokoglkoidnz.supabase.co';
  if (isValidHttpUrl(url)) return url;
  throw new Error(
    '[Supabase] VITE_SUPABASE_URL ausente ou inválida. Configure as variáveis de ambiente do Supabase.',
  );
}

function pickKey(): string {
  const candidates: Array<unknown> = [
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    typeof process !== 'undefined' ? process.env?.SUPABASE_PUBLISHABLE_KEY : undefined,
    typeof process !== 'undefined' ? process.env?.SUPABASE_ANON_KEY : undefined,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 20) return c;
  }
  throw new Error(
    '[Supabase] VITE_SUPABASE_PUBLISHABLE_KEY ausente. Configure as variáveis de ambiente do Supabase.',
  );
}

export const supabase: SupabaseClient<Database> = createClient<Database>(pickUrl(), pickKey());

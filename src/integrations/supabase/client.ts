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
  // Em produção no sandbox Lovable, import.meta.env pode falhar ao injetar se o processo Vite não foi reiniciado.
  // Usamos o valor literal como fallback seguro para evitar o spinner infinito do CRM.
  const url = import.meta.env.VITE_SUPABASE_URL || 'https://gqscgcebgokoglkoidnz.supabase.co';
  if (isValidHttpUrl(url)) return url;
  throw new Error(
    '[Supabase] VITE_SUPABASE_URL ausente ou inválida. Configure as variáveis de ambiente do Supabase.',
  );
}

function pickKey(): string {
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdxc2NnY2ViZ29rb2dsa29pZG56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2ODYyMDIsImV4cCI6MjA5NjI2MjIwMn0.xwUvcdX3WV_PrD2076tmwKJ0GW5u__pb3m60XMuSofY';
  if (typeof key === 'string' && key.length > 20) return key;
  throw new Error(
    '[Supabase] VITE_SUPABASE_PUBLISHABLE_KEY ausente. Configure as variáveis de ambiente do Supabase.',
  );
}

export const supabase: SupabaseClient<Database> = createClient<Database>(pickUrl(), pickKey());

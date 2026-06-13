import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.types';

// Fallbacks fixos: URL e chave PUBLISHABLE (anon) são públicas por design —
// a segurança vem do RLS no banco. Garante que o client sempre inicializa,
// mesmo se a injeção de env falhar em algum build.
const FALLBACK_URL = 'https://gqscgcebgokoglkoidnz.supabase.co';
const FALLBACK_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdxc2NnY2ViZ29rb2dsa29pZG56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2ODYyMDIsImV4cCI6MjA5NjI2MjIwMn0.xwUvcdX3WV_PrD2076tmwKJ0GW5u__pb3m60XMuSofY';

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
  const candidates: Array<unknown> = [
    import.meta.env.VITE_SUPABASE_URL,
    typeof process !== 'undefined' ? process.env?.SUPABASE_URL : undefined,
    typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_URL : undefined,
    FALLBACK_URL,
  ];
  for (const c of candidates) {
    if (isValidHttpUrl(c)) return c;
  }
  return FALLBACK_URL;
}

function pickKey(): string {
  const candidates: Array<unknown> = [
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    typeof process !== 'undefined' ? process.env?.SUPABASE_PUBLISHABLE_KEY : undefined,
    typeof process !== 'undefined' ? process.env?.SUPABASE_ANON_KEY : undefined,
    FALLBACK_KEY,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 20) return c;
  }
  return FALLBACK_KEY;
}

const supabaseUrl = pickUrl();
const supabaseKey = pickKey();

// Stub seguro pra SSR: não chama createClient quando faltam credenciais
function createStubClient(): SupabaseClient<Database> {
  const err = () =>
    Promise.resolve({
      data: null,
      error: { message: 'Supabase client não inicializado (credenciais ausentes em runtime).' },
    }) as any;
  const chain: any = new Proxy(function () {}, {
    get: () => chain,
    apply: () => err(),
  });
  return chain as SupabaseClient<Database>;
}

function safeCreate(): SupabaseClient<Database> {
  try {
    return createClient<Database>(supabaseUrl, supabaseKey);
  } catch (e) {
    console.error('[Supabase] createClient falhou, usando stub:', e);
    return createStubClient();
  }
}

export const supabase: SupabaseClient<Database> = safeCreate();

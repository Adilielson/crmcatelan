import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.types';

// Fallbacks fixos: URL e chave PUBLISHABLE (anon) são públicas por design —
// a segurança vem do RLS no banco. Garante que o client sempre inicializa,
// mesmo se a injeção de env falhar em algum build.
const FALLBACK_URL = 'https://gqscgcebgokoglkoidnz.supabase.co';
const FALLBACK_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdxc2NnY2ViZ29rb2dsa29pZG56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2ODYyMDIsImV4cCI6MjA5NjI2MjIwMn0.xwUvcdX3WV_PrD2076tmwKJ0GW5u__pb3m60XMuSofY';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  (typeof process !== 'undefined' ? process.env?.SUPABASE_URL : undefined) ||
  FALLBACK_URL;
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  (typeof process !== 'undefined'
    ? process.env?.SUPABASE_PUBLISHABLE_KEY || process.env?.SUPABASE_ANON_KEY
    : undefined) ||
  FALLBACK_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    '[Supabase] Credenciais ausentes em runtime. Verifique VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.',
  );
}

// Stub seguro pra SSR: não chama createClient quando faltam credenciais
// (evita "supabaseUrl is required" e o crash de toda a página).
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

export const supabase: SupabaseClient<Database> =
  supabaseUrl && supabaseKey
    ? createClient<Database>(supabaseUrl, supabaseKey)
    : createStubClient();

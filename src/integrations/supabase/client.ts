import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.types';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  (typeof process !== 'undefined' ? process.env?.SUPABASE_URL : undefined) ||
  '';
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  (typeof process !== 'undefined'
    ? process.env?.SUPABASE_PUBLISHABLE_KEY || process.env?.SUPABASE_ANON_KEY
    : undefined) ||
  '';

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

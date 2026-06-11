// Server-side Supabase client.
// Prefere a service role key (bypassa RLS) quando disponível no runtime;
// caso contrário, cai para a publishable/anon key (RLS aplicada) para que
// o app continue funcionando no ambiente nativo do Lovable, onde o
// SUPABASE_SERVICE_ROLE_KEY pode não estar exposto ao server runtime.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

let _warnedNoServiceRole = false;

function createSupabaseAdminClient() {
  const SUPABASE_URL =
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;

  const SERVICE_ROLE =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SB_SERVICE_ROLE_KEY;

  const FALLBACK_KEY =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  const KEY = SERVICE_ROLE || FALLBACK_KEY;

  if (!SUPABASE_URL || !KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ['SUPABASE_URL'] : []),
      ...(!KEY ? ['SUPABASE_SERVICE_ROLE_KEY (ou PUBLISHABLE_KEY como fallback)'] : []),
    ];
    const message = `Missing Supabase environment variable(s): ${missing.join(', ')}.`;
    console.error(`[Supabase] ${message}`);
    throw new Error(message);
  }

  if (!SERVICE_ROLE && !_warnedNoServiceRole) {
    _warnedNoServiceRole = true;
    console.warn(
      '[Supabase] SUPABASE_SERVICE_ROLE_KEY ausente no runtime — usando publishable key (RLS será aplicada). ' +
        'Operações que dependem de bypass de RLS podem falhar.',
    );
  }

  return createClient<Database>(SUPABASE_URL, KEY, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

let _supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | undefined;

// SECURITY: quando a service role está presente, este client bypassa RLS.
// Não exporte/importe este módulo em código client-side.
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseAdminClient>, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});

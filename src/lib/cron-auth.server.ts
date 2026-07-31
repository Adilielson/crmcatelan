// Autenticação única para todos os endpoints de cron em /api/public/hooks/*.
//
// SEGURANÇA: a anon/publishable key NÃO pode ser aceita aqui — ela é pública
// (vai no bundle do front), então qualquer pessoa poderia disparar envio em
// massa de WhatsApp. Só o CRON_SECRET (env privada) autentica.

/** Comparação em tempo constante (evita timing attack). */
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  // compara sempre o mesmo número de bytes
  const len = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < len; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

export type CronAuthResult = { ok: true } | { ok: false; response: Response };

/**
 * Exige o header `x-cron-secret` (ou `authorization: Bearer <secret>`)
 * igual ao env CRON_SECRET.
 * - env ausente/vazia  -> 503 (fail-closed, nunca autoriza)
 * - secret ausente/errado -> 401
 */
export function requireCronAuth(request: Request): CronAuthResult {
  const expected = (process.env.CRON_SECRET ?? '').trim();
  if (!expected) {
    console.error('[cron-auth] CRON_SECRET não configurado — recusando execução');
    return {
      ok: false,
      response: new Response('Cron secret not configured', { status: 503 }),
    };
  }

  const header = request.headers.get('x-cron-secret');
  const auth = request.headers.get('authorization');
  const bearer = auth?.toLowerCase().startsWith('bearer ') ? auth.slice(7) : null;
  const provided = (header ?? bearer ?? '').trim();

  if (!provided || !timingSafeEqual(provided, expected)) {
    return { ok: false, response: new Response('Unauthorized', { status: 401 }) };
  }
  return { ok: true };
}

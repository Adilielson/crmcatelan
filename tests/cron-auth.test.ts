import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { requireCronAuth } from '../src/lib/cron-auth.server';

const SECRET = 'segredo-de-teste-123';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.publica.qualquer';

function req(headers: Record<string, string> = {}) {
  return new Request('https://x/api/public/hooks/test', { method: 'POST', headers });
}

describe('requireCronAuth', () => {
  const original = process.env.CRON_SECRET;
  beforeEach(() => { process.env.CRON_SECRET = SECRET; });
  afterEach(() => { process.env.CRON_SECRET = original; });

  it('aceita o x-cron-secret correto', () => {
    expect(requireCronAuth(req({ 'x-cron-secret': SECRET })).ok).toBe(true);
  });

  it('aceita via Authorization: Bearer', () => {
    expect(requireCronAuth(req({ authorization: `Bearer ${SECRET}` })).ok).toBe(true);
  });

  it('rejeita a anon key (chave pública)', () => {
    const r = requireCronAuth(req({ apikey: anonKey, 'x-cron-secret': anonKey }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(401);
  });

  it('rejeita requisição sem segredo (fail-closed)', () => {
    const r = requireCronAuth(req());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(401);
  });

  it('retorna 503 quando CRON_SECRET não está configurado', () => {
    process.env.CRON_SECRET = '';
    const r = requireCronAuth(req({ 'x-cron-secret': 'qualquer-coisa' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(503);
  });
});

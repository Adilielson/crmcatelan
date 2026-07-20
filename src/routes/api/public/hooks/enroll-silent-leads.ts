import { createFileRoute } from '@tanstack/react-router';

// Cron: encontra leads que abriram conversa e pararam de responder,
// e enfileira os passos da cadência "lead_silent" ativa para o tenant.
export const Route = createFileRoute('/api/public/hooks/enroll-silent-leads')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret =
          request.headers.get('x-cron-secret') ?? request.headers.get('apikey') ?? '';
        const allowed = [
          process.env.FOLLOWUPS_CRON_SECRET,
          process.env.SUPABASE_ANON_KEY,
          process.env.SUPABASE_PUBLISHABLE_KEY,
          process.env.VITE_SUPABASE_ANON_KEY,
          process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        ].filter(Boolean) as string[];
        if (!secret || (allowed.length > 0 && !allowed.includes(secret))) {
          return new Response('Unauthorized', { status: 401 });
        }

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

        // Cadências ativas de silêncio
        const { data: cadences } = await supabaseAdmin
          .from('followup_cadences')
          .select('id, tenant_id, silence_minutes, enabled, trigger_type')
          .eq('trigger_type', 'lead_silent')
          .eq('enabled', true);

        let enrolled = 0;
        const now = Date.now();

        for (const cad of cadences ?? []) {
          const cutoff = new Date(now - (cad.silence_minutes ?? 120) * 60_000).toISOString();

          // Passos da cadência
          const { data: steps } = await supabaseAdmin
            .from('followup_cadence_steps')
            .select('id, position, offset_minutes, channel, enabled')
            .eq('cadence_id', cad.id)
            .eq('enabled', true)
            .order('position');
          if (!steps || steps.length === 0) continue;

          // Leads silenciosos: última msg do cliente ficou sem resposta por > silence_minutes
          // Só leads ativos, sem atendente humano atribuído, não frios.
          const { data: leads } = await supabaseAdmin
            .from('leads')
            .select('id, tenant_id, last_inbound_at, last_outbound_at, engagement_status, status, assigned_user_id')
            .eq('tenant_id', cad.tenant_id)
            .in('status', ['open', 'in_progress', 'negotiating'])
            .neq('engagement_status', 'cold')
            .is('assigned_user_id', null)
            .not('last_inbound_at', 'is', null)
            .lte('last_inbound_at', cutoff)
            .limit(500);

          for (const lead of leads ?? []) {
            // Sem resposta: último outbound < último inbound (ou nunca respondeu)
            if (lead.last_outbound_at && new Date(lead.last_outbound_at) >= new Date(lead.last_inbound_at!)) {
              // A loja respondeu depois — não é silêncio da loja, mas do cliente
              // Mesmo assim consideramos silêncio (cliente sumiu após resposta), então segue.
            }

            // Já enrollado nesta cadência recentemente?
            const { data: existing } = await supabaseAdmin
              .from('lead_followups')
              .select('id, status')
              .eq('lead_id', lead.id)
              .eq('cadence_id', cad.id)
              .in('status', ['pending', 'sent'])
              .limit(1);
            if (existing && existing.length > 0) continue;

            // Marca como silent e enfileira passos
            await supabaseAdmin
              .from('leads')
              .update({ engagement_status: 'silent' })
              .eq('id', lead.id);

            const rows = steps.map((s: any) => ({
              tenant_id: cad.tenant_id,
              lead_id: lead.id,
              day_offset: Math.max(0, Math.floor(s.offset_minutes / 1440)),
              channel: s.channel,
              template_key: `cadence:${cad.id}:${s.position}`,
              scheduled_at: new Date(now + s.offset_minutes * 60_000).toISOString(),
              cadence_id: cad.id,
              cadence_step_id: s.id,
              status: 'pending',
            }));

            const { error: insErr } = await supabaseAdmin.from('lead_followups').insert(rows);
            if (!insErr) enrolled++;
          }
        }

        return Response.json({ ok: true, enrolled });
      },
    },
  },
});

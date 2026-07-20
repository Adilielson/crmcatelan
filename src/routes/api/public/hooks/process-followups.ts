import { createFileRoute } from '@tanstack/react-router';

const UAZAPI_BASE_URL = 'https://ipazua.uazapi.com';

function render(template: string, data: { nome: string; primeiro_nome: string; telefone: string }) {
  return template
    .replace(/\{primeiro_nome\}/g, data.primeiro_nome)
    .replace(/\{nome\}/g, data.nome)
    .replace(/\{telefone\}/g, data.telefone);
}

export const Route = createFileRoute('/api/public/hooks/process-followups')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get('x-cron-secret') ?? request.headers.get('apikey') ?? '';
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

        const { data: due, error } = await supabaseAdmin
          .from('lead_followups')
          .select('id, tenant_id, lead_id, template_key, channel, scheduled_at, cadence_id, cadence_step_id')
          .eq('status', 'pending')
          .lte('scheduled_at', new Date().toISOString())
          .limit(200);

        if (error) {
          console.error('[followups] fetch error', error);
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        let sent = 0;
        let failed = 0;
        let skipped = 0;
        let coldMarked = 0;

        for (const f of due ?? []) {
          try {
            if (f.channel !== 'whatsapp') {
              await supabaseAdmin
                .from('lead_followups')
                .update({ status: 'skipped', error_message: 'Toque manual (ligação) — registrar no histórico do lead' })
                .eq('id', f.id);
              skipped++;
              continue;
            }

            const [{ data: lead }, { data: wa }] = await Promise.all([
              supabaseAdmin
                .from('leads')
                .select('full_name, phone, status, engagement_status, last_inbound_at, assigned_user_id')
                .eq('id', f.lead_id)
                .single(),
              supabaseAdmin.from('whatsapp_config').select('instance_token, is_active').eq('tenant_id', f.tenant_id).maybeSingle(),
            ]);

            if (!lead || !lead.phone) {
              await supabaseAdmin.from('lead_followups').update({ status: 'failed', error_message: 'Lead sem telefone' }).eq('id', f.id);
              failed++;
              continue;
            }

            // ── CADENCE-BASED FOLLOWUP ─────────────────────────────────
            if (f.cadence_id && f.cadence_step_id) {
              // Cliente respondeu depois do enrollment? Cancela cadeia.
              const { data: enrollment } = await supabaseAdmin
                .from('lead_followups')
                .select('created_at')
                .eq('id', f.id)
                .single();
              if (
                lead.last_inbound_at &&
                enrollment?.created_at &&
                new Date(lead.last_inbound_at) > new Date(enrollment.created_at)
              ) {
                await supabaseAdmin
                  .from('lead_followups')
                  .update({ status: 'skipped', error_message: 'Cliente voltou a responder' })
                  .eq('cadence_id', f.cadence_id)
                  .eq('lead_id', f.lead_id)
                  .eq('status', 'pending');
                await supabaseAdmin
                  .from('leads')
                  .update({ engagement_status: 'recovered' })
                  .eq('id', f.lead_id);
                skipped++;
                continue;
              }
              // Foi atribuído a um humano? Cancela.
              if (lead.assigned_user_id) {
                await supabaseAdmin
                  .from('lead_followups')
                  .update({ status: 'skipped', error_message: 'Atribuído a atendente' })
                  .eq('cadence_id', f.cadence_id)
                  .eq('lead_id', f.lead_id)
                  .eq('status', 'pending');
                skipped++;
                continue;
              }

              const { data: step } = await supabaseAdmin
                .from('followup_cadence_steps')
                .select('message_template, position, enabled')
                .eq('id', f.cadence_step_id)
                .single();
              const { data: cad } = await supabaseAdmin
                .from('followup_cadences')
                .select('cold_after_step, enabled')
                .eq('id', f.cadence_id)
                .single();

              if (!step || !cad || !cad.enabled || step.enabled === false) {
                await supabaseAdmin
                  .from('lead_followups')
                  .update({ status: 'skipped', error_message: 'Cadência ou passo desativado' })
                  .eq('id', f.id);
                skipped++;
                continue;
              }

              const isColdMarker =
                cad.cold_after_step && step.position >= cad.cold_after_step && !step.message_template?.trim();

              if (isColdMarker) {
                await supabaseAdmin
                  .from('leads')
                  .update({ engagement_status: 'cold' })
                  .eq('id', f.lead_id);
                await supabaseAdmin
                  .from('lead_followups')
                  .update({ status: 'sent', sent_at: new Date().toISOString(), error_message: 'Lead marcado como frio' })
                  .eq('id', f.id);
                coldMarked++;
                continue;
              }

              if (!wa || !wa.is_active || !wa.instance_token) {
                await supabaseAdmin
                  .from('lead_followups')
                  .update({ status: 'failed', error_message: 'WhatsApp não configurado' })
                  .eq('id', f.id);
                failed++;
                continue;
              }

              const firstName = (lead.full_name ?? 'cliente').split(' ')[0];
              const text = render(step.message_template ?? 'Olá {primeiro_nome}!', {
                nome: lead.full_name ?? 'cliente',
                primeiro_nome: firstName,
                telefone: lead.phone,
              });

              const res = await fetch(`${UAZAPI_BASE_URL}/send/text`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', token: wa.instance_token },
                body: JSON.stringify({ number: lead.phone, text }),
              });
              if (!res.ok) {
                const errText = await res.text().catch(() => '');
                await supabaseAdmin
                  .from('lead_followups')
                  .update({ status: 'failed', error_message: `HTTP ${res.status}: ${errText.slice(0, 200)}` })
                  .eq('id', f.id);
                failed++;
                continue;
              }

              await supabaseAdmin
                .from('lead_followups')
                .update({ status: 'sent', sent_at: new Date().toISOString() })
                .eq('id', f.id);
              await supabaseAdmin.from('whatsapp_message_logs').insert({
                tenant_id: f.tenant_id,
                recipient_phone: lead.phone,
                message_type: 'text',
                status: 'sent',
                error_message: text.slice(0, 500),
                sender_name: 'Cadência',
              });

              // Marca cold se este for o cold_after_step (mesmo tendo mensagem)
              if (cad.cold_after_step && step.position >= cad.cold_after_step) {
                await supabaseAdmin
                  .from('leads')
                  .update({ engagement_status: 'cold' })
                  .eq('id', f.lead_id);
                coldMarked++;
              }
              sent++;
              continue;
            }

            // ── LEGACY: reminder_templates (kind=followup) ──────────────
            if (lead.status !== 'followup') {
              await supabaseAdmin
                .from('lead_followups')
                .update({ status: 'skipped', error_message: `Lead saiu do follow-up (status: ${lead.status})` })
                .eq('id', f.id);
              skipped++;
              continue;
            }

            if (!wa || !wa.is_active || !wa.instance_token) {
              await supabaseAdmin
                .from('lead_followups')
                .update({ status: 'failed', error_message: 'WhatsApp não configurado para o tenant' })
                .eq('id', f.id);
              failed++;
              continue;
            }

            const { data: tpl } = await supabaseAdmin
              .from('reminder_templates')
              .select('message_template, enabled')
              .eq('tenant_id', f.tenant_id)
              .eq('kind', 'followup')
              .eq('step_key', f.template_key)
              .maybeSingle();

            if (tpl && tpl.enabled === false) {
              await supabaseAdmin
                .from('lead_followups')
                .update({ status: 'skipped', error_message: 'Template desativado' })
                .eq('id', f.id);
              skipped++;
              continue;
            }

            const firstName = lead.full_name.split(' ')[0];
            const text = render(tpl?.message_template ?? 'Olá {nome}!', {
              nome: firstName,
              primeiro_nome: firstName,
              telefone: lead.phone,
            });

            const res = await fetch(`${UAZAPI_BASE_URL}/send/text`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', token: wa.instance_token },
              body: JSON.stringify({ number: lead.phone, text }),
            });

            if (!res.ok) {
              const errText = await res.text().catch(() => '');
              await supabaseAdmin
                .from('lead_followups')
                .update({ status: 'failed', error_message: `HTTP ${res.status}: ${errText.slice(0, 200)}` })
                .eq('id', f.id);
              await supabaseAdmin.from('whatsapp_message_logs').insert({
                tenant_id: f.tenant_id,
                recipient_phone: lead.phone,
                message_type: 'text',
                status: 'failed',
                error_message: `Follow-up ${f.template_key}: HTTP ${res.status}`,
              });
              failed++;
              continue;
            }

            await supabaseAdmin
              .from('lead_followups')
              .update({ status: 'sent', sent_at: new Date().toISOString() })
              .eq('id', f.id);
            await supabaseAdmin.from('whatsapp_message_logs').insert({
              tenant_id: f.tenant_id,
              recipient_phone: lead.phone,
              message_type: 'text',
              status: 'sent',
              error_message: text.slice(0, 500),
              sender_name: 'Follow-up',
            });
            sent++;
          } catch (e: any) {
            await supabaseAdmin
              .from('lead_followups')
              .update({ status: 'failed', error_message: String(e?.message ?? e).slice(0, 300) })
              .eq('id', f.id);
            failed++;
          }
        }

        return Response.json({ ok: true, processed: due?.length ?? 0, sent, failed, skipped, coldMarked });
      },
    },
  },
});

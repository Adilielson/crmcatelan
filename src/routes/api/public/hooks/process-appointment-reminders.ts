import { createFileRoute } from '@tanstack/react-router';

const UAZAPI_BASE_URL = 'https://ipazua.uazapi.com';

function firstName(full?: string | null) {
  return (full || '').trim().split(/\s+/)[0] || 'tudo bem';
}

function fmtDateTime(iso: string) {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    }).format(d);
  } catch {
    return iso;
  }
}

function renderMessage(
  kind: string,
  lead: { full_name: string | null },
  appt: { scheduled_at: string; status: string | null },
  unitAddress: string | null,
): string {
  const nome = firstName(lead.full_name);
  switch (kind) {
    case 'confirm_24h':
    case 'confirm_retry_2h':
      return `Olá, ${nome}! Passando para confirmar seu agendamento amanhã (${fmtDateTime(appt.scheduled_at)}) na Ótica Catelã. Tudo certo para amanhã? Confirme aqui. Se não puder vir, nos avise.`;
    case 'day_morning':
      if (appt.status === 'confirmed') {
        return `Ei, ${nome}! Hoje é o dia do nosso agendamento (${fmtDateTime(appt.scheduled_at)})! Estamos te esperando.`;
      }
      return `Ei, ${nome}! Hoje é o dia do nosso agendamento (${fmtDateTime(appt.scheduled_at)})! Aguardando sua confirmação.`;
    case 'final_1h':
      return `${nome}, falta só 1 hora! Estamos te esperando na Ótica Catelã${unitAddress ? ` (${unitAddress})` : ''}.`;
    default:
      return `Olá, ${nome}!`;
  }
}

export const Route = createFileRoute('/api/public/hooks/process-appointment-reminders')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get('x-cron-secret') ?? request.headers.get('apikey');
        const expected = process.env.FOLLOWUPS_CRON_SECRET ?? process.env.SUPABASE_ANON_KEY;
        if (!secret || !expected || secret !== expected) {
          return new Response('Unauthorized', { status: 401 });
        }

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

        const { data: due, error } = await supabaseAdmin
          .from('appointment_reminders')
          .select('id, tenant_id, appointment_id, lead_id, kind, scheduled_at')
          .eq('status', 'pending')
          .lte('scheduled_at', new Date().toISOString())
          .limit(200);

        if (error) {
          console.error('[appt-reminders] fetch error', error);
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        let sent = 0,
          failed = 0,
          skipped = 0;

        for (const r of due ?? []) {
          try {
            const [{ data: appt }, { data: wa }] = await Promise.all([
              supabaseAdmin
                .from('appointments')
                .select('id, scheduled_at, status, lead_id, unit_id')
                .eq('id', r.appointment_id)
                .maybeSingle(),
              supabaseAdmin
                .from('whatsapp_config')
                .select('instance_token, is_active')
                .eq('tenant_id', r.tenant_id)
                .maybeSingle(),
            ]);

            if (!appt) {
              await supabaseAdmin
                .from('appointment_reminders')
                .update({ status: 'skipped', error_message: 'Agendamento removido' })
                .eq('id', r.id);
              skipped++;
              continue;
            }

            if (['cancelled', 'completed', 'no_show'].includes(appt.status ?? '')) {
              await supabaseAdmin
                .from('appointment_reminders')
                .update({ status: 'skipped', error_message: `status=${appt.status}` })
                .eq('id', r.id);
              skipped++;
              continue;
            }

            const leadId = (r as any).lead_id ?? appt.lead_id;
            const { data: lead } = leadId
              ? await supabaseAdmin
                  .from('leads')
                  .select('full_name, phone')
                  .eq('id', leadId)
                  .maybeSingle()
              : { data: null as any };

            if (!lead || !lead.phone) {
              await supabaseAdmin
                .from('appointment_reminders')
                .update({ status: 'failed', error_message: 'Lead sem telefone' })
                .eq('id', r.id);
              failed++;
              continue;
            }

            if (!wa?.is_active || !wa.instance_token) {
              await supabaseAdmin
                .from('appointment_reminders')
                .update({ status: 'failed', error_message: 'WhatsApp não configurado' })
                .eq('id', r.id);
              failed++;
              continue;
            }

            let unitAddress: string | null = null;
            if (appt.unit_id) {
              const { data: u } = await supabaseAdmin
                .from('units')
                .select('address')
                .eq('id', appt.unit_id)
                .maybeSingle();
              unitAddress = u?.address ?? null;
            }

            const text = renderMessage(r.kind, lead, appt as any, unitAddress);

            const res = await fetch(`${UAZAPI_BASE_URL}/send/text`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', token: wa.instance_token },
              body: JSON.stringify({ number: lead.phone, text }),
            });

            if (!res.ok) {
              const errTxt = await res.text().catch(() => '');
              await supabaseAdmin
                .from('appointment_reminders')
                .update({ status: 'failed', error_message: `HTTP ${res.status}: ${errTxt.slice(0, 200)}` })
                .eq('id', r.id);
              await supabaseAdmin.from('whatsapp_message_logs').insert({
                tenant_id: r.tenant_id,
                recipient_phone: lead.phone,
                message_type: 'text',
                status: 'failed',
                error_message: `Lembrete ${r.kind}: HTTP ${res.status}`,
              });
              failed++;
              continue;
            }

            await supabaseAdmin
              .from('appointment_reminders')
              .update({ status: 'sent', sent_at: new Date().toISOString() })
              .eq('id', r.id);

            await supabaseAdmin.from('whatsapp_message_logs').insert({
              tenant_id: r.tenant_id,
              recipient_phone: lead.phone,
              message_type: 'text',
              status: 'sent',
              error_message: text.slice(0, 500),
              sender_name: `Lembrete ${r.kind}`,
            });
            sent++;
          } catch (e: any) {
            await supabaseAdmin
              .from('appointment_reminders')
              .update({ status: 'failed', error_message: String(e?.message ?? e).slice(0, 300) })
              .eq('id', r.id);
            failed++;
          }
        }

        return Response.json({ ok: true, processed: due?.length ?? 0, sent, failed, skipped });
      },
    },
  },
});

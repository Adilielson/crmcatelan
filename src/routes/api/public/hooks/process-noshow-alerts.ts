import { createFileRoute } from '@tanstack/react-router';

const UAZAPI_BASE_URL = 'https://ipazua.uazapi.com';

function fmtTime(iso: string, tz = 'America/Sao_Paulo') {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function firstName(full?: string | null) {
  return (full ?? '').trim().split(/\s+/)[0] || 'cliente';
}

function render(template: string, data: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, k) => data[k] ?? '');
}

async function sendWhatsApp(token: string, number: string, text: string) {
  return fetch(`${UAZAPI_BASE_URL}/send/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', token },
    body: JSON.stringify({ number, text }),
  });
}

export const Route = createFileRoute('/api/public/hooks/process-noshow-alerts')({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

        const nowIso = new Date().toISOString();

        // 1) Pending alerts due now
        const { data: due, error } = await supabaseAdmin
          .from('noshow_alerts')
          .select('id, tenant_id, appointment_id, lead_id, attendant_id, kind, scheduled_at')
          .eq('status', 'pending')
          .lte('scheduled_at', nowIso)
          .limit(200);

        if (error) {
          console.error('[noshow] fetch error', error);
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        let sent = 0;
        let skipped = 0;
        let failed = 0;

        for (const a of due ?? []) {
          try {
            // Load settings for tenant
            const [{ data: cfg }, { data: appt }, { data: wa }] = await Promise.all([
              supabaseAdmin.from('noshow_settings').select('*').eq('tenant_id', a.tenant_id).maybeSingle(),
              supabaseAdmin.from('appointments').select('id, status, scheduled_at, checkin_at, lead_id').eq('id', a.appointment_id).maybeSingle(),
              supabaseAdmin.from('whatsapp_config').select('instance_token, is_active').eq('tenant_id', a.tenant_id).maybeSingle(),
            ]);

            if (!cfg || !cfg.enabled) {
              await supabaseAdmin.from('noshow_alerts').update({ status: 'skipped', error_message: 'alerts disabled' }).eq('id', a.id);
              skipped++;
              continue;
            }
            if (!appt) {
              await supabaseAdmin.from('noshow_alerts').update({ status: 'skipped', error_message: 'appointment removed' }).eq('id', a.id);
              skipped++;
              continue;
            }
            if (appt.checkin_at || ['cancelled', 'completed', 'no_show'].includes(appt.status as string)) {
              await supabaseAdmin.from('noshow_alerts').update({ status: 'skipped', error_message: `appt=${appt.status} checkin=${appt.checkin_at ? 'yes' : 'no'}` }).eq('id', a.id);
              skipped++;
              continue;
            }

            const [{ data: lead }, { data: attendant }] = await Promise.all([
              a.lead_id ? supabaseAdmin.from('leads').select('full_name, phone').eq('id', a.lead_id).maybeSingle() : Promise.resolve({ data: null as any }),
              a.attendant_id ? supabaseAdmin.from('profiles').select('full_name, phone').eq('id', a.attendant_id).maybeSingle() : Promise.resolve({ data: null as any }),
            ]);

            const leadName = lead?.full_name ?? 'Lead';
            const scheduledTxt = fmtTime(appt.scheduled_at as string);

            // In-app notification for the attendant
            if (a.attendant_id) {
              await supabaseAdmin.from('notifications').insert({
                tenant_id: a.tenant_id,
                profile_id: a.attendant_id,
                title: '⚠️ Confirmar presença',
                message: `${leadName} estava agendado para ${scheduledTxt}. Já compareceu? Confirme no CRM.`,
                type: 'in_app',
                category: 'lead_alert',
                link: a.lead_id ? `/kanban?lead=${a.lead_id}` : '/kanban',
              });
            }

            // WhatsApp to attendant / manager
            const msg = `⚠️ Confirmar presença: *${leadName}* estava agendado para *${scheduledTxt}*. Já compareceu? Responda no CRM: ✅ Compareceu / ❌ Não veio / 🔄 Remarcar.`;
            const targets: string[] = [];
            if (cfg.notify_attendant_whatsapp && attendant?.phone) targets.push(attendant.phone);
            if (cfg.notify_manager_whatsapp && cfg.manager_phone) targets.push(cfg.manager_phone);

            if (targets.length && wa?.is_active && wa?.instance_token) {
              for (const to of targets) {
                await sendWhatsApp(wa.instance_token, to, msg).catch(() => null);
              }
            }

            await supabaseAdmin.from('noshow_alerts').update({
              status: 'sent',
              sent_at: nowIso,
              channel: targets.length ? 'both' : 'in_app',
            }).eq('id', a.id);
            sent++;
          } catch (e: any) {
            await supabaseAdmin.from('noshow_alerts').update({
              status: 'failed',
              error_message: String(e?.message ?? e).slice(0, 300),
            }).eq('id', a.id);
            failed++;
          }
        }

        // 2) Daily summary — run once per hour window matching cfg.daily_summary_time
        // Simple: for each tenant with daily_summary_enabled, check if current UTC hour:minute
        // matches (allowing 5-min drift) and no summary alert already exists for today.
        const now = new Date();
        const hh = String(now.getUTCHours()).padStart(2, '0');
        const mm = String(now.getUTCMinutes()).padStart(2, '0');
        const todayKey = now.toISOString().slice(0, 10);

        const { data: tenantsCfg } = await supabaseAdmin
          .from('noshow_settings')
          .select('tenant_id, daily_summary_enabled, daily_summary_time, notify_attendant_whatsapp')
          .eq('daily_summary_enabled', true)
          .eq('enabled', true);

        let summariesSent = 0;

        for (const t of tenantsCfg ?? []) {
          // daily_summary_time is stored in HH:MM:SS (naive, treat as UTC-ish for simplicity — MVP)
          const cfgTime = (t.daily_summary_time as string ?? '19:00:00').slice(0, 5);
          if (cfgTime !== `${hh}:${mm}`) continue;

          // Idempotency: skip if a daily_summary alert exists for today
          const { data: existing } = await supabaseAdmin
            .from('noshow_alerts')
            .select('id')
            .eq('tenant_id', t.tenant_id)
            .eq('kind', 'daily_summary')
            .gte('created_at', `${todayKey}T00:00:00Z`)
            .limit(1);
          if (existing && existing.length > 0) continue;

          // Find today's appointments with no resolution (no checkin, not completed/cancelled/no_show)
          const startOfDay = `${todayKey}T00:00:00Z`;
          const endOfDay = `${todayKey}T23:59:59Z`;
          const { data: opens } = await supabaseAdmin
            .from('appointments')
            .select('id, lead_id, lead_name, scheduled_at, professional_id, checkin_at, status')
            .eq('tenant_id', t.tenant_id)
            .gte('scheduled_at', startOfDay)
            .lte('scheduled_at', endOfDay)
            .is('checkin_at', null)
            .not('status', 'in', '(cancelled,completed,no_show)');

          if (!opens || opens.length === 0) {
            await supabaseAdmin.from('noshow_alerts').insert({
              tenant_id: t.tenant_id, appointment_id: null as any, kind: 'daily_summary',
              scheduled_at: nowIso, status: 'skipped', error_message: 'no pending appts',
            }).select().maybeSingle().then(() => null).catch(() => null);
            continue;
          }

          // Group by attendant (professional_id)
          const byAttendant = new Map<string, typeof opens>();
          for (const o of opens) {
            const key = (o.professional_id as string) || '__none__';
            const arr = byAttendant.get(key) ?? [];
            arr.push(o);
            byAttendant.set(key, arr);
          }

          const { data: wa } = await supabaseAdmin.from('whatsapp_config').select('instance_token, is_active').eq('tenant_id', t.tenant_id).maybeSingle();

          for (const [attId, list] of byAttendant.entries()) {
            if (attId !== '__none__') {
              await supabaseAdmin.from('notifications').insert({
                tenant_id: t.tenant_id,
                profile_id: attId,
                title: '📋 Resumo do dia — pendências',
                message: `Você tem ${list.length} agendamento(s) sem resolução hoje. Resolva no CRM.`,
                type: 'in_app', category: 'lead_alert', link: '/kanban',
              });

              if (t.notify_attendant_whatsapp && wa?.is_active && wa?.instance_token) {
                const { data: prof } = await supabaseAdmin.from('profiles').select('phone, full_name').eq('id', attId).maybeSingle();
                if (prof?.phone) {
                  const lines = list.map((o: any) => `• ${o.lead_name ?? 'Lead'} — ${fmtTime(o.scheduled_at)}`).join('\n');
                  const text = `📋 *Resumo ${todayKey} — Fim do dia*\nOlá ${firstName(prof.full_name)}, você tem ${list.length} agendamento(s) sem confirmação:\n${lines}\nResolva agora no CRM.`;
                  await sendWhatsApp(wa.instance_token, prof.phone, text).catch(() => null);
                }
              }
            }
          }

          await supabaseAdmin.from('noshow_alerts').insert({
            tenant_id: t.tenant_id, appointment_id: (opens[0] as any).id, kind: 'daily_summary',
            scheduled_at: nowIso, status: 'sent', sent_at: nowIso, channel: 'both',
          });
          summariesSent++;
        }

        // 3) Recovery cadence for leads in noshow_recovery
        const { data: cadence } = await supabaseAdmin
          .from('noshow_alerts')
          .select('id, tenant_id, lead_id, kind, scheduled_at')
          .in('kind', ['recovery_t0', 'recovery_t48h', 'recovery_t7d'])
          .eq('status', 'pending')
          .lte('scheduled_at', nowIso)
          .limit(100);

        for (const c of cadence ?? []) {
          try {
            const [{ data: cfg2 }, { data: lead2 }, { data: wa2 }] = await Promise.all([
              supabaseAdmin.from('noshow_settings').select('*').eq('tenant_id', c.tenant_id).maybeSingle(),
              c.lead_id ? supabaseAdmin.from('leads').select('full_name, phone, status').eq('id', c.lead_id).maybeSingle() : Promise.resolve({ data: null as any }),
              supabaseAdmin.from('whatsapp_config').select('instance_token, is_active').eq('tenant_id', c.tenant_id).maybeSingle(),
            ]);

            if (!lead2 || !lead2.phone || !cfg2 || !wa2?.is_active || !wa2.instance_token) {
              await supabaseAdmin.from('noshow_alerts').update({ status: 'skipped', error_message: 'missing data' }).eq('id', c.id);
              continue;
            }
            const tpl =
              c.kind === 'recovery_t0' ? cfg2.recovery_msg_t0 :
              c.kind === 'recovery_t48h' ? cfg2.recovery_msg_t48h :
              cfg2.recovery_msg_t7d;
            const text = render(tpl, { nome: firstName(lead2.full_name) });
            const res = await sendWhatsApp(wa2.instance_token, lead2.phone, text);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            await supabaseAdmin.from('noshow_alerts').update({ status: 'sent', sent_at: nowIso, channel: 'whatsapp' }).eq('id', c.id);
          } catch (e: any) {
            await supabaseAdmin.from('noshow_alerts').update({ status: 'failed', error_message: String(e?.message ?? e).slice(0, 200) }).eq('id', c.id);
          }
        }

        return Response.json({
          ok: true,
          alerts_processed: due?.length ?? 0,
          sent, skipped, failed,
          summaries_sent: summariesSent,
        });
      },
    },
  },
});

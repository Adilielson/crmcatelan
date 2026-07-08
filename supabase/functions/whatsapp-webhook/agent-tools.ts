// Tools da agente IA: listar horários, criar agendamento, transferir p/ humano.
// Chamadas em loop pelo webhook via function-calling da OpenAI.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Supa = ReturnType<typeof createClient>;

const SLOT_MINUTES = 40; // duração padrão da consulta
const LOOKAHEAD_DAYS = 14;
const MAX_SLOTS_RETURNED = 6;

export const AGENT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "listar_horarios_disponiveis",
      description:
        "Lista horários livres para agendar consulta oftalmológica ou de optometria nos próximos 14 dias. Use SEMPRE antes de propor um horário ao cliente. Retorna até 6 slots. Se o cliente pediu preferência (ex: 'quinta a tarde'), passe data_preferida no formato YYYY-MM-DD.",
      parameters: {
        type: "object",
        properties: {
          data_preferida: {
            type: "string",
            description: "Data preferida no formato YYYY-MM-DD (opcional).",
          },
          periodo: {
            type: "string",
            enum: ["manha", "tarde", "qualquer"],
            description: "Preferência de período. Default: qualquer.",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "criar_agendamento",
      description:
        "Cria o agendamento no sistema DEPOIS que o cliente confirmou explicitamente um horário retornado por listar_horarios_disponiveis. Nunca invente horários. Nunca chame sem confirmação do cliente.",
      parameters: {
        type: "object",
        required: ["scheduled_at_iso", "tipo_consulta"],
        properties: {
          scheduled_at_iso: {
            type: "string",
            description: "Horário exato em ISO 8601 (ex: 2026-07-10T14:00:00-03:00). Copie de um slot retornado por listar_horarios_disponiveis.",
          },
          tipo_consulta: {
            type: "string",
            description: "Nome do tipo (ex: 'Optometrista' ou 'Oftalmológica').",
          },
          observacao: {
            type: "string",
            description: "Notas do agendamento (opcional).",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "transferir_para_humano",
      description:
        "Transfere a conversa para um atendente humano. Use APENAS em: reclamação séria, dúvida clínica complexa, pedido explícito de 'falar com humano/atendente', ou situação fora do escopo. Cria notificação para a equipe.",
      parameters: {
        type: "object",
        required: ["motivo"],
        properties: {
          motivo: {
            type: "string",
            description: "Motivo curto (ex: 'reclamação sobre lente', 'quer negociar preço').",
          },
        },
      },
    },
  },
];

// ── Utilitários de horário comercial ────────────────────────────────────
type Hours = {
  weekday: number;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
};

type Blocked = {
  blocked_date: string; // YYYY-MM-DD
  all_day: boolean;
  block_start: string | null;
  block_end: string | null;
};

function toMin(t: string): number {
  const [h, m] = t.split(":").map((n) => parseInt(n, 10));
  return h * 60 + (m || 0);
}

function fmtMin(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Constrói um Date ISO no fuso do tenant (offset simplificado: -03:00 padrão BR).
function isoAt(dateStr: string, minutes: number, tzOffset = "-03:00"): string {
  return `${dateStr}T${fmtMin(minutes)}:00${tzOffset}`;
}

function ptWeekday(date: string): string {
  const d = new Date(date + "T12:00:00Z");
  const wk = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][d.getUTCDay()];
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${wk} ${dd}/${mm}`;
}

// Gera candidatos e filtra por bloqueios + colisões com appointments existentes.
async function listAvailableSlots(
  admin: Supa,
  tenantId: string,
  opts: { data_preferida?: string; periodo?: string },
): Promise<{ iso: string; label: string }[]> {
  const { data: hoursRows } = await admin
    .from("agenda_business_hours")
    .select("weekday,is_open,open_time,close_time,lunch_start,lunch_end")
    .eq("tenant_id", tenantId);
  const hoursByDow = new Map<number, Hours>();
  for (const h of (hoursRows ?? []) as any[]) {
    hoursByDow.set(h.weekday as number, h as Hours);
  }

  const today = new Date();
  const startDate = opts.data_preferida
    ? new Date(opts.data_preferida + "T00:00:00Z")
    : today;
  const startDateStr = dateOnly(startDate < today ? today : startDate);

  const endDate = addDays(new Date(startDateStr + "T00:00:00Z"), LOOKAHEAD_DAYS);

  const { data: blockedRows } = await admin
    .from("agenda_blocked_dates")
    .select("blocked_date,all_day,block_start,block_end")
    .eq("tenant_id", tenantId)
    .gte("blocked_date", startDateStr)
    .lte("blocked_date", dateOnly(endDate));

  const blockedByDate = new Map<string, Blocked[]>();
  for (const b of (blockedRows ?? []) as any[]) {
    const key = b.blocked_date as string;
    if (!blockedByDate.has(key)) blockedByDate.set(key, []);
    blockedByDate.get(key)!.push(b as Blocked);
  }

  // NOTA: atendimento é rápido e permite paralelismo — não filtramos por
  // colisão. Todos os slots do horário comercial (fora de bloqueios/almoço)
  // são ofertados; se o cliente pedir um horário específico, a IA deve
  // adaptar (ex.: 15:10 se 15:00 estiver "cheio" na percepção humana).


  const wantMorning = opts.periodo === "manha";
  const wantAfternoon = opts.periodo === "tarde";

  const slots: { iso: string; label: string }[] = [];
  for (let i = 0; i < LOOKAHEAD_DAYS && slots.length < MAX_SLOTS_RETURNED; i++) {
    const dayDate = addDays(new Date(startDateStr + "T12:00:00Z"), i);
    const dayStr = dateOnly(dayDate);
    const dow = dayDate.getUTCDay();
    const h = hoursByDow.get(dow);
    if (!h || !h.is_open || !h.open_time || !h.close_time) continue;

    const dayBlocks = blockedByDate.get(dayStr) ?? [];
    if (dayBlocks.some((b) => b.all_day)) continue;

    let cursor = toMin(h.open_time);
    const close = toMin(h.close_time);
    const lunchS = h.lunch_start ? toMin(h.lunch_start) : null;
    const lunchE = h.lunch_end ? toMin(h.lunch_end) : null;

    while (cursor + SLOT_MINUTES <= close && slots.length < MAX_SLOTS_RETURNED) {
      const slotStart = cursor;
      const slotEnd = cursor + SLOT_MINUTES;

      // Almoço
      if (lunchS !== null && lunchE !== null && slotStart < lunchE && slotEnd > lunchS) {
        cursor = lunchE;
        continue;
      }

      // Bloqueio parcial
      const conflictBlock = dayBlocks.some((b) => {
        if (b.all_day || !b.block_start || !b.block_end) return false;
        return slotStart < toMin(b.block_end) && slotEnd > toMin(b.block_start);
      });
      if (conflictBlock) {
        cursor += SLOT_MINUTES;
        continue;
      }

      // Período preferido
      if (wantMorning && slotStart >= 12 * 60) { cursor += SLOT_MINUTES; continue; }
      if (wantAfternoon && slotStart < 12 * 60) { cursor += SLOT_MINUTES; continue; }

      const iso = isoAt(dayStr, slotStart);
      const startMs = new Date(iso).getTime();
      const endMs = startMs + SLOT_MINUTES * 60_000;

      // Passado (para hoje)
      if (startMs < Date.now() + 60 * 60_000) {
        cursor += SLOT_MINUTES;
        continue;
      }

      // Colisão com appointment existente
      const collides = busy.some((b) => startMs < b.end && endMs > b.start);
      if (collides) {
        cursor += SLOT_MINUTES;
        continue;
      }

      slots.push({
        iso,
        label: `${ptWeekday(dayStr)} às ${fmtMin(slotStart)}`,
      });
      cursor += SLOT_MINUTES;
    }
  }
  return slots;
}

async function createAppointment(
  admin: Supa,
  ctx: { tenantId: string; leadId: string | null; leadName: string | null; leadPhone: string },
  args: { scheduled_at_iso: string; tipo_consulta: string; observacao?: string },
): Promise<{ ok: boolean; message: string; appointment_id?: string }> {
  if (!ctx.leadId) return { ok: false, message: "Lead não identificado no sistema." };

  const scheduled = new Date(args.scheduled_at_iso);
  if (isNaN(scheduled.getTime())) return { ok: false, message: "Data inválida." };
  if (scheduled.getTime() < Date.now()) return { ok: false, message: "Não é possível agendar no passado." };

  // Revalida colisão (defesa em profundidade)
  const startMs = scheduled.getTime();
  const endMs = startMs + SLOT_MINUTES * 60_000;
  const { data: colliding } = await admin
    .from("appointments")
    .select("id")
    .eq("tenant_id", ctx.tenantId)
    .in("status", ["pending", "confirmed", "in_progress"])
    .gte("scheduled_at", new Date(startMs - SLOT_MINUTES * 60_000).toISOString())
    .lte("scheduled_at", new Date(endMs).toISOString());
  if (colliding && colliding.length > 0) {
    return { ok: false, message: "Esse horário já foi ocupado. Peça outro." };
  }

  // Tipo de consulta (opcional; se não existir, cria appointment sem consultation_type_id)
  const { data: types } = await admin
    .from("consultation_types")
    .select("id,name")
    .eq("tenant_id", ctx.tenantId)
    .eq("is_active", true);
  const norm = args.tipo_consulta.trim().toLowerCase();
  const match = (types ?? []).find(
    (t: any) => (t.name as string).toLowerCase().includes(norm) || norm.includes((t.name as string).toLowerCase()),
  );

  const { data: inserted, error } = await admin
    .from("appointments")
    .insert({
      tenant_id: ctx.tenantId,
      lead_id: ctx.leadId,
      lead_name: ctx.leadName,
      scheduled_at: scheduled.toISOString(),
      end_at: new Date(endMs).toISOString(),
      status: "pending",
      type_exam: args.tipo_consulta,
      consultation_type_id: (match as any)?.id ?? null,
      notes: args.observacao ?? null,
      origin: "ai_whatsapp",
      created_by_ai: true,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, message: `Erro ao salvar: ${error.message}` };
  }

  // Move lead para 'scheduled'
  await admin
    .from("leads")
    .update({ status: "scheduled", custom_column_id: null, updated_at: new Date().toISOString() })
    .eq("id", ctx.leadId);

  return {
    ok: true,
    message: "Agendamento criado com sucesso.",
    appointment_id: (inserted as any).id,
  };
}

async function transferToHuman(
  admin: Supa,
  ctx: { tenantId: string; leadId: string | null; leadName: string | null; leadPhone: string },
  args: { motivo: string },
): Promise<{ ok: boolean; message: string }> {
  if (!ctx.leadId) return { ok: false, message: "Lead não identificado." };

  await admin
    .from("leads")
    .update({
      status: "in_progress",
      custom_column_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ctx.leadId);

  // Notifica admins/managers do tenant
  const { data: admins } = await admin
    .from("profiles")
    .select("id")
    .eq("tenant_id", ctx.tenantId)
    .in("role", ["admin", "super_admin", "manager"])
    .eq("status", "active");

  for (const a of (admins ?? []) as any[]) {
    await admin.from("notifications").insert({
      tenant_id: ctx.tenantId,
      profile_id: a.id,
      title: "IA transferiu conversa para humano",
      message: `${ctx.leadName ?? ctx.leadPhone}: ${args.motivo}`,
      type: "in_app",
      category: "lead_alert",
      link: `/chat?phone=${ctx.leadPhone}`,
    });
  }

  return { ok: true, message: "Conversa transferida para atendente humano." };
}

export async function executeToolCall(
  admin: Supa,
  ctx: { tenantId: string; leadId: string | null; leadName: string | null; leadPhone: string },
  name: string,
  argsJson: string,
): Promise<string> {
  let args: any = {};
  try { args = JSON.parse(argsJson || "{}"); } catch { args = {}; }

  try {
    if (name === "listar_horarios_disponiveis") {
      const slots = await listAvailableSlots(admin, ctx.tenantId, args);
      if (slots.length === 0) {
        return JSON.stringify({
          ok: false,
          message: "Nenhum horário livre nos próximos 14 dias com esses critérios.",
        });
      }
      return JSON.stringify({ ok: true, slots });
    }
    if (name === "criar_agendamento") {
      const res = await createAppointment(admin, ctx, args);
      return JSON.stringify(res);
    }
    if (name === "transferir_para_humano") {
      const res = await transferToHuman(admin, ctx, args);
      return JSON.stringify(res);
    }
    return JSON.stringify({ ok: false, message: `Tool desconhecida: ${name}` });
  } catch (e) {
    return JSON.stringify({
      ok: false,
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

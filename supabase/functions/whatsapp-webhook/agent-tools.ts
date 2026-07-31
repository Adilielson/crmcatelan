// Tools da agente IA: listar horários, criar agendamento, transferir p/ humano.
// Chamadas em loop pelo webhook via function-calling da OpenAI.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Supa = ReturnType<typeof createClient>;

const DEFAULT_SLOT_MINUTES = 40; // fallback quando o tipo de exame não define
const LOOKAHEAD_DAYS = 21;
const MAX_SLOTS_RETURNED = 6;

// ── Regras de capacidade (definidas com o dono da Ótica) ────────────────
// Seg/Ter/Qui/Sex: até 8 consultas/dia, máx 2 no mesmo horário cheio (encaixes 10 em 10min).
// Quarta e Sábado: dia de alto volume, até 20 consultas/dia, sem limite por horário.
// Domingo: fechado (já filtrado pelo horário da loja).
// Feriados: nunca agendar — cadastrados manualmente em agenda_blocked_dates (all_day=true).
const DAILY_CAP_NORMAL = 8;
const DAILY_CAP_HIGH = 20;
const PER_HOUR_CAP_NORMAL = 2;
const HIGH_VOLUME_WEEKDAYS = new Set<number>([3, 6]); // 3 = quarta, 6 = sábado

function normalizeExamName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// Fonte de verdade dos tipos ofertáveis: consultation_types.is_active (banco).
// Nada de regex hardcoded por nome — se um exame não deve ser ofertado, desative no cadastro.
function pickDefaultConsultationType<T extends { name?: string | null }>(types: T[], requested?: string | null): T | null {
  const pool = types;
  const norm = normalizeExamName(requested ?? "");
  if (norm) {
    const match = pool.find((t) => {
      const name = normalizeExamName(String(t.name ?? ""));
      return name.includes(norm) || norm.includes(name);
    });
    if (match) return match;
  }
  return pool[0] ?? null;
}


// Retorna { dayStr:'YYYY-MM-DD', weekday:0-6 } no fuso do tenant.
function localDayInfo(iso: string | Date, tz: string): { dayStr: string; weekday: number } {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const day = parts.find((p) => p.type === "day")!.value;
  const wkMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const wk = wkMap[parts.find((p) => p.type === "weekday")!.value] ?? 0;
  return { dayStr: `${y}-${m}-${day}`, weekday: wk };
}

async function getTenantTimezone(admin: Supa, tenantId: string): Promise<string> {
  const { data } = await admin.from("tenants").select("timezone").eq("id", tenantId).maybeSingle();
  return ((data as any)?.timezone as string) || "America/Sao_Paulo";
}

function dailyCapFor(weekday: number): number {
  return HIGH_VOLUME_WEEKDAYS.has(weekday) ? DAILY_CAP_HIGH : DAILY_CAP_NORMAL;
}

// Valida a data recebida do LLM. NÃO reescreve silenciosamente o ano:
// se vier no passado ou muito distante, devolve erro para a IA confirmar com o cliente.
function validateRequestedDate(input: Date): { ok: boolean; reason?: string } {
  if (isNaN(input.getTime())) {
    return { ok: false, reason: "Data inválida. Use ISO 8601 com offset (ex: 2026-08-05T15:10:00-03:00)." };
  }
  const now = Date.now();
  if (input.getTime() < now) {
    return {
      ok: false,
      reason:
        "Essa data/hora já passou. Confirme com o cliente o DIA e o ANO corretos e chame a ferramenta de novo com uma data futura real.",
    };
  }
  if (input.getTime() > now + 90 * 24 * 60 * 60_000) {
    return {
      ok: false,
      reason:
        "Data acima de 90 dias no futuro. Confirme com o cliente o dia/mês/ano exatos antes de tentar de novo.",
    };
  }
  return { ok: true };
}

// Marca como no_show os agendamentos vencidos (>2h) APENAS do lead em questão.
// Nunca varre o tenant inteiro. Registra auditoria de cada mudança.
async function autoMarkPastNoShowsForLead(admin: Supa, tenantId: string, leadId: string): Promise<void> {
  const cutoff = new Date(Date.now() - 2 * 60 * 60_000).toISOString();
  try {
    const { data } = await admin
      .from("appointments")
      .update({ status: "no_show", updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("lead_id", leadId)
      .in("status", ["pending", "confirmed"])
      .lt("scheduled_at", cutoff)
      .select("id, scheduled_at, status");
    for (const row of (data ?? []) as any[]) {
      console.log(
        `[agenda] auto no_show lead=${leadId} appt=${row.id} scheduled_at=${row.scheduled_at}`,
      );
    }
  } catch (_e) { /* não bloqueia o fluxo se falhar */ }
}

// ── Fuso do tenant ──────────────────────────────────────────────────────
function tzOffsetMinutes(d: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return Math.round((asUtc - d.getTime()) / 60_000);
}

/** ISO absoluto (UTC) do minuto local `minutes` no dia `dayStr` do fuso `tz`. */
function isoAtTz(dayStr: string, minutes: number, tz: string): string {
  const naive = Date.parse(`${dayStr}T${fmtMin(minutes)}:00Z`);
  let off = tzOffsetMinutes(new Date(`${dayStr}T12:00:00Z`), tz);
  let ms = naive - off * 60_000;
  off = tzOffsetMinutes(new Date(ms), tz);
  ms = naive - off * 60_000;
  return new Date(ms).toISOString();
}

/** dia/semana/minuto local no fuso do tenant. */
function localSlotInfo(iso: string | Date, tz: string): { dayStr: string; weekday: number; minutes: number } {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const base = localDayInfo(d, tz);
  const hm = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  const [h, m] = hm.split(":").map((n) => parseInt(n, 10));
  return { ...base, minutes: h * 60 + m };
}

const MIN_LEAD_MINUTES = 20;

export interface SlotCheck {
  ok: boolean;
  reason?: string;
  slotMinutes: number;
  consultationTypeId: string | null;
  consultationTypeName: string | null;
  tz: string;
}

/**
 * ÚNICA fonte de verdade para "esse horário pode ser agendado?".
 * Usada por createAppointment e rescheduleAppointment (e espelhada por listAvailableSlots).
 * Ordem: passado/antecedência → horário da loja (incl. almoço) → janela do exame
 * → exceções por data → bloqueios (all_day e parciais) → capacidade diária → capacidade por hora.
 */
export async function isSlotBookable(
  admin: Supa,
  params: {
    tenantId: string;
    consultationTypeId?: string | null;
    requestedTypeName?: string | null;
    startsAt: Date;
    tz?: string;
    ignoreAppointmentId?: string | null;
  },
): Promise<SlotCheck> {
  const { tenantId, startsAt } = params;
  const tz = params.tz ?? (await getTenantTimezone(admin, tenantId));
  let slotMinutes = DEFAULT_SLOT_MINUTES;
  let typeId: string | null = params.consultationTypeId ?? null;
  let typeName: string | null = null;
  const fail = (reason: string): SlotCheck => ({ ok: false, reason, slotMinutes, consultationTypeId: typeId, consultationTypeName: typeName, tz });

  const dateCheck = validateRequestedDate(startsAt);
  if (!dateCheck.ok) return fail(dateCheck.reason!);
  if (startsAt.getTime() < Date.now() + MIN_LEAD_MINUTES * 60_000) {
    return fail(`Precisa de pelo menos ${MIN_LEAD_MINUTES} minutos de antecedência. Ofereça o próximo horário disponível.`);
  }

  const local = localSlotInfo(startsAt, tz);

  // 1) tipo de exame ativo
  const { data: types } = await admin
    .from("consultation_types")
    .select("id,name,default_value")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);
  const activeTypes = (types ?? []) as any[];
  const type = typeId
    ? activeTypes.find((t) => t.id === typeId) ?? null
    : pickDefaultConsultationType(activeTypes, params.requestedTypeName);
  if (!type) return fail("Nenhum tipo de exame ativo cadastrado na agenda. Transfira para um atendente.");
  typeId = type.id;
  typeName = type.name ?? null;

  // 2) horário da loja
  const { data: storeRow } = await admin
    .from("agenda_business_hours")
    .select("is_open,open_time,close_time,lunch_start,lunch_end")
    .eq("tenant_id", tenantId)
    .eq("weekday", local.weekday)
    .maybeSingle();
  const store = storeRow as any;
  if (!store || !store.is_open || !store.open_time || !store.close_time) {
    return fail(`A loja não atende em ${local.dayStr}. Ofereça outro dia.`);
  }

  // 3) janela do exame + exceção por data
  const { data: examRow } = await admin
    .from("consultation_type_hours")
    .select("is_active,start_time,end_time,slot_minutes,saturday_recurrence")
    .eq("tenant_id", tenantId)
    .eq("consultation_type_id", typeId)
    .eq("weekday", local.weekday)
    .maybeSingle();
  const exam = examRow as any;
  const { data: ovRow } = await admin
    .from("consultation_type_date_overrides")
    .select("is_available,start_time,end_time")
    .eq("tenant_id", tenantId)
    .eq("consultation_type_id", typeId)
    .eq("override_date", local.dayStr)
    .maybeSingle();
  const ov = ovRow as any;

  let examStart: string | null = null;
  let examEnd: string | null = null;
  if (ov) {
    if (!ov.is_available) return fail(`Não há atendimento em ${local.dayStr} (exceção cadastrada na agenda). Ofereça outro dia.`);
    examStart = ov.start_time ?? exam?.start_time ?? null;
    examEnd = ov.end_time ?? exam?.end_time ?? null;
    slotMinutes = exam?.slot_minutes ?? DEFAULT_SLOT_MINUTES;
  } else {
    if (!exam || !exam.is_active || !exam.start_time || !exam.end_time) {
      return fail(`Não há atendimento de exame em ${local.dayStr}. Ofereça um dia com agenda aberta.`);
    }
    if (local.weekday === 6 && exam.saturday_recurrence && exam.saturday_recurrence !== "all") {
      if (exam.saturday_recurrence === "none") return fail("Não há atendimento aos sábados nessa agenda. Ofereça um dia útil.");
      const parity = isoWeekNumber(local.dayStr) % 2 === 0 ? "even" : "odd";
      if (exam.saturday_recurrence !== parity) return fail(`Esse sábado (${local.dayStr}) não está na escala. Ofereça outro dia.`);
    }
    examStart = exam.start_time;
    examEnd = exam.end_time;
    slotMinutes = exam.slot_minutes ?? DEFAULT_SLOT_MINUTES;
  }
  if (!examStart || !examEnd) return fail(`Sem janela de atendimento configurada para ${local.dayStr}.`);

  const slotStart = local.minutes;
  const slotEnd = slotStart + slotMinutes;
  const windowStart = Math.max(toMin(store.open_time), toMin(examStart));
  const windowEnd = Math.min(toMin(store.close_time), toMin(examEnd));
  if (slotStart < windowStart || slotEnd > windowEnd) {
    return fail(
      `Fora da janela de atendimento desse dia (${fmtMin(windowStart)}–${fmtMin(windowEnd)}). Ofereça um horário dentro dessa faixa.`,
    );
  }

  // almoço
  const lunchS = store.lunch_start ? toMin(store.lunch_start) : null;
  const lunchE = store.lunch_end ? toMin(store.lunch_end) : null;
  if (lunchS !== null && lunchE !== null && slotStart < lunchE && slotEnd > lunchS) {
    return fail(`Esse horário cai no intervalo de almoço (${fmtMin(lunchS)}–${fmtMin(lunchE)}). Ofereça outro horário.`);
  }

  // 4) bloqueios (all_day e parciais)
  const { data: blockedRows } = await admin
    .from("agenda_blocked_dates")
    .select("all_day,block_start,block_end,reason")
    .eq("tenant_id", tenantId)
    .eq("blocked_date", local.dayStr);
  const dayBlocks = (blockedRows ?? []) as any[];
  if (dayBlocks.some((b) => b.all_day)) {
    return fail(`Não há atendimento em ${local.dayStr} (feriado ou dia bloqueado). Ofereça outro dia.`);
  }
  const partial = dayBlocks.find(
    (b) => !b.all_day && b.block_start && b.block_end && slotStart < toMin(b.block_end) && slotEnd > toMin(b.block_start),
  );
  if (partial) {
    return fail(`Esse horário está bloqueado na agenda (${String(partial.block_start).slice(0, 5)}–${String(partial.block_end).slice(0, 5)}). Ofereça outro horário.`);
  }

  // 5) capacidade (dia e hora cheia local)
  const rangeStart = new Date(startsAt.getTime() - 36 * 3600_000).toISOString();
  const rangeEnd = new Date(startsAt.getTime() + 36 * 3600_000).toISOString();
  const { data: dayAppts } = await admin
    .from("appointments")
    .select("id, scheduled_at")
    .eq("tenant_id", tenantId)
    .in("status", ["pending", "confirmed"])
    .gte("scheduled_at", rangeStart)
    .lte("scheduled_at", rangeEnd);

  const sameLocalDay = ((dayAppts ?? []) as any[])
    .filter((a) => a.id !== params.ignoreAppointmentId)
    .map((a) => ({ id: a.id, ...localSlotInfo(a.scheduled_at as string, tz) }))
    .filter((a) => a.dayStr === local.dayStr);

  const cap = dailyCapFor(local.weekday);
  if (sameLocalDay.length >= cap) {
    return fail(`Capacidade do dia ${local.dayStr} atingida (${cap} consultas). Ofereça outro dia.`);
  }

  if (!HIGH_VOLUME_WEEKDAYS.has(local.weekday)) {
    const hour = Math.floor(slotStart / 60);
    const sameHour = sameLocalDay.filter((a) => Math.floor(a.minutes / 60) === hour);
    if (sameHour.length >= PER_HOUR_CAP_NORMAL) {
      return fail(
        `O bloco das ${fmtMin(hour * 60)} já tem ${PER_HOUR_CAP_NORMAL} consultas. Ofereça outro bloco de horário no mesmo dia ou outro dia.`,
      );
    }
  }

  return { ok: true, slotMinutes, consultationTypeId: typeId, consultationTypeName: typeName, tz };
}


export const AGENT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "listar_horarios_disponiveis",
      description:
        "OBRIGATÓRIO chamar antes de propor qualquer horário. Lista horários livres do profissional que atende os exames de vista na Ótica Catelan, cruzando: horário da loja + janela de atendimento + bloqueios + exceções por data. NUNCA invente ou sugira horários sem chamar esta função. Se o cliente pedir um horário que não retornar aqui, informe que não há atendimento nesse horário.",
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
        "Cria o agendamento no sistema DEPOIS que o cliente confirmou explicitamente um horário. IMPORTANTE: o horário pode ser QUALQUER minuto dentro do horário comercial (ex.: 15:10, 15:25). Se o cliente pedir um horário específico que NÃO apareceu na lista de slots, você pode agendar mesmo assim, contanto que esteja dentro do horário comercial e não seja no passado. Só recuse se estiver fora do horário comercial, em bloqueio ou no passado.",
      parameters: {
        type: "object",
        required: ["scheduled_at_iso"],
        properties: {
          scheduled_at_iso: {
            type: "string",
            description: "Horário exato em ISO 8601 com offset -03:00 (ex: 2026-07-10T15:10:00-03:00). Pode ser um slot da lista OU um horário customizado que o cliente pediu, desde que esteja dentro do horário comercial.",
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
      name: "remarcar_agendamento",
      description:
        "Remarca (reagenda) um agendamento EXISTENTE do lead para um novo horário. USE ESTA FERRAMENTA sempre que o cliente pedir para 'remarcar', 'mudar o horário', 'trocar para outra hora/dia' um agendamento que já foi criado. NUNCA chame criar_agendamento nesse caso — isso duplicaria o registro. Se não passar appointment_id, o sistema remarca automaticamente o próximo agendamento futuro pendente/confirmado do lead.",
      parameters: {
        type: "object",
        required: ["novo_horario_iso"],
        properties: {
          appointment_id: {
            type: "string",
            description: "ID do agendamento a remarcar (opcional). Se omitido, remarca o próximo agendamento futuro pendente/confirmado do lead.",
          },
          novo_horario_iso: {
            type: "string",
            description: "Novo horário em ISO 8601 com offset -03:00 (ex: 2026-07-10T10:00:00-03:00).",
          },
          motivo: {
            type: "string",
            description: "Motivo da remarcação (opcional).",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "cancelar_agendamento",
      description:
        "Cancela um agendamento existente do lead. Use quando o cliente pedir para cancelar/desmarcar. Se não passar appointment_id, cancela o próximo agendamento futuro pendente/confirmado.",
      parameters: {
        type: "object",
        properties: {
          appointment_id: {
            type: "string",
            description: "ID do agendamento a cancelar (opcional).",
          },
          motivo: {
            type: "string",
            description: "Motivo do cancelamento (opcional).",
          },
        },
      },
    },
  },

  {
    type: "function" as const,
    function: {
      name: "atualizar_qualificacao_lead",
      description:
        "Salva no CRM as informações de qualificação que o cliente forneceu na conversa. CHAME SEMPRE que o cliente responder qualquer pergunta relevante (nome, idade, uso de óculos, tipo de armação/lente que procura, dificuldade visual, último exame, receita, urgência, objeção, QUEM é o paciente, preferências de horário, restrições de agenda, etc). Não espere ter tudo — envie campo a campo conforme aparecer. Só envie campos que o cliente REALMENTE disse; nunca invente. Pode chamar múltiplas vezes na mesma conversa. IMPORTANTE: esta é uma ÓTICA — nunca pergunte sobre plano de saúde/convênio; o atendimento é sempre particular.",
      parameters: {
        type: "object",
        properties: {
          nome: { type: "string", description: "Nome do CONTATO do WhatsApp (quem está conversando)." },
          idade: { type: "integer", description: "Idade em anos, se mencionada (do paciente)." },
          usa_oculos: { type: "boolean", description: "Paciente usa óculos hoje?" },
          dificuldade_visual: {
            type: "string",
            description: "Sintomas relatados (ex.: 'não enxerga de longe', 'dor de cabeça ao ler', 'vista cansada').",
          },
          ultimo_exame: {
            type: "string",
            description: "Quando fez o último exame (texto livre: 'ano passado', 'nunca', '2 anos').",
          },
          tem_receita: { type: "boolean", description: "Tem receita recente?" },
          grau_receita: { type: "string", description: "Grau da receita se citado (ex.: '-1,25 / -1,50 cil')." },
          tipo_produto: { type: "string", description: "Tipo de produto/lente/armação de interesse (ex.: 'multifocal', 'monofocal', 'óculos de sol', 'transitions', 'armação titânio', 'lente de contato')." },
          urgencia: {
            type: "string",
            enum: ["baixa", "media", "alta"],
            description: "Nível de urgência inferido da conversa.",
          },
          interesses: {
            type: "array",
            items: { type: "string" },
            description: "Interesses/objetivos citados (ex.: 'lente multifocal', 'óculos de sol', 'transitions', 'armação titânio').",
          },
          objecao: {
            type: "string",
            description: "Objeção principal que o cliente levantou (ex.: 'preço alto', 'sem tempo', 'quer pesquisar').",
          },
          paciente_nome: {
            type: "string",
            description: "Nome do PACIENTE que fará o exame, quando for DIFERENTE do contato do WhatsApp (ex.: contato é a esposa e o paciente é o marido). NUNCA preencha com o mesmo nome do contato — deixe vazio se o próprio contato for o paciente.",
          },
          paciente_relacao: {
            type: "string",
            description: "Relação do paciente com o contato (ex.: 'esposo', 'esposa', 'filho', 'filha', 'mãe', 'pai', 'irmão', 'amigo'). Só preencha se paciente_nome também for informado.",
          },
          paciente_idade: {
            type: "integer",
            description: "Idade do paciente em anos, quando ele NÃO é o contato do WhatsApp.",
          },
          preferencia_horario: {
            type: "string",
            description: "Preferência EXPLÍCITA de horário do cliente (ex.: 'último horário do dia', 'depois das 17h', 'de manhã cedo', 'só à tarde', 'horário do almoço'). Registre a fala do cliente, não invente.",
          },
          restricoes_agenda: {
            type: "string",
            description: "Restrições de agenda que o cliente citou (ex.: 'não pode segunda por causa do trabalho', 'só sábado', 'evitar sexta', 'não pode antes das 15h'). Registre a fala do cliente, não invente.",
          },
          notas: {
            type: "string",
            description: "Qualquer informação extra relevante ao contexto do lead.",
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

/** YYYY-MM-DD de um Date "calendário" (sempre construído ao meio-dia UTC). */
function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}


function ptWeekday(date: string): string {
  const d = new Date(date + "T12:00:00Z");
  const wk = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][d.getUTCDay()];
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${wk} ${dd}/${mm}`;
}

// ISO week number (usado para "semanas pares/ímpares" do sábado do oftalmo)
function isoWeekNumber(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00Z");
  const target = new Date(d.valueOf());
  const dayNr = (d.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / (7 * 24 * 3600 * 1000));
}

type ExamHour = {
  weekday: number;
  is_active: boolean;
  start_time: string | null;
  end_time: string | null;
  slot_minutes: number;
  saturday_recurrence: string;
};

type ExamOverride = {
  override_date: string;
  is_available: boolean;
  start_time: string | null;
  end_time: string | null;
};

// Gera candidatos filtrando por: horário da loja ∩ janela do exame ∩ bloqueios ∩ recorrência do sábado ∩ exceções.
export async function listAvailableSlots(
  admin: Supa,
  tenantId: string,
  opts: { tipo_exame?: string; data_preferida?: string; periodo?: string },
): Promise<{ iso: string; label: string; exam?: string }[]> {
  // 1) horário da loja
  const { data: hoursRows } = await admin
    .from("agenda_business_hours")
    .select("weekday,is_open,open_time,close_time,lunch_start,lunch_end")
    .eq("tenant_id", tenantId);
  const storeByDow = new Map<number, Hours>();
  for (const h of (hoursRows ?? []) as any[]) storeByDow.set(h.weekday as number, h as Hours);

  // 2) tipo de exame (obrigatório)
  const { data: types } = await admin
    .from("consultation_types")
    .select("id,name")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);
  const activeTypes = (types ?? []) as any[];
  const type = pickDefaultConsultationType(activeTypes, opts.tipo_exame);
  if (!type) {
    return [];
  }


  // 3) janelas do exame por dia da semana
  const { data: examRows } = await admin
    .from("consultation_type_hours")
    .select("weekday,is_active,start_time,end_time,slot_minutes,saturday_recurrence")
    .eq("tenant_id", tenantId)
    .eq("consultation_type_id", type.id);
  const examByDow = new Map<number, ExamHour>();
  for (const e of (examRows ?? []) as any[]) examByDow.set(e.weekday as number, e as ExamHour);

  const tz = await getTenantTimezone(admin, tenantId);
  const todayStr = localDayInfo(new Date(), tz).dayStr;
  const requestedStr = opts.data_preferida && /^\d{4}-\d{2}-\d{2}$/.test(opts.data_preferida)
    ? opts.data_preferida
    : todayStr;
  const startDateStr = requestedStr < todayStr ? todayStr : requestedStr;
  const endDate = addDays(new Date(startDateStr + "T12:00:00Z"), LOOKAHEAD_DAYS);


  // 4) bloqueios de agenda
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

  // 5) exceções por data do exame
  const { data: overrideRows } = await admin
    .from("consultation_type_date_overrides")
    .select("override_date,is_available,start_time,end_time")
    .eq("tenant_id", tenantId)
    .eq("consultation_type_id", type.id)
    .gte("override_date", startDateStr)
    .lte("override_date", dateOnly(endDate));
  const overrideByDate = new Map<string, ExamOverride>();
  for (const o of (overrideRows ?? []) as any[]) overrideByDate.set(o.override_date as string, o as ExamOverride);

  // 6) capacidade: agendamentos ativos no período (para não ofertar dia/horário cheio)
  // Bucketiza SEMPRE no fuso do tenant — scheduled_at vem em UTC.
  const rangeStartIso = new Date(new Date(startDateStr + "T12:00:00Z").getTime() - 36 * 3600_000).toISOString();
  const rangeEndIso = new Date(addDays(endDate, 1).getTime() + 36 * 3600_000).toISOString();
  const { data: apptRows } = await admin
    .from("appointments")
    .select("scheduled_at")
    .eq("tenant_id", tenantId)
    .in("status", ["pending", "confirmed"])
    .gte("scheduled_at", rangeStartIso)
    .lte("scheduled_at", rangeEndIso);
  const countsByDay = new Map<string, number>();
  const countsByHour = new Map<string, number>(); // key = `${dayStr} ${HH}` — hora cheia local, todos os minutos
  for (const a of (apptRows ?? []) as any[]) {
    const info = localSlotInfo(a.scheduled_at as string, tz);
    countsByDay.set(info.dayStr, (countsByDay.get(info.dayStr) ?? 0) + 1);
    const hourKey = `${info.dayStr} ${String(Math.floor(info.minutes / 60)).padStart(2, "0")}`;
    countsByHour.set(hourKey, (countsByHour.get(hourKey) ?? 0) + 1);
  }


  const wantMorning = opts.periodo === "manha";
  const wantAfternoon = opts.periodo === "tarde";

  const slots: { iso: string; label: string; exam?: string }[] = [];
  for (let i = 0; i < LOOKAHEAD_DAYS && slots.length < MAX_SLOTS_RETURNED; i++) {
    const dayDate = addDays(new Date(startDateStr + "T12:00:00Z"), i);
    const dayStr = dateOnly(dayDate);
    const dow = dayDate.getUTCDay();

    // loja aberta?
    const store = storeByDow.get(dow);
    if (!store || !store.is_open || !store.open_time || !store.close_time) continue;

    // bloqueio full-day (feriado)
    const dayBlocks = blockedByDate.get(dayStr) ?? [];
    if (dayBlocks.some((b) => b.all_day)) continue;

    // capacidade diária: 8 (dias normais) / 20 (quarta e sábado)
    const dailyCap = dailyCapFor(dow);
    if ((countsByDay.get(dayStr) ?? 0) >= dailyCap) continue;

    // exceção do exame
    const ov = overrideByDate.get(dayStr);
    let examStart: string | null = null;
    let examEnd: string | null = null;
    let slotMin = DEFAULT_SLOT_MINUTES;

    if (ov) {
      if (!ov.is_available) continue;
      const exam = examByDow.get(dow);
      examStart = ov.start_time ?? exam?.start_time ?? null;
      examEnd = ov.end_time ?? exam?.end_time ?? null;
      slotMin = exam?.slot_minutes ?? DEFAULT_SLOT_MINUTES;
    } else {
      const exam = examByDow.get(dow);
      if (!exam || !exam.is_active || !exam.start_time || !exam.end_time) continue;

      // recorrência de sábado
      if (dow === 6 && exam.saturday_recurrence && exam.saturday_recurrence !== "all") {
        if (exam.saturday_recurrence === "none") continue;
        const wk = isoWeekNumber(dayStr);
        const parity = wk % 2 === 0 ? "even" : "odd";
        if (exam.saturday_recurrence !== parity) continue;
      }
      examStart = exam.start_time;
      examEnd = exam.end_time;
      slotMin = exam.slot_minutes ?? DEFAULT_SLOT_MINUTES;
    }
    if (!examStart || !examEnd) continue;

    // interseção loja ∩ exame
    const windowStart = Math.max(toMin(store.open_time), toMin(examStart));
    const windowEnd = Math.min(toMin(store.close_time), toMin(examEnd));
    if (windowEnd <= windowStart) continue;

    let cursor = windowStart;
    const lunchS = store.lunch_start ? toMin(store.lunch_start) : null;
    const lunchE = store.lunch_end ? toMin(store.lunch_end) : null;

    while (cursor + slotMin <= windowEnd && slots.length < MAX_SLOTS_RETURNED) {
      const slotStart = cursor;
      const slotEnd = cursor + slotMin;

      // almoço
      if (lunchS !== null && lunchE !== null && slotStart < lunchE && slotEnd > lunchS) {
        cursor = lunchE;
        continue;
      }
      // bloqueio parcial
      const conflictBlock = dayBlocks.some((b) => {
        if (b.all_day || !b.block_start || !b.block_end) return false;
        return slotStart < toMin(b.block_end) && slotEnd > toMin(b.block_start);
      });
      if (conflictBlock) { cursor += slotMin; continue; }
      // período
      if (wantMorning && slotStart >= 12 * 60) { cursor += slotMin; continue; }
      if (wantAfternoon && slotStart < 12 * 60) { cursor += slotMin; continue; }

      // máx 2 por HORA CHEIA local (14:00–14:59) nos dias normais (seg/ter/qui/sex)
      if (!HIGH_VOLUME_WEEKDAYS.has(dow)) {
        const hourKey = `${dayStr} ${String(Math.floor(slotStart / 60)).padStart(2, "0")}`;
        if ((countsByHour.get(hourKey) ?? 0) >= PER_HOUR_CAP_NORMAL) { cursor += slotMin; continue; }
      }

      const iso = isoAtTz(dayStr, slotStart, tz);
      if (new Date(iso).getTime() < Date.now() + MIN_LEAD_MINUTES * 60_000) {
        cursor += slotMin;
        continue;
      }


      slots.push({
        iso,
        label: `${ptWeekday(dayStr)} às ${fmtMin(slotStart)}`,
        exam: (type as any).name,
      });
      cursor += slotMin;
    }
  }
  return slots;
}

async function createAppointment(
  admin: Supa,
  ctx: { tenantId: string; leadId: string | null; leadName: string | null; leadPhone: string },
  args: { scheduled_at_iso: string; tipo_consulta?: string; observacao?: string },
): Promise<{ ok: boolean; message: string; appointment_id?: string }> {
  if (!ctx.leadId) return { ok: false, message: "Lead não identificado no sistema." };


  const scheduled = new Date(args.scheduled_at_iso);
  const dateCheck = validateRequestedDate(scheduled);
  if (!dateCheck.ok) return { ok: false, message: dateCheck.reason! };

  // Limpa agenda APENAS deste lead: consultas vencidas (>2h) viram no_show
  // para não bloquearem um agendamento novo legítimo.
  await autoMarkPastNoShowsForLead(admin, ctx.tenantId, ctx.leadId);

  const startMs = scheduled.getTime();

  // ── Deduplicação: evita a IA criar múltiplos registros para o MESMO lead
  // no mesmo horário (janela ±5min) durante o loop de function-calling.
  const dedupWindowMs = 5 * 60_000;
  const { data: existingSame } = await admin
    .from("appointments")
    .select("id, scheduled_at, status")
    .eq("tenant_id", ctx.tenantId)
    .eq("lead_id", ctx.leadId)
    .in("status", ["pending", "confirmed"])
    .gte("scheduled_at", new Date(startMs - dedupWindowMs).toISOString())
    .lte("scheduled_at", new Date(startMs + dedupWindowMs).toISOString())
    .limit(1)
    .maybeSingle();
  if (existingSame) {
    return {
      ok: true,
      message: "Já existe agendamento ativo deste lead nesse horário — nada novo criado.",
      appointment_id: (existingSame as any).id,
    };
  }

  // Se o lead já tem outro agendamento REALMENTE FUTURO ativo em horário
  // diferente, orienta a IA a REMARCAR em vez de duplicar.
  const { data: existingOther } = await admin
    .from("appointments")
    .select("id, scheduled_at")
    .eq("tenant_id", ctx.tenantId)
    .eq("lead_id", ctx.leadId)
    .in("status", ["pending", "confirmed"])
    .gt("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existingOther) {
    return {
      ok: false,
      message: `Lead já tem agendamento futuro ativo (id=${(existingOther as any).id} em ${(existingOther as any).scheduled_at}). Use remarcar_agendamento com esse appointment_id em vez de criar outro.`,
      appointment_id: (existingOther as any).id,
    };
  }

  // ── Validação única do slot (mesma regra usada na listagem) ─────────────
  const check = await isSlotBookable(admin, {
    tenantId: ctx.tenantId,
    requestedTypeName: args.tipo_consulta ?? null,
    startsAt: scheduled,
  });
  if (!check.ok) return { ok: false, message: check.reason! };

  const endMs = startMs + check.slotMinutes * 60_000;

  // Tipo e valor resolvidos pela validação
  const { data: typeRow } = check.consultationTypeId
    ? await admin
        .from("consultation_types")
        .select("id,name,default_value")
        .eq("id", check.consultationTypeId)
        .maybeSingle()
    : { data: null as any };
  const match = typeRow as any;
  const resolvedTypeName = (match as any)?.name ?? args.tipo_consulta ?? null;



  // Unidade default: primeira do tenant (quando houver mais de uma, gestor pode reatribuir)
  const { data: unitRow } = await admin
    .from("units")
    .select("id,name")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  // Profissional default: primeiro ativo com papel clínico/atendente do tenant
  const { data: profRow } = await admin
    .from("profiles")
    .select("id,full_name")
    .eq("tenant_id", ctx.tenantId)
    .eq("status", "active")
    .in("role", ["consultant", "attendant", "manager", "admin"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  // Se houver paciente diferente do contato, usa o nome dele no agendamento (fica claro na agenda quem virá).
  const { data: leadRow2 } = await admin
    .from("leads")
    .select("full_name, patient_name, patient_relation")
    .eq("id", ctx.leadId)
    .maybeSingle();
  const patientName = ((leadRow2 as any)?.patient_name ?? "").trim();
  const contactName = ((leadRow2 as any)?.full_name ?? ctx.leadName ?? "").trim();
  const relation = ((leadRow2 as any)?.patient_relation ?? "").trim();
  const apptLeadName = patientName || contactName || ctx.leadName;
  const patientNoteParts: string[] = [];
  if (patientName && contactName && patientName.toLowerCase() !== contactName.toLowerCase()) {
    patientNoteParts.push(
      `Paciente: ${patientName}${relation ? ` (${relation} de ${contactName})` : ` — contato: ${contactName}`}`,
    );
  }
  if (args.observacao) patientNoteParts.push(args.observacao);
  const finalNotes = patientNoteParts.length ? patientNoteParts.join(" • ") : null;

  const { data: inserted, error } = await admin
    .from("appointments")
    .insert({
      tenant_id: ctx.tenantId,
      lead_id: ctx.leadId,
      lead_name: apptLeadName,
      unit_id: (unitRow as any)?.id ?? null,
      unit_name: (unitRow as any)?.name ?? null,
      professional_id: (profRow as any)?.id ?? null,
      scheduled_at: scheduled.toISOString(),
      end_at: new Date(endMs).toISOString(),
      status: "pending",
      type_exam: resolvedTypeName,
      consultation_type_id: (match as any)?.id ?? null,
      value: (match as any)?.default_value ?? null,
      notification_channel: "whatsapp",
      notes: finalNotes,
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

async function rescheduleAppointment(
  admin: Supa,
  ctx: { tenantId: string; leadId: string | null },
  args: { appointment_id?: string; novo_horario_iso: string; motivo?: string },
): Promise<{ ok: boolean; message: string; appointment_id?: string }> {
  if (!ctx.leadId) return { ok: false, message: "Lead não identificado." };
  const scheduled = new Date(args.novo_horario_iso);
  const dateCheck = validateRequestedDate(scheduled);
  if (!dateCheck.ok) return { ok: false, message: dateCheck.reason! };

  await autoMarkPastNoShowsForLead(admin, ctx.tenantId, ctx.leadId);

  let apptId = args.appointment_id;
  let current: any = null;
  if (apptId) {
    const { data: found } = await admin
      .from("appointments")
      .select("id, scheduled_at, status, notes, consultation_type_id")
      .eq("id", apptId)
      .eq("tenant_id", ctx.tenantId)
      .eq("lead_id", ctx.leadId)
      .maybeSingle();
    if (!found) return { ok: false, message: "Agendamento não encontrado para este lead." };
    current = found;
  } else {
    const { data: found } = await admin
      .from("appointments")
      .select("id, scheduled_at, status, notes, consultation_type_id")
      .eq("tenant_id", ctx.tenantId)
      .eq("lead_id", ctx.leadId)
      .in("status", ["pending", "confirmed"])
      .gte("scheduled_at", new Date(Date.now() - 60 * 60_000).toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!found) return { ok: false, message: "Nenhum agendamento futuro encontrado para remarcar. Use criar_agendamento." };
    current = found;
    apptId = (found as any).id;
  }

  // Mesma validação de slot usada na criação e na listagem.
  const check = await isSlotBookable(admin, {
    tenantId: ctx.tenantId,
    consultationTypeId: current?.consultation_type_id ?? null,
    startsAt: scheduled,
    ignoreAppointmentId: apptId,
  });
  if (!check.ok) return { ok: false, message: check.reason! };

  const endMs = scheduled.getTime() + check.slotMinutes * 60_000;

  // Preserva a nota existente (histórico append) e o status 'confirmed'.
  const historyLine = `[${new Date().toISOString().slice(0, 16).replace("T", " ")}] Remarcado via IA${args.motivo ? `: ${args.motivo}` : " (WhatsApp)"}`;
  const prevNotes = String(current?.notes ?? "").trim();
  const nextNotes = prevNotes ? `${prevNotes}\n${historyLine}` : historyLine;
  const nextStatus = current?.status === "confirmed" ? "confirmed" : "pending";

  const { data: updated, error } = await admin
    .from("appointments")
    .update({
      scheduled_at: scheduled.toISOString(),
      end_at: new Date(endMs).toISOString(),
      status: nextStatus,
      notes: nextNotes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", apptId!)
    .eq("tenant_id", ctx.tenantId)
    .eq("lead_id", ctx.leadId)
    .select("id")
    .single();

  if (error) return { ok: false, message: `Erro ao remarcar: ${error.message}` };
  return { ok: true, message: "Agendamento remarcado com sucesso.", appointment_id: (updated as any).id };

}

async function cancelAppointment(
  admin: Supa,
  ctx: { tenantId: string; leadId: string | null },
  args: { appointment_id?: string; motivo?: string },
): Promise<{ ok: boolean; message: string; appointment_id?: string }> {
  if (!ctx.leadId) return { ok: false, message: "Lead não identificado." };

  let apptId = args.appointment_id;
  if (!apptId) {
    const { data: found } = await admin
      .from("appointments")
      .select("id")
      .eq("tenant_id", ctx.tenantId)
      .eq("lead_id", ctx.leadId)
      .in("status", ["pending", "confirmed"])
      .gte("scheduled_at", new Date(Date.now() - 60 * 60_000).toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!found) return { ok: false, message: "Nenhum agendamento futuro encontrado para cancelar." };
    apptId = (found as any).id;
  }

  const { error } = await admin
    .from("appointments")
    .update({
      status: "cancelled",
      notes: args.motivo ? `Cancelado via IA: ${args.motivo}` : "Cancelado via IA (WhatsApp)",
      updated_at: new Date().toISOString(),
    })
    .eq("id", apptId!)
    .eq("tenant_id", ctx.tenantId)
    .eq("lead_id", ctx.leadId);

  if (error) return { ok: false, message: `Erro ao cancelar: ${error.message}` };
  return { ok: true, message: "Agendamento cancelado.", appointment_id: apptId };
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

async function updateLeadQualification(
  admin: Supa,
  ctx: { tenantId: string; leadId: string | null; leadName: string | null; leadPhone: string },
  args: {
    nome?: string;
    idade?: number;
    usa_oculos?: boolean;
    dificuldade_visual?: string;
    ultimo_exame?: string;
    tem_receita?: boolean;
    grau_receita?: string;
    tipo_produto?: string;
    urgencia?: "baixa" | "media" | "alta";
    interesses?: string[];
    objecao?: string;
    paciente_nome?: string;
    paciente_relacao?: string;
    paciente_idade?: number;
    preferencia_horario?: string;
    restricoes_agenda?: string;
    notas?: string;
  },
): Promise<{ ok: boolean; message: string; updated: string[] }> {
  if (!ctx.leadId) return { ok: false, message: "Lead não identificado.", updated: [] };

  // Carrega estado atual para mesclar arrays/notas sem sobrescrever
  const { data: current } = await admin
    .from("leads")
    .select("full_name, notes, ia_summary, ia_interesses, ia_tags, ia_urgencia, ia_receita_grau, patient_name, patient_relation, patient_age, schedule_preferences")
    .eq("id", ctx.leadId)
    .maybeSingle();

  const patch: Record<string, unknown> = {};
  const updated: string[] = [];

  if (args.nome) {
    const cur = (current?.full_name ?? "").trim();
    const looksBusiness = /\b(borracharia|lava\s*(motos|jato|r[áa]pido|car)?|oficina|mec[âa]nica|mercado|mercadinho|loja|lojas|restaurante|lanchonete|pizzaria|padaria|farm[áa]cia|cl[íi]nica|cons[óo]rcio|imobili[áa]ria|pet\s*shop|hotel|pousada|sal[ãa]o|barbearia|academia|escrit[óo]rio|companhia|empresa|ltda|ltd|s\/?a|eireli|mei|comercial|com[ée]rcio|distribuidora|revendedora?|autopeças?|auto\s+peças?|posto|supermercado|transporte[s]?|construtora|engenharia|contabilidade)\b/i.test(cur);
    if (!cur || /^lead\b/i.test(cur) || looksBusiness) {
      patch.full_name = args.nome.trim();
      updated.push("nome");
    }
  }

  if (args.urgencia) {
    patch.ia_urgencia = args.urgencia;
    patch.ia_urgency = args.urgencia;
    updated.push("urgencia");
  }
  if (args.grau_receita) {
    patch.ia_receita_grau = args.grau_receita.trim();
    updated.push("grau_receita");
  }

  // Paciente ≠ contato: guarda separado para uso na agenda e no contexto
  if (args.paciente_nome && args.paciente_nome.trim()) {
    const pn = args.paciente_nome.trim();
    const contatoNome = (current?.full_name ?? args.nome ?? "").trim();
    // Só grava se realmente for diferente do contato
    if (!contatoNome || pn.toLowerCase() !== contatoNome.toLowerCase()) {
      patch.patient_name = pn;
      updated.push("paciente_nome");
    }
  }
  if (args.paciente_relacao && args.paciente_relacao.trim()) {
    patch.patient_relation = args.paciente_relacao.trim().toLowerCase();
    updated.push("paciente_relacao");
  }
  if (typeof args.paciente_idade === "number" && args.paciente_idade > 0) {
    patch.patient_age = args.paciente_idade;
    updated.push("paciente_idade");
  }

  // Preferências de horário / restrições de agenda: JSONB acumulativo
  const prevPrefs = (current?.schedule_preferences ?? {}) as Record<string, unknown>;
  const nextPrefs: Record<string, unknown> = { ...prevPrefs };
  let prefsChanged = false;
  if (args.preferencia_horario && args.preferencia_horario.trim()) {
    nextPrefs.preferencia_horario = args.preferencia_horario.trim();
    prefsChanged = true;
    updated.push("preferencia_horario");
  }
  if (args.restricoes_agenda && args.restricoes_agenda.trim()) {
    nextPrefs.restricoes_agenda = args.restricoes_agenda.trim();
    prefsChanged = true;
    updated.push("restricoes_agenda");
  }
  if (prefsChanged) {
    nextPrefs.atualizado_em = new Date().toISOString();
    patch.schedule_preferences = nextPrefs;
  }

  // Interesses: merge case-insensitive
  if (Array.isArray(args.interesses) && args.interesses.length) {
    const prev = new Set((current?.ia_interesses ?? []).map((s: string) => s.toLowerCase()));
    const merged = [...(current?.ia_interesses ?? [])];
    for (const it of args.interesses) {
      if (it && !prev.has(it.toLowerCase())) {
        merged.push(it);
        prev.add(it.toLowerCase());
      }
    }
    patch.ia_interesses = merged;
    updated.push("interesses");
  }

  // Tags: adiciona objecao/uso de óculos/produto como flags rastreáveis
  const prevTags = new Set((current?.ia_tags ?? []).map((s: string) => s.toLowerCase()));
  const newTags = [...(current?.ia_tags ?? [])];
  const addTag = (t: string) => {
    if (!prevTags.has(t.toLowerCase())) { newTags.push(t); prevTags.add(t.toLowerCase()); }
  };
  if (args.tipo_produto) {
    addTag(`produto:${args.tipo_produto.trim().toLowerCase()}`);
    updated.push("tipo_produto");
  }
  if (typeof args.usa_oculos === "boolean") {
    addTag(args.usa_oculos ? "usa-oculos" : "sem-oculos");
    updated.push("usa_oculos");
  }
  if (typeof args.tem_receita === "boolean") {
    addTag(args.tem_receita ? "receita:sim" : "receita:nao");
    updated.push("tem_receita");
  }
  if (args.objecao) {
    addTag(`objecao:${args.objecao.trim().toLowerCase()}`);
    updated.push("objecao");
  }
  if (newTags.length !== (current?.ia_tags?.length ?? 0)) {
    patch.ia_tags = newTags;
  }

  // ia_summary: acumula um resumo curto e legível
  const summaryLines: string[] = [];
  if (current?.ia_summary?.trim()) summaryLines.push(current.ia_summary.trim());
  const newFacts: string[] = [];
  if (args.paciente_nome && args.paciente_relacao) {
    newFacts.push(`Paciente: ${args.paciente_nome} (${args.paciente_relacao})${args.paciente_idade ? `, ${args.paciente_idade} anos` : ""}`);
  } else if (args.paciente_nome) {
    newFacts.push(`Paciente: ${args.paciente_nome}${args.paciente_idade ? `, ${args.paciente_idade} anos` : ""}`);
  }
  if (args.idade) newFacts.push(`Idade: ${args.idade}`);
  if (args.dificuldade_visual) newFacts.push(`Dificuldade: ${args.dificuldade_visual}`);
  if (args.ultimo_exame) newFacts.push(`Último exame: ${args.ultimo_exame}`);
  if (args.tipo_produto) newFacts.push(`Produto de interesse: ${args.tipo_produto}`);
  if (args.objecao) newFacts.push(`Objeção: ${args.objecao}`);
  if (args.preferencia_horario) newFacts.push(`Prefere horário: ${args.preferencia_horario}`);
  if (args.restricoes_agenda) newFacts.push(`Restrição de agenda: ${args.restricoes_agenda}`);
  if (args.notas) newFacts.push(args.notas);
  if (newFacts.length) {
    summaryLines.push(newFacts.join(" • "));
    patch.ia_summary = summaryLines.join("\n").slice(0, 2000);
    updated.push("resumo");
  }

  if (Object.keys(patch).length === 0) {
    return { ok: true, message: "Nada novo pra salvar.", updated: [] };
  }

  (patch as any).updated_at = new Date().toISOString();

  const { error } = await admin.from("leads").update(patch).eq("id", ctx.leadId);
  if (error) return { ok: false, message: `Erro ao salvar: ${error.message}`, updated: [] };

  return { ok: true, message: `Salvei: ${updated.join(", ")}`, updated };
}




/** Detecta mensagens que contêm detalhe técnico (Postgres/Supabase/HTTP/stack). */
function looksTechnical(msg: string): boolean {
  return /(duplicate key|violates|constraint|relation |column |PGRST|JWT|syntax error|permission denied|fetch failed|ECONN|undefined is not|null value in|TypeError|supabase|postgres)/i.test(
    msg,
  );
}

export async function executeToolCall(
  admin: Supa,
  ctx: { tenantId: string; leadId: string | null; leadName: string | null; leadPhone: string },
  name: string,
  argsJson: string,
): Promise<string> {
  // Separa o que a IA pode falar (client_message) do detalhe técnico
  // (internal_error — só log do servidor, NUNCA vai para o cliente).
  const wrap = (obj: any): string => {
    if (obj && obj.ok === false) {
      const raw = String(obj.message ?? "");
      const technical = !raw || looksTechnical(raw);
      if (raw) {
        obj.internal_error = raw;
        console.error(`[tool:${name}] internal_error: ${raw}`);
      }
      obj.client_message = technical
        ? "Não consegui concluir isso agora aqui no sistema. Posso tentar de outro jeito com você?"
        : raw;
      delete obj.message;
      obj.must_relay_to_user = true;
      obj.client_hint =
        "Fale ao cliente com naturalidade usando SOMENTE o texto de 'client_message' e proponha o próximo passo. NUNCA repita 'internal_error' nem detalhes técnicos.";
    }
    return JSON.stringify(obj);
  };

  let args: any = {};
  try { args = JSON.parse(argsJson || "{}"); } catch { args = {}; }

  try {
    if (name === "listar_horarios_disponiveis") {
      const slots = await listAvailableSlots(admin, ctx.tenantId, args);
      if (slots.length === 0) {
        return wrap({
          ok: false,
          message: "Nenhum horário livre nos próximos 14 dias com esses critérios.",
        });
      }
      return JSON.stringify({ ok: true, slots });
    }
    if (name === "criar_agendamento") return wrap(await createAppointment(admin, ctx, args));
    if (name === "remarcar_agendamento") return wrap(await rescheduleAppointment(admin, ctx, args));
    if (name === "cancelar_agendamento") return wrap(await cancelAppointment(admin, ctx, args));
    if (name === "transferir_para_humano") return wrap(await transferToHuman(admin, ctx, args));
    if (name === "atualizar_qualificacao_lead") return wrap(await updateLeadQualification(admin, ctx, args));
    return wrap({ ok: false, message: `Tool desconhecida: ${name}` });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[tool:${name}] exceção: ${msg}`);
    return wrap({
      ok: false,
      message: `Falha técnica ao executar ${name}: ${msg}`,
    });
  }
}


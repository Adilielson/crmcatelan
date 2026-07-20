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

export const AGENT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "listar_horarios_disponiveis",
      description:
        "OBRIGATÓRIO chamar antes de propor qualquer horário. Lista horários livres para o exame de OPTOMETRISTA (único tipo disponível — Oftalmologia foi descontinuada), cruzando: horário da loja + janela do exame + bloqueios + exceções por data. NUNCA invente ou sugira horários sem chamar esta função. Se o cliente pedir um horário que não retornar aqui, informe que não há atendimento nesse horário.",
      parameters: {
        type: "object",
        required: ["tipo_exame"],
        properties: {
          tipo_exame: {
            type: "string",
            description: "SEMPRE 'Optometrista' — é o único tipo de exame ofertado. NÃO usar 'Oftalmológica'.",
          },

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
        required: ["scheduled_at_iso", "tipo_consulta"],
        properties: {
          scheduled_at_iso: {
            type: "string",
            description: "Horário exato em ISO 8601 com offset -03:00 (ex: 2026-07-10T15:10:00-03:00). Pode ser um slot da lista OU um horário customizado que o cliente pediu, desde que esteja dentro do horário comercial.",
          },
          tipo_consulta: {
            type: "string",
            description: "SEMPRE 'Optometrista' — Oftalmologia não é mais ofertada.",
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
async function listAvailableSlots(
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
  const norm = (opts.tipo_exame ?? "").trim().toLowerCase();
  const type = (types ?? []).find(
    (t: any) => (t.name as string).toLowerCase().includes(norm) || norm.includes((t.name as string).toLowerCase()),
  );
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

  const today = new Date();
  const startDate = opts.data_preferida
    ? new Date(opts.data_preferida + "T00:00:00Z")
    : today;
  const startDateStr = dateOnly(startDate < today ? today : startDate);
  const endDate = addDays(new Date(startDateStr + "T00:00:00Z"), LOOKAHEAD_DAYS);

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
  const rangeStartIso = new Date(startDateStr + "T00:00:00Z").toISOString();
  const rangeEndIso = new Date(dateOnly(addDays(endDate, 1)) + "T00:00:00Z").toISOString();
  const { data: apptRows } = await admin
    .from("appointments")
    .select("scheduled_at")
    .eq("tenant_id", tenantId)
    .in("status", ["pending", "confirmed"])
    .gte("scheduled_at", rangeStartIso)
    .lte("scheduled_at", rangeEndIso);
  const countsByDay = new Map<string, number>();
  const countsByHour = new Map<string, number>(); // key = `${dayStr} ${HH}` (só minuto :00 conta)
  for (const a of (apptRows ?? []) as any[]) {
    const iso = a.scheduled_at as string;
    const day = iso.slice(0, 10);
    countsByDay.set(day, (countsByDay.get(day) ?? 0) + 1);
    // minuto local baseado no ISO cru (offset -03:00 aplicado no isoAt)
    const hm = iso.slice(11, 16); // "HH:MM" na tz do ISO gravado
    if (hm.endsWith(":00")) {
      const key = `${day} ${hm.slice(0, 2)}`;
      countsByHour.set(key, (countsByHour.get(key) ?? 0) + 1);
    }
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

      // máx 2 por horário cheio nos dias normais (seg/ter/qui/sex)
      if (!HIGH_VOLUME_WEEKDAYS.has(dow) && slotStart % 60 === 0) {
        const hourKey = `${dayStr} ${String(Math.floor(slotStart / 60)).padStart(2, "0")}`;
        if ((countsByHour.get(hourKey) ?? 0) >= PER_HOUR_CAP_NORMAL) { cursor += slotMin; continue; }
      }

      const iso = isoAt(dayStr, slotStart);
      if (new Date(iso).getTime() < Date.now() + 60 * 60_000) {
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
  args: { scheduled_at_iso: string; tipo_consulta: string; observacao?: string },
): Promise<{ ok: boolean; message: string; appointment_id?: string }> {
  if (!ctx.leadId) return { ok: false, message: "Lead não identificado no sistema." };

  const scheduled = new Date(args.scheduled_at_iso);
  if (isNaN(scheduled.getTime())) return { ok: false, message: "Data inválida. Use ISO 8601 (ex: 2026-07-25T14:00:00-04:00)." };
  const nowMs = Date.now();
  if (scheduled.getTime() < nowMs) {
    return { ok: false, message: "Não é possível agendar no passado. Confirme o dia/hora com o cliente e ofereça um horário futuro real." };
  }
  // Limita agendamentos a no máximo 90 dias no futuro — evita ano/data alucinada pelo LLM.
  const maxFutureMs = nowMs + 90 * 24 * 60 * 60_000;
  if (scheduled.getTime() > maxFutureMs) {
    return { ok: false, message: "Data muito distante (máx 90 dias). Verifique se o ANO está correto e confirme a data com o cliente antes de tentar de novo." };
  }


  // Atendimento paralelo permitido: NÃO bloqueamos por colisão de horário entre leads distintos.
  const startMs = scheduled.getTime();
  const endMs = startMs + DEFAULT_SLOT_MINUTES * 60_000;

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

  // Se o lead já tem outro agendamento futuro ativo em horário diferente,
  // orienta a IA a REMARCAR em vez de duplicar.
  const { data: existingOther } = await admin
    .from("appointments")
    .select("id, scheduled_at")
    .eq("tenant_id", ctx.tenantId)
    .eq("lead_id", ctx.leadId)
    .in("status", ["pending", "confirmed"])
    .gte("scheduled_at", new Date(Date.now() - 60 * 60_000).toISOString())
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

  // ── Regras de capacidade + feriados (fuso do tenant) ──────────────────
  const tz = await getTenantTimezone(admin, ctx.tenantId);
  const local = localDayInfo(scheduled, tz);

  // Feriado / dia bloqueado (cadastro manual em agenda_blocked_dates)
  const { data: blockedDay } = await admin
    .from("agenda_blocked_dates")
    .select("all_day,block_start,block_end,reason")
    .eq("tenant_id", ctx.tenantId)
    .eq("blocked_date", local.dayStr);
  const dayBlocks = (blockedDay ?? []) as any[];
  if (dayBlocks.some((b) => b.all_day)) {
    return {
      ok: false,
      message: `Não há atendimento em ${local.dayStr} (feriado ou dia bloqueado). Ofereça outro dia.`,
    };
  }

  // Conta agendamentos ativos do mesmo dia local (janela ampla ±36h em UTC).
  const rangeStart = new Date(scheduled.getTime() - 36 * 3600_000).toISOString();
  const rangeEnd = new Date(scheduled.getTime() + 36 * 3600_000).toISOString();
  const { data: dayAppts } = await admin
    .from("appointments")
    .select("id, scheduled_at")
    .eq("tenant_id", ctx.tenantId)
    .in("status", ["pending", "confirmed"])
    .gte("scheduled_at", rangeStart)
    .lte("scheduled_at", rangeEnd);

  const sameLocalDay = (dayAppts ?? []).filter(
    (a: any) => localDayInfo(a.scheduled_at as string, tz).dayStr === local.dayStr,
  );

  const cap = dailyCapFor(local.weekday);
  if (sameLocalDay.length >= cap) {
    return {
      ok: false,
      message: `Capacidade do dia ${local.dayStr} atingida (${cap} consultas). Ofereça outro dia — quarta e sábado aceitam mais volume.`,
    };
  }

  // Máx 2 no mesmo horário cheio (só nos dias normais). Encaixe: sugerir minuto quebrado.
  if (!HIGH_VOLUME_WEEKDAYS.has(local.weekday)) {
    // "Horário cheio" = mesma hora e minuto == 0 (ex: 14:00, 15:00). Nos minutos quebrados (14:10, 14:20…) não aplica.
    const scheduledLocalHM = new Intl.DateTimeFormat("pt-BR", {
      timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).format(scheduled); // "14:00"
    const [, mm] = scheduledLocalHM.split(":");
    if (mm === "00") {
      const sameHour = sameLocalDay.filter((a: any) => {
        const hm = new Intl.DateTimeFormat("pt-BR", {
          timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
        }).format(new Date(a.scheduled_at as string));
        return hm === scheduledLocalHM;
      });
      if (sameHour.length >= PER_HOUR_CAP_NORMAL) {
        return {
          ok: false,
          message: `Horário ${scheduledLocalHM} já tem ${PER_HOUR_CAP_NORMAL} consultas. Ofereça um encaixe quebrado no mesmo bloco (ex.: :10, :20, :30, :40, :50) ou outro horário.`,
        };
      }
    }
  }

  // Tipo de consulta (opcional; se não existir, cria appointment sem consultation_type_id)
  const { data: types } = await admin
    .from("consultation_types")
    .select("id,name,default_value")
    .eq("tenant_id", ctx.tenantId)
    .eq("is_active", true);
  const norm = args.tipo_consulta.trim().toLowerCase();
  const match = (types ?? []).find(
    (t: any) => (t.name as string).toLowerCase().includes(norm) || norm.includes((t.name as string).toLowerCase()),
  );

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

  const { data: inserted, error } = await admin
    .from("appointments")
    .insert({
      tenant_id: ctx.tenantId,
      lead_id: ctx.leadId,
      lead_name: ctx.leadName,
      unit_id: (unitRow as any)?.id ?? null,
      unit_name: (unitRow as any)?.name ?? null,
      professional_id: (profRow as any)?.id ?? null,
      scheduled_at: scheduled.toISOString(),
      end_at: new Date(endMs).toISOString(),
      status: "pending",
      type_exam: args.tipo_consulta,
      consultation_type_id: (match as any)?.id ?? null,
      value: (match as any)?.default_value ?? null,
      notification_channel: "whatsapp",
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

async function rescheduleAppointment(
  admin: Supa,
  ctx: { tenantId: string; leadId: string | null },
  args: { appointment_id?: string; novo_horario_iso: string; motivo?: string },
): Promise<{ ok: boolean; message: string; appointment_id?: string }> {
  if (!ctx.leadId) return { ok: false, message: "Lead não identificado." };
  const scheduled = new Date(args.novo_horario_iso);
  if (isNaN(scheduled.getTime())) return { ok: false, message: "Data inválida." };
  if (scheduled.getTime() < Date.now()) return { ok: false, message: "Não é possível remarcar para o passado." };

  let apptId = args.appointment_id;
  if (!apptId) {
    const { data: found } = await admin
      .from("appointments")
      .select("id, scheduled_at, status")
      .eq("tenant_id", ctx.tenantId)
      .eq("lead_id", ctx.leadId)
      .in("status", ["pending", "confirmed"])
      .gte("scheduled_at", new Date(Date.now() - 60 * 60_000).toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!found) return { ok: false, message: "Nenhum agendamento futuro encontrado para remarcar. Use criar_agendamento." };
    apptId = (found as any).id;
  }

  const endMs = scheduled.getTime() + DEFAULT_SLOT_MINUTES * 60_000;
  const { data: updated, error } = await admin
    .from("appointments")
    .update({
      scheduled_at: scheduled.toISOString(),
      end_at: new Date(endMs).toISOString(),
      status: "pending",
      notes: args.motivo ? `Remarcado via IA: ${args.motivo}` : "Remarcado via IA (WhatsApp)",
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
    notas?: string;
  },
): Promise<{ ok: boolean; message: string; updated: string[] }> {
  if (!ctx.leadId) return { ok: false, message: "Lead não identificado.", updated: [] };

  // Carrega estado atual para mesclar arrays/notas sem sobrescrever
  const { data: current } = await admin
    .from("leads")
    .select("full_name, notes, ia_summary, ia_interesses, ia_tags, ia_urgencia, ia_receita_grau")
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
  if (args.idade) newFacts.push(`Idade: ${args.idade}`);
  if (args.dificuldade_visual) newFacts.push(`Dificuldade: ${args.dificuldade_visual}`);
  if (args.ultimo_exame) newFacts.push(`Último exame: ${args.ultimo_exame}`);
  if (args.tipo_produto) newFacts.push(`Produto de interesse: ${args.tipo_produto}`);
  if (args.objecao) newFacts.push(`Objeção: ${args.objecao}`);
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
    if (name === "remarcar_agendamento") {
      const res = await rescheduleAppointment(admin, ctx, args);
      return JSON.stringify(res);
    }
    if (name === "cancelar_agendamento") {
      const res = await cancelAppointment(admin, ctx, args);
      return JSON.stringify(res);
    }
    if (name === "transferir_para_humano") {
      const res = await transferToHuman(admin, ctx, args);
      return JSON.stringify(res);
    }
    if (name === "atualizar_qualificacao_lead") {
      const res = await updateLeadQualification(admin, ctx, args);
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

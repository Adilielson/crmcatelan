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
      name: "atualizar_qualificacao_lead",
      description:
        "Salva no CRM as informações de qualificação que o cliente forneceu na conversa. CHAME SEMPRE que o cliente responder uma pergunta de qualificação (nome, idade, uso de óculos, dificuldade visual, último exame, receita, plano de saúde, urgência, etc). Não espere ter tudo — envie campo a campo conforme aparecer. Só envie campos que o cliente REALMENTE disse; nunca invente. Pode chamar múltiplas vezes na mesma conversa.",
      parameters: {
        type: "object",
        properties: {
          nome: { type: "string", description: "Nome do cliente." },
          idade: { type: "integer", description: "Idade em anos, se mencionada." },
          usa_oculos: { type: "boolean", description: "Cliente usa óculos hoje?" },
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
          plano_saude: { type: "string", description: "Nome do plano ('Unimed', 'particular', 'SUS') ou 'nenhum'." },
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

      // Passado (para hoje)
      if (startMs < Date.now() + 60 * 60_000) {
        cursor += SLOT_MINUTES;
        continue;
      }

      // (sem checagem de colisão — múltiplos agendamentos no mesmo horário são permitidos)


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

  // Atendimento paralelo permitido: NÃO bloqueamos por colisão de horário.
  const startMs = scheduled.getTime();
  const endMs = startMs + SLOT_MINUTES * 60_000;


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
    plano_saude?: string;
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

  if (args.nome && (!current?.full_name || current.full_name.trim() === "" || /^lead\b/i.test(current.full_name))) {
    patch.full_name = args.nome.trim();
    updated.push("nome");
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

  // Tags: adiciona plano/objecao/uso de óculos como flags rastreáveis
  const prevTags = new Set((current?.ia_tags ?? []).map((s: string) => s.toLowerCase()));
  const newTags = [...(current?.ia_tags ?? [])];
  const addTag = (t: string) => {
    if (!prevTags.has(t.toLowerCase())) { newTags.push(t); prevTags.add(t.toLowerCase()); }
  };
  if (args.plano_saude) {
    const p = args.plano_saude.trim();
    addTag(/nenhum|particular|sus|não/i.test(p) ? `plano:${p.toLowerCase()}` : `plano:${p.toLowerCase()}`);
    updated.push("plano_saude");
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
  if (args.plano_saude) newFacts.push(`Plano: ${args.plano_saude}`);
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

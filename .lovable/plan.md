## Configurações da Agenda

Transformar o botão **Configurações** (hoje decorativo) em um dialog real para definir a programação da agenda da ótica. Foco em duas coisas que travam ou liberam horário no calendário:

### 1. Horários disponíveis por dia da semana
Para cada dia (Dom–Sáb), o gestor define:
- **Aberto / Fechado** no dia.
- **Janela de atendimento** (ex: 08:00 → 18:00).
- **Pausa de almoço** opcional (ex: 12:00 → 13:00).

Hoje isso está hard-coded em `use-agenda.ts` (`WORKING_HOURS`). Vai virar dado por tenant.

### 2. Dias bloqueados (datas específicas)
Lista de datas em que a agenda fica fechada mesmo sendo dia útil:
- Feriados (25/12, 01/01…).
- Confraternização, dedetização, treinamento.
- Cada bloqueio tem: data, motivo opcional, dia inteiro **ou** intervalo de horas.

### 3. Como isso afeta a agenda
- O calendário do mês mostra dias bloqueados com hachura cinza e label "Fechado".
- Ao tentar criar agendamento em horário fora da janela, dia fechado ou bloqueado: erro "Horário indisponível".
- O check de conflito (`checkConflict` no `use-agenda.ts`) passa a considerar: janela do dia + almoço + bloqueios, além de sobreposição com outras consultas.

### 4. UI do dialog
Dialog com 2 abas:
- **Horários da semana** — 7 linhas (Dom–Sáb) com switch aberto/fechado + 4 time-pickers (abre/fecha/almoço início/almoço fim).
- **Dias bloqueados** — lista vertical de bloqueios + botão "Adicionar bloqueio" (date picker + motivo + checkbox "dia inteiro" ou intervalo).

Salva tudo num "Salvar" único no rodapé.

---

### Detalhes técnicos

**Migração SQL** (preciso de aprovação separada):

```sql
-- Horário semanal (1 linha por dia da semana por tenant)
CREATE TABLE public.agenda_business_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0=Dom
  is_open boolean NOT NULL DEFAULT true,
  open_time time,        -- ex: 08:00
  close_time time,       -- ex: 18:00
  lunch_start time,      -- opcional
  lunch_end time,        -- opcional
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (tenant_id, weekday)
);

-- Datas bloqueadas
CREATE TABLE public.agenda_blocked_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  blocked_date date NOT NULL,
  all_day boolean NOT NULL DEFAULT true,
  block_start time,      -- usado se all_day=false
  block_end time,
  reason text,
  created_at timestamptz DEFAULT now()
);
```

+ GRANTs (`authenticated` full, `service_role` all), RLS por `tenant_id` via `get_current_user_tenant()`, trigger `set_updated_at`, e seed automático no `seed_kanban_columns_for_tenant` (8h–18h seg–sex, almoço 12–13h, fim de semana fechado).

**Frontend:**
- `src/hooks/use-agenda-settings.ts` — `useBusinessHours()`, `useBlockedDates()`, mutations.
- `src/components/agenda/AgendaSettingsDialog.tsx` — dialog com Tabs.
- `src/routes/agenda.tsx`:
  - Botão "Configurações" abre o dialog.
  - `WORKING_HOURS` deixa de ser fixo: lê do hook.
  - `checkConflict` valida janela do dia, almoço e bloqueios.
  - Células do calendário pintam cinza + "Fechado" para dias bloqueados/fechados.

### Fora de escopo agora (vai pro holdmap)
- Horário diferente por **profissional** (Dr. X só atende terça e quinta).
- Horário diferente por **unidade/loja**.
- Recorrência de bloqueio (ex: "toda 1ª segunda do mês").
- Importar feriados nacionais automaticamente.

Esses 3 últimos ficam pra depois — começamos simples com tenant único.

---

**Tudo certo pra eu rodar a migração e implementar?**

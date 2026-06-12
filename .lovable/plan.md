## Objetivo

Disparar lembretes WhatsApp automáticos para agendamentos, detectar resposta de confirmação e atualizar o status do appointment (`pending` → `confirmed`). Reaproveita exatamente o padrão já existente em `lead_followups` + `/api/public/hooks/process-followups` + UAZ API.

## Pergunta de ambiguidade

Os itens 2 e 3 do prompt dizem ambos "1h antes". Vou assumir:
- **Item 2 — Lembrete do dia**: na manhã do agendamento (ex.: 8h da manhã do dia, ou 3h antes se for à tarde).
- **Item 3 — Lembrete final**: 1h antes do horário marcado.
Se quiser outro intervalo para o item 2, me diga antes que eu implemente.

## Mudanças

### 1. Banco (migração)

Nova tabela `appointment_reminders` (espelha `lead_followups`):
- `id`, `tenant_id`, `appointment_id` (FK), `lead_id`, `kind` (`confirm_24h` | `confirm_retry_2h` | `day_morning` | `final_1h`), `scheduled_at`, `status` (`pending|sent|skipped|failed|confirmed`), `sent_at`, `error_message`, `created_at`.
- RLS por tenant (igual a `lead_followups`) + GRANTs para `authenticated` e `service_role`.
- Trigger `schedule_appointment_reminders` em `appointments`:
  - INSERT com status pending/confirmed → cria 3 lembretes (24h, day_morning, final_1h).
  - UPDATE de `scheduled_at` → reagenda pendentes.
  - UPDATE para status `cancelled`/`completed`/`no_show` → marca pendentes como `skipped`.
  - UPDATE para `confirmed` → marca `confirm_24h`/`confirm_retry_2h` como `confirmed`.

### 2. Processador (cron)

Novo `src/routes/api/public/hooks/process-appointment-reminders.ts`:
- Mesma forma de `process-followups.ts` (Bearer/cron-secret `FOLLOWUPS_CRON_SECRET`, lote de 200).
- Para cada lembrete pendente vencido:
  - Carrega lead + appointment + whatsapp_config + unit (endereço).
  - Pula se appointment está `cancelled`/`completed`/`no_show`.
  - Renderiza mensagem por `kind` (textos exatos do prompt).
  - Envia via UAZ `/send/text`, loga em `whatsapp_message_logs`.
  - Marca `sent`.
  - Para `confirm_24h`: agenda automaticamente um `confirm_retry_2h` se ainda não havia.

Agendamento `pg_cron`: a cada 15 min chamando a rota com `apikey`/`x-cron-secret`.

### 3. Detecção de resposta de confirmação

Em `supabase/functions/whatsapp-webhook/index.ts`, ao receber uma mensagem inbound:
- Se o telefone bate com um lead que tem appointment futuro em status `pending`:
  - Regex simples: `/\b(sim|confirmo|confirmado|ok|pode\s*ser|tá|ta|👍)\b/i` → seta appointment `status = confirmed`, marca lembretes de confirmação como `confirmed`, registra atividade.
  - Regex de cancelamento: `/\b(n[aã]o|cancelar|remarcar|desmarcar)\b/i` → cria notificação interna pedindo atenção do atendente (não cancela sozinho).

### 4. UI

- `KanbanBoard` → no card do lead com appointment, badge "Confirmado" (verde) / "Pendente de confirmação" (âmbar) ao lado da data já planejada.
- `LeadDetailSheet` / `LeadProfilePanel` → mostrar histórico dos lembretes (`status`, `sent_at`).
- `agenda.tsx` → coluna/ícone "Confirmação" no calendário.

## Mensagens (literal)

- `confirm_24h` / `confirm_retry_2h`:
  *Olá, {nome}! Passando para confirmar seu agendamento amanhã na Ótica Catelã. Tudo certo para amanhã? Confirme aqui. Se não puder vir, nos avise.*
- `day_morning` (confirmado):
  *Ei, {nome}! Hoje é o dia do nosso agendamento! Estamos te esperando.*
- `day_morning` (não confirmado):
  *Ei, {nome}! Hoje é o dia do nosso agendamento! Aguardando sua confirmação.*
- `final_1h`:
  *{nome}, falta só 1 hora! Estamos te esperando na Ótica Catelã ({endereço}).*

## Pré-requisitos

- Confirme o intervalo do lembrete do item 2 (manhã do dia? 3h antes? outro?).
- A integração WhatsApp (UAZ) já está pronta — sem novas chaves.
- `FOLLOWUPS_CRON_SECRET` já existe e será reusado.

Depois de aprovado, implemento migração + rota + trigger no webhook + ajustes de UI numa única leva.

## Objetivo

1. Adicionar coluna **"Check-IN OK"** no Kanban — leads vão pra lá automaticamente quando o atendente faz Check-IN na Agenda.
2. Permitir que **admin** e **gerente** criem/editem/removam colunas customizadas do Kanban (ex: "Aguardando Exame", "Pós-venda", etc).

---

## Como vai funcionar (visão do usuário)

### Coluna fixa nova: "Check-IN OK"
- Aparece entre **"Agendado"** e **"Fechado"**.
- Quando o atendente clica em **Check-IN** na Agenda → o lead vinculado pula automaticamente pra essa coluna no Kanban.
- Visualmente destacada (badge verde "presente") pra sinalizar lead qualificado.

### Colunas customizadas (admin/gerente)
- Botão **"+ Nova Coluna"** no topo do Kanban (visível só pra admin/gerente).
- Modal pede: **nome**, **cor**, **posição** (entre quais colunas).
- Pode **renomear**, **mudar cor**, **reordenar** (drag) e **excluir** (com confirmação — leads na coluna voltam pra "Leads Prontos").
- Colunas do sistema (Prontos, Em Atendimento, Agendado, Check-IN OK, Fechado, Perdido) **não podem ser excluídas nem renomeadas** — só reordenadas.
- Atendentes veem as colunas, mas não podem editar.

---

## Mudanças técnicas

### Banco (migration)
- Adicionar valor `checked_in` no enum `lead_status`.
- Nova tabela `kanban_columns`:
  - `tenant_id`, `name`, `color`, `position`, `is_system` (bool), `system_key` (mapeia pro enum quando `is_system=true`), `created_by`.
  - RLS: leitura por qualquer membro do tenant; escrita só por admin/super_admin (gerente entra como admin).
- Nova coluna `leads.custom_column_id` (nullable, FK pra `kanban_columns`) — usada quando o lead está numa coluna customizada. Quando preenchida, sobrepõe o `status` enum visualmente.
- Seed automático: ao criar tenant (ou na migration), inserir as colunas de sistema.

### Frontend
- `use-kanban-columns.ts` — hook novo (CRUD das colunas).
- `KanbanBoard.tsx` — render dinâmico baseado em `kanban_columns` ao invés do array fixo `STAGES`.
- `KanbanColumnDialog.tsx` — modal criar/editar coluna (admin/gerente).
- `use-agenda.ts` (checkIn) — ao fazer check-in, atualizar `leads.status = 'checked_in'`.
- Drag-and-drop: ao soltar em coluna customizada, setar `custom_column_id`; em coluna de sistema, setar `status` e limpar `custom_column_id`.

---

## Fora deste escopo (combinado antes)
- **Meta Conversions API** — fica pra quando você trouxer Pixel ID + Access Token.
- Notificações WhatsApp no Check-IN — pode ser próximo passo.

---

## Pergunta rápida antes de codar

O **gerente** hoje é a role `admin` ou existe role `manager` separada? No banco vi `super_admin`, `admin`, `attendant` — confirma se "gerente" = `admin` (que é o que vou usar) ou se você quer criar role nova.

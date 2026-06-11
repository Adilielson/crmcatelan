O sistema de Configurações da Agenda já está completo. A próxima funcionalidade pendente — mencionada anteriormente — é o fluxo de **resposta de follow-up**:

## 1. Botão "Marcar como respondido" nos follow-ups pendentes

Na aba **"Follow-ups de hoje"** da Agenda, adicionar um botão **"Marcar como respondido"** em cada card de follow-up (tanto ligações quanto WhatsApp).

O que o botão faz:
1. **Atualiza o follow-up**: muda `status` de `pending` para `responded` e grava `response_at`.
2. **Move o lead no Kanban**: atualiza o lead para a coluna de sistema **"Em Negociação"** (ou equivalente, via `system_key`).
3. **Feedback visual**: toast de confirmação + o card some da lista de pendentes.

## 2. Hook de mutation

Criar `useRespondToFollowup()` em `src/hooks/use-followups.ts` que:
- Recebe `followupId` e `leadId`.
- Atualiza `lead_followups`.
- Busca a coluna com `system_key = 'negotiation'` no `kanban_columns`.
- Atualiza o lead (`custom_column_id` ou `status`).
- Invalida queries de follow-ups e leads.

## 3. Ajustes na UI da TodayFollowupsTab

Adicionar o botão ao lado dos botões existentes (LIGAR / WHATSAPP) nos cards de ligação, e abaixo do cabeçalho nos cards de WhatsApp.

## 4. Preparação para automação futura (holdmap)

Deixar a mutation bem estruturada para que, no futuro, a IA possa chamar a mesma função automaticamente quando detectar resposta do lead — sem refatorar.

---

**Nada de migração SQL é necessária** — as tabelas (`lead_followups`, `kanban_columns`, `leads`) já existem. É apenas frontend + lógica de negócio no hook.

**Fora de escopo (fica pro holdmap):**
- Detecção automática pela IA de que o lead respondeu.
- Mensagem automática de agradecimento/confirmação ao lead.
- Notificação push para o atendente.
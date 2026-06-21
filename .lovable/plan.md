# Histórico completo do Lead + LTV real

Vamos entregar em duas fases sequenciais, **sempre com dados reais do banco** (nada de mockup). Nada de placeholder — se um dado não existir, simplesmente não aparece.

---

## Fase A — Timeline unificada de eventos reais

Hoje o painel do lead mostra **só mudanças de etapa**. Vamos juntar tudo que já existe no banco numa única timeline cronológica, com ícone e cor por tipo de evento.

### Eventos que vão entrar na timeline

| Tipo | Fonte (dados reais já existentes) |
|---|---|
| Lead criado | `leads.created_at` |
| Mudança de etapa | `lead_pipeline_history` |
| Atendente atribuído / transferido | **novo log** em `lead_pipeline_history` via trigger (quando `assigned_user_id` muda) |
| Agendamento criado | `appointments` (insert) |
| Agendamento remarcado | `appointments` (mudança de `scheduled_at`) |
| Agendamento cancelado | `appointments.status = 'cancelled'` |
| Check-in / Check-out | `appointments.checkin_at` / `checkout_at` |
| Compareceu / No-show | `appointments.status = 'completed' | 'no_show'` |
| Consulta resumida | `lead_consultation_summary.created_at` |
| Venda fechada | `leads.closed_at` + `sales_value` (Fase A) / `lead_purchases` (Fase B) |
| Lead perdido | `leads.lost_reason` + `closed_at` |
| Reativação | `leads.last_reactivated_at` |

### Como será montado

- **Server function** `getLeadTimeline(leadId)` que faz `UNION ALL` de todas as fontes acima e devolve uma lista única ordenada por data, já com label, ícone e ator (quem fez).
- O painel do lead (`LeadProfilePanel`) passa a renderizar essa lista no lugar da timeline atual de etapas.
- Filtros visuais por categoria (Etapas / Agendamentos / Vendas / Atendente) no topo da timeline.

### Mudança de banco (Fase A)

1. Trigger `log_lead_assignment_change` em `leads`: quando `assigned_user_id` muda, insere linha em `lead_pipeline_history` com `reason = 'assignment_change'` e os IDs envolvidos.
2. Trigger `log_appointment_events` em `appointments`: registra criação, remarcação, cancelamento, no-show e comparecimento no histórico do lead.
3. Coluna `event_type` (text) opcional em `lead_pipeline_history` para diferenciar `stage_change` / `assignment_change` / `appointment` na consulta.

Sem alteração nos dados existentes — só adiciona estrutura.

---

## Fase B — LTV real (tabela de compras + indicadores)

LTV de verdade precisa de uma tabela própria de compras (um lead pode comprar várias vezes ao longo dos anos).

### Nova tabela `lead_purchases`

Campos principais:
- `lead_id`, `tenant_id`, `unit_id`
- `purchase_date` (data da venda)
- `amount` (valor)
- `product_description` (texto livre — "armação + lente antirreflexo")
- `payment_method`, `installments`
- `attendant_id` (quem fechou)
- `appointment_id` (opcional — vincula à consulta que originou)
- `notes`

RLS por tenant. Service role + admin/manager podem inserir/editar; sellers só veem.

### UI

1. **No painel do lead** — novo bloco "LTV & Compras":
   - LTV total (soma de `amount`)
   - Nº de compras
   - Ticket médio
   - Última compra (data + valor)
   - Lista das compras (data, valor, produto, atendente)
   - Botão "Registrar compra"
2. **Dialog "Registrar compra"** — formulário simples para inserir uma venda.
3. **Quando o lead vai para "Fechado"** no Kanban — abre automaticamente o dialog de compra (substitui o `CloseLeadDialog` atual, que só pedia valor solto).
4. **Compras entram na timeline** da Fase A (com ícone de cifrão, valor e produto).

### Relatório novo `/relatorios/ltv`

Adicionado ao menu lateral de Relatórios:
- KPIs: LTV total da base, ticket médio geral, nº de clientes recorrentes (>1 compra), taxa de recompra
- Top clientes por LTV (tabela)
- Filtros: período, atendente, unidade
- Export Excel + PDF (mesmo padrão dos outros relatórios)

---

## Ordem de execução

1. Migration Fase A (triggers + coluna `event_type`)
2. Server fn `getLeadTimeline` + nova UI da timeline em `LeadProfilePanel`
3. Migration Fase B (`lead_purchases` + RLS + grants)
4. Dialog de registrar compra + bloco LTV no painel + integração no Kanban
5. Relatório `/relatorios/ltv` + entrada no menu
6. Compras aparecem na timeline unificada

---

## Pontos para você decidir antes

- **Substituir** o `CloseLeadDialog` atual pelo novo "Registrar compra" quando o lead vai pra Fechado, ou **manter os dois** (rápido = só valor, completo = registrar compra)?
- Vendedor comum (`seller`) pode **registrar compra** dos próprios leads, ou só admin/manager?
- Compra precisa estar vinculada a um **agendamento existente** ou pode ser avulsa (ex: cliente passou na loja sem agendar)?

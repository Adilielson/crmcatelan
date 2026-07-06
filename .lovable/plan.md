# Limpeza do Kanban + Tela única de Resultados

Fechamos as 4 decisões:
1. Tela única `/resultados` com abas Ganhos | Perdidos | Todos
2. Coluna "Re-agendar" removida
3. Motivo de perda usa o dropdown que já existe no `LostLeadDialog`
4. Botão fixo **Vendeu** (💰) + **Perdeu** (❌) em todo card do kanban

---

## 1. Migração (banco)

- Remover do kanban as colunas de sistema `won`, `lost`, `rescheduled` (marcar `is_active = false` ou deletar do `kanban_columns` por tenant — leads mantêm `status='showed_up'/'lost'`, só somem do board).
- Manter o enum de status intacto — os leads Ganhos/Perdidos continuam existindo, só não aparecem no board.
- Ajustar `seed_kanban_columns_for_tenant` para não recriar essas 3 colunas em novos tenants.

## 2. Kanban (`KanbanBoard.tsx` + card)

- Filtrar o board para esconder colunas com `system_key in ('won','lost','rescheduled')`.
- Esconder do board leads com `status in ('showed_up','lost')` mesmo que estejam em coluna custom.
- Card ganha **2 botões fixos** no rodapé (ao lado dos QuickActions):
  - 💰 **Vendeu** → abre `RegisterPurchaseDialog` com `closeLead={true}` (já existe, marca `status='showed_up'`)
  - ❌ **Perdeu** → abre `LostLeadDialog` existente (dropdown de motivos + campo livre)
- Ao salvar em qualquer um dos dois, o card desaparece do board automaticamente (pelo filtro de status acima).

## 3. Nova rota `/resultados`

Substitui a navegação para "vendas/perdidos separados". Estrutura:

```text
/resultados          → aba Todos (default)
/resultados/ganhos   → só showed_up
/resultados/perdidos → só lost
```

Cada aba tem:
- KPIs no topo (total, valor total R$, ticket médio, taxa de conversão)
- Filtros: período, atendente, unidade, motivo (só na aba Perdidos)
- Tabela: lead, atendente, data, valor / motivo, ações (ver detalhes, reengajar)
- Botão "Exportar CSV"

Sidebar da app ganha item **Resultados** no lugar de qualquer link antigo para vendas/perdidos.

## 4. Onde aplicar o dropdown de motivo de perda

O `LostLeadDialog` já tem o dropdown. Precisa garantir que ele seja usado em **todos os pontos** onde um lead pode virar Perdido:
- Kanban → botão ❌ Perdeu (novo)
- Kanban → drag para coluna Perdido (removido, então N/A)
- `NoShowReasonDialog` → motivos `desistiu`/`comprou_fora` já geram `status='lost'` — reaproveitar o mesmo enum de motivos do `LostLeadDialog` para consistência de relatório
- `LeadDetailSheet` / `LeadProfilePanel` → botão "Marcar como perdido" usa o mesmo dialog
- Chat / Fila / Follow-ups → onde houver ação "descartar lead", trocar por abrir o `LostLeadDialog`

## 5. Ordem de implementação

1. Migration: desativar 3 colunas + ajustar seed
2. `KanbanBoard`: filtro de colunas + filtro de status
3. Card: 2 botões fixos + wiring dos dialogs existentes
4. Rota `/resultados` + subrotas Ganhos/Perdidos/Todos + tabela + CSV
5. Sidebar: item "Resultados", remover links antigos
6. Auditar telas listadas em §4 e trocar por `LostLeadDialog`

## Detalhes técnicos

- Filtro do board: `columns.filter(c => !['won','lost','rescheduled'].includes(c.system_key))` + `leads.filter(l => !['showed_up','lost'].includes(l.status))`
- Botões do card ficam no `LeadQuickActions` como novos itens só em variant compact, ou num rodapé separado (prefiro rodapé pra não misturar com Agendar/Conversar/Valor)
- `/resultados` reaproveita `useLeads` com filtro `status in (...)` + `useLeadPurchases` agregado
- CSV via `lib/report-export.ts` que já existe

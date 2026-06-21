
# Módulo de BI, Metas e Relatórios

## 1. Auditoria do que JÁ existe (reaproveitável)

**Leads (`leads`)**
- `sales_value` (numeric) → venda de óculos ✅
- `status` com `showed_up` (compareceu), `no_show`, `scheduled`, `lost`, `followup` ✅
- `closed_at`, `first_contact_at`, `last_inbound_at`, `last_outbound_at` ✅
- UTM/Ads completos: `utm_source/medium/campaign/content/term`, `ad_id`, `ad_name`, `source_id` ✅
- `assigned_user_id` → responsável ✅
- `score_ia`, `ia_summary`, `ia_sentiment` → IA já marca leads ✅

**Agendamentos (`appointments`)**
- `type_exam` (text livre), `value` (numeric), `status` (com `completed`, `no_show`, `cancelled`) ✅
- Trigger `auto_checkout_on_close` já marca appointment como `completed` quando lead vira `showed_up` ✅

**Marketing**
- `marketing_sources` (utm, ad_id, platform), `marketing_spend` (date, spend, impressions, clicks) ✅
- Permite CPL, ROI, receita por campanha ✅

**IA**
- `ia_token_logs` (custo/tokens por tenant) ✅
- Falta: marcação de qual mensagem/agendamento foi feito pela IA

**Perfis (`profiles.role` enum)**
- Atual: `super_admin`, `admin`, `manager`, `seller`, `marketing_partner`
- Mapeamento solicitado:
  - Super Admin → `super_admin`
  - Administrador (dono) → `admin`
  - Gerente → `manager`
  - Atendente → `seller`
  - Gestor de Tráfego → `marketing_partner`

**Metas (`conversion_goals`)**
- Já existe metas de **taxa** (conversion_rate, CPA, no_show, appointments). NÃO há metas de **receita** (Bronze/Ouro/Diamante).

---

## 2. Gaps — o que precisa ser criado

1. **Parametrização de tipos de consulta + valor padrão**
   - Hoje `appointments.type_exam` é texto livre, sem valor padrão associado.
   - Criar `consultation_types (id, tenant_id, name, default_value, is_active)`.
   - Seed: "Optometrista" R$ 29,90 / "Oftalmológica" R$ 120,00.
   - Adicionar `appointments.consultation_type_id` (FK opcional, mantém `type_exam` p/ retrocompat).

2. **Metas de receita mensais (Bronze/Ouro/Diamante)**
   - Criar `revenue_goals (id, tenant_id, month, bronze, gold, diamond, active_tier, created_at, updated_at)`.
   - Meta individual = `active_tier ÷ atendentes ativos do mês` (calculado on-the-fly, recalcula sozinho quando entra/sai atendente).

3. **Marcação IA vs humano**
   - `appointments.created_by_ai boolean default false`.
   - `messages.is_from_ai boolean default false` (já temos `direction`; falta autor).
   - Backfill: NULL → falso.

4. **(Opcional) Custos de consulta parametrizáveis por unidade** — fora do escopo inicial, só global por tenant.

---

## 3. Regras de contabilização (server-side)

Toda métrica de receita usa uma única **view** `v_revenue_events` que une:
- **Consultas pagas:** `appointments` com `status='completed'` E lead com `status='showed_up'` → valor = `appointments.value` (ou `consultation_types.default_value` se null).
- **Vendas de óculos:** `leads` com `status='showed_up'` E `sales_value > 0` → valor = `sales_value`, data = `closed_at`, atendente = `assigned_user_id`.

Receita por atendente/mês = soma dos dois. Usado em ranking, metas e dashboards.

---

## 4. Fases de entrega

**Fase 1 — Fundação (migração + settings)**
- Migração: `consultation_types`, `revenue_goals`, novas colunas `created_by_ai`, `consultation_type_id`.
- Tela `Configurações → Consultas & Metas` (somente admin/super_admin): edita tipos+valores e metas Bronze/Ouro/Diamante.
- View `v_revenue_events` + server fn `getRevenueByPeriod`.

**Fase 2 — Metas & Ranking**
- Rota `/metas` (admin/manager/seller; atendente vê só sua linha).
- Dashboard de meta da loja: tier atual, realizado, faltante, %, barras Bronze/Ouro/Diamante.
- Ranking mensal: posição, nome, meta individual, realizado, %, diferença.

**Fase 3 — Dashboard Executivo**
- Rota `/bi` (admin/super_admin/manager).
- KPIs: leads recebidos, qualificados, agendamentos, comparecimentos, faltas, receita consultas, receita vendas, receita total, ticket médio, % meta, top 3 ranking.
- Filtros: período, atendente, campanha, origem.

**Fase 4 — Relatórios operacionais**
- `/relatorios/atendentes` — tabela por atendente.
- `/relatorios/agendamentos` — por dia/semana/mês/horário + heatmap.
- `/relatorios/comparecimento` — taxas show/no-show/remarcou/cancelou.
- Export PDF + Excel (via `jspdf` + `xlsx`, client-side).

**Fase 5 — BI Marketing & IA**
- `/relatorios/marketing` — leads/CPL/conversão/receita por campanha/anúncio/conjunto (gestor de tráfego entra aqui).
- `/relatorios/ia` — atendidos IA vs humano, agendamentos IA vs humano, conversão comparada.

---

## 5. Permissões (resumo da matriz)

| Rota | super_admin | admin | manager | seller | marketing_partner |
|---|---|---|---|---|---|
| /bi (executivo) | ✅ | ✅ | ✅ | ❌ | ❌ |
| /metas (loja) | ✅ | ✅ | ✅ | own row | ❌ |
| /ranking | ✅ | ✅ | ✅ | ✅ | ❌ |
| /relatorios/atendentes | ✅ | ✅ | ✅ | own row | ❌ |
| /relatorios/agendamentos | ✅ | ✅ | ✅ | own row | ❌ |
| /relatorios/comparecimento | ✅ | ✅ | ✅ | ❌ | ❌ |
| /relatorios/marketing | ✅ | ✅ | ❌ | ❌ | ✅ |
| /relatorios/ia | ✅ | ✅ | ✅ | ❌ | ❌ |
| Configurações (tipos/valores/metas) | ✅ | ✅ | ❌ | ❌ | ❌ |

Tudo enforced via RLS + checagem nas server functions com `has_role`.

---

## 6. Detalhes técnicos

- Server functions em `src/lib/bi.functions.ts`, `revenue-goals.functions.ts`, `consultation-types.functions.ts`.
- Views SQL para performance (`v_revenue_events`, `v_attendant_monthly`, `v_marketing_kpis`).
- Exportação PDF/Excel client-side com `jspdf-autotable` e `xlsx` (sem novas deps server).
- Charts: usa o `recharts` já instalado.
- Filtros padronizados via componente `<BiFilters>` reutilizável.

---

## Pergunta antes de migrar

1. Confirma a fórmula da meta individual = **meta do tier ativo ÷ atendentes ativos no mês**? (atendentes = `role='seller'` `status='active'`)
2. O **tier ativo** (Bronze/Ouro/Diamante) é escolhido manualmente pelo admin a cada mês, ou é sempre o próximo ainda não atingido?
3. Vendas de óculos: contabilizamos **na data de `closed_at`** (quando lead foi para `showed_up`) — ok? Ou existe alguma data de venda separada?

Aprovando, executo a **Fase 1** (migração + tela de configuração de tipos/valores/metas).

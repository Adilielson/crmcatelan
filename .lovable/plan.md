
## Levantamento — onde ainda há mock

Varrendo todas as rotas, encontrei **5 telas** com dados hardcoded (arrays JS fixos, números fantasiosos). Tudo o que é Kanban / Agenda / Chat / Leads / Usuários / WhatsApp **já lê do Supabase** (via `useLeads`, `useAgenda`, `useChatStore`, `useWhatsApp`, etc.) — não precisa mexer.

### 1. `/` (Dashboard) — `src/routes/index.tsx`
- `funnelData` (4 colunas com valores 120/85/42/15) — **MOCK**
- `sourceData` (WhatsApp 65% / Insta 25% / Google 10%) — **MOCK**
- KPI cards: valores principais já vêm de `useLeads` ✅ — mas os deltas (`change`: "+12.5%", "R$ 12k", "+8", "92%") são strings fixas
- "Alertas de SLA / Estagnação": array inline com Roberto Lima e Ana Souza — **MOCK**
- Filtro de unidade existe mas **não filtra nada** (variável `selectedUnit` ignorada)

### 2. `/performance` (Métricas de IA) — `src/routes/performance.tsx`
- **100% mock**: `stats`, `funnelData`, `dropOffReasons` — sem nenhuma query ao Supabase

### 3. `/analytics/no-show` — `src/routes/analytics/no-show.tsx`
- **100% mock**: `attendanceTrend`, `sourceData`, `reasonsData`, todos os 4 MetricCards (77.5%, 22.5%, 18.2%, R$ 12.450), `noShowRate` fixa, lista de recuperação inline
- Filtros (`period`, `unit`) declarados mas **não usados**

### 4. `/marketing` — `src/routes/marketing.tsx`
- `performanceData` (6 dias hardcoded com clicks/leads/conversions/spend/roi) — **MOCK**
- `creativePerformance` (4 criativos fixos) — **MOCK**
- Dropdown "Loja Centro/Sul" hardcoded (não lê de `units`)
- Existe tabela `marketing_sources` + `marketing_spend` + `marketing_integrations` no banco ainda sem uso

### 5. `/saas` (Super Admin) — `src/routes/saas.tsx`
- `tenants` já vem do Supabase ✅
- `planDistribution` já calcula em cima de tenants reais ✅
- `revenueData` (Jan-Mai com MRR/profit fixos) — **MOCK** (precisa de tabela de billing/assinatura — hoje não existe)

---

## Plano de execução (3 etapas, ordem proposta)

### Etapa A — Server functions de agregação (1 migração + 1 arquivo de fns)
Crio `src/lib/analytics.functions.ts` com `createServerFn` para cada agregação, usando `requireSupabaseAuth` (tudo respeitando RLS por `tenant_id`):

1. `getDashboardMetrics({ unitId? })` — retorna:
   - KPIs: total leads, valor pipeline, agendados próximos 7d, taxa qualificação IA — **com delta vs período anterior** (calculado de verdade)
   - `funnelData`: COUNT de leads agrupado por `kanban_columns.system_key`
   - `sourceData`: COUNT de leads agrupado por `marketing_sources.canal` (ou `leads.source`)
   - `slaAlerts`: leads com `updated_at < now() - 4h` parados em `open`/`in_progress`

2. `getIAPerformanceMetrics({ period })` — usa `ia_token_logs` + `leads`:
   - Total processado, qualificados (`score_ia >= 70`), desqualificados, horas economizadas (estimativa via tokens × constante)
   - Funil: leads por estágio de qualificação
   - Drop-off: agregação de `lead_consultation_summary` por etapa onde IA perdeu engajamento

3. `getNoShowMetrics({ period, unitId? })` — usa `appointments`:
   - Taxa de presença / no-show / conversão (status `completed`/`no_show`)
   - Perda estimada (no-show × ticket médio configurável)
   - Tendência mensal (últimos 6 meses, GROUP BY DATE_TRUNC)
   - No-show por origem (JOIN com `leads.source`)
   - Lista de recuperação: appointments `no_show` últimos 7d

4. `getMarketingMetrics({ period, unitId? })` — usa `marketing_spend` + `leads`:
   - Performance diária (clicks/leads/conv/spend/ROI)
   - Top criativos (GROUP BY `leads.utm_content`)
   - Dropdown de unidades reais (`units`)

5. `getSaasRevenueMetrics()` — só super_admin:
   - MRR calculado por `tenants.plan` × valor de `plans.price_monthly` (tabela `plans` já existe)
   - Tendência mensal: COUNT tenants ativos por mês de `created_at` × preço do plano

> Não precisa de nova migração para A1–A4 (todas as tabelas existem). A5 também não — `plans` já está lá.

### Etapa B — Conectar UI ao backend (uma rota por vez, sem quebrar nada)
Padrão TanStack Query + `useServerFn`:
```ts
const fetchMetrics = useServerFn(getDashboardMetrics)
const { data } = useSuspenseQuery({ queryKey: ['dashboard', unitId], queryFn: () => fetchMetrics({ data: { unitId } }) })
```
- Remover todos os arrays `const xxxData = [...]`
- Trocar deltas hardcoded por valores calculados
- Ativar filtros de unidade/período já presentes na UI
- Loading skeleton + empty states (quando o tenant não tem dados ainda — caso da Catelan no dia 1)

### Etapa C — Empty states elegantes (importante p/ go-live sexta)
Como a Catelan vai entrar com banco quase vazio, sem isso as telas mostram "0" e gráficos vazios sem explicação. Adiciono:
- Mensagens tipo "Sem dados ainda — comece criando leads no Kanban"
- Gráficos com placeholder visual neutro (sem fingir dados)
- Botões de atalho para a ação que gera o dado (ex: "Criar lead", "Configurar WhatsApp")

---

## Ordem sugerida de entrega
Posso fazer tudo de uma vez (~1 sessão grande) **ou** em 3 PRs separados:

1. **PR1 (crítico p/ sexta):** Dashboard + No-Show conectados (são as duas telas que a Catelan vai abrir primeiro)
2. **PR2:** Performance IA + Marketing
3. **PR3:** SaaS revenue (menos urgente — só super_admin vê)

---

## Riscos / pontos de atenção
- `lead_consultation_summary` pode estar vazia → o "drop-off" da IA fica em empty state até a IA rodar de verdade
- Tabela `plans` precisa estar populada com preços para o MRR fazer sentido (hoje provavelmente está vazia — confirmo na execução)
- `marketing_spend` exige que o usuário cadastre gasto manualmente OU integre Meta/Google Ads — sem isso, ROI fica em 0; vou deixar empty state claro

## Confirma?
Quer que eu comece pelo **PR1 (Dashboard + No-Show)** já agora, ou prefere outra ordem?

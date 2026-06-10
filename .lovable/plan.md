## Como vou trabalhar
**Uma etapa por vez.** Ao fim de cada uma eu: (1) testo via preview + queries no banco, (2) corrijo erros que aparecerem, (3) te peço OK antes de seguir. Se uma etapa quebrar algo de outra, paro e te aviso.

## Estado real do código (verificado agora)
- ✅ Auth Supabase funcional (você confirmou login OK)
- ⚠️ `useAuthStore` carrega perfil/tenant real, mas várias telas ainda usam `DEV_TENANT_ID` hardcoded em vez de `useAuthStore().tenant?.id`
- ⚠️ `use-leads.ts` (Query-based, novo) **e** `use-kanban.ts` (Zustand mock) **coexistem** → KanbanBoard, Agenda e Chat provavelmente ainda leem do mock
- ❌ Agenda, Chat, Dashboard, Performance, Marketing, SaaS, Analytics → dados hardcoded
- ❌ IA SDR: campos `ia_*` em `leads` nunca são preenchidos
- ❌ AI Training: server fn parcial com TODO de auth
- ✅ WhatsApp: edge functions já gravam em `whatsapp_message_logs`

---

## Roadmap (8 etapas)

### Etapa 1 — Fechar o Kanban real *(começo aqui)*
- Verificar quem ainda importa `use-kanban` (mock) → migrar para `use-leads`
- Trocar `DEV_TENANT_ID` por `useAuthStore().tenant?.id` em `use-leads` + componentes
- Apagar `use-kanban.ts` Zustand quando ninguém mais usar
- Validar RLS de `leads` para INSERT/UPDATE/DELETE pelo user logado (migração se faltar)
- **Teste:** criar lead, mover, editar, excluir; conferir no banco

### Etapa 2 — Agenda real (`appointments`)
- `src/lib/appointments.functions.ts` com `requireSupabaseAuth`
- Hook `use-appointments` (Query)
- Refazer `agenda.tsx` (calendário, lista, criar/editar)
- Integração: arrastar lead para "Agendado" no Kanban abre dialog de agendamento real
- **Teste:** criar appointment → aparece na agenda → trigger atualiza `professional_performance`

### Etapa 3 — Chat real (`conversations` + `messages` + realtime)
- `src/lib/chat.functions.ts` (listar conversas, mensagens, enviar)
- Hook + assinatura realtime no `messages`
- `chat.tsx`: lista de conversas reais, abrir conversa por `?phone=`
- Botão enviar → grava em `messages` + chama edge `whatsapp-manage` para entregar
- **Teste:** disparar webhook simulado → conversa aparece; enviar resposta → grava

### Etapa 4 — Dashboards reais
- `src/lib/analytics.functions.ts` com agregações por tenant
- Funil, sources, no-show, performance por profissional, ROI marketing
- Index, Performance, Marketing, Analytics consomem via `useQuery`
- **Teste:** com dados das etapas 1-3 + botão "Seed demo" para ter volume

### Etapa 5 — IA SDR real (Lovable AI Gateway)
- Server fn `score-lead` usando `google/gemini-3-flash-preview` + `Output.object` (schema pequeno)
- Preenche `ia_score`, `ia_status`, `ia_resumo`, `ia_sugestao_proximo_passo`, `ia_urgencia`, `ia_sentimento`, `ia_perfil`, `ia_tags`, `ia_interesses` em `leads`
- Registra `ia_token_logs` (trigger soma em `tenants.ia_token_used`)
- Botão "Analisar com IA" no card + opcional auto ao criar lead
- **Teste:** rodar em lead real, conferir colunas preenchidas, conferir contador de tokens

### Etapa 6 — AI Training + Knowledge Base
- Concluir `ai-training.functions.ts` (trocar TODO por `requireSupabaseAuth`)
- Upload + chunking + embeddings (Lovable AI embeddings) → `ai_knowledge_documents`
- Editor de prompt por unidade → `ai_configs` / `unit_ai_configs`
- Botão "Testar prompt" chama gateway com config atual
- **Teste:** subir doc, editar prompt, rodar teste

### Etapa 7 — SaaS / Settings / Users / WhatsApp
- SaaS: ler `saas_mrr_stats`, `tenants.plan`, `saas_ia_usage_summary`
- Users/Settings: CRUD `profiles`, `units`, `profile_units` (com `is_tenant_admin`)
- WhatsApp: status real lendo `whatsapp_config` + ações via edge existente
- **Teste:** convidar usuário, criar unidade, conectar WhatsApp

### Etapa 8 — Smoke test end-to-end + limpeza
- Botão "Seed demo" idempotente (5 leads, 3 appointments, 2 conversas)
- Remover stores mock restantes (`useChatStore`, etc.)
- Walk-through: login → lead → mover → agendar → conversar → IA → dashboard
- Rodar `supabase--linter` e tratar achados relevantes

---

## Riscos antecipados (e mitigação)
- **RLS bloqueando insert/update** → checo policies antes de cada etapa, migração no mesmo passo + GRANTs
- **Tenant ausente para super_admin** → fallback claro ou seletor de tenant
- **Realtime sem permissão** → publication + RLS para `messages`
- **IA cota 402/429** → toast claro + retry com backoff
- **Triggers existentes** (`update_performance_metrics`, `update_tenant_ia_usage`) → não duplicar lógica no app
- **Lead sem `assigned_user_id`** → default = user logado no insert
- **WhatsApp webhook chega antes da conversation** → upsert
- **Dev runtime sem `SUPABASE_SERVICE_ROLE_KEY`** → seguir padrão `dev-tenant.server.ts` (publishable key) onde admin não for essencial

---

## Vamos começar pela Etapa 1?
Confirma com um "vai" que eu já: (a) abro o build mode, (b) faço o diff exato do Kanban, (c) migro, (d) testo e te mostro o resultado.

Se quiser inverter alguma ordem (ex.: IA antes do Chat) me diz agora.

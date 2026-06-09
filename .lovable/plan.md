# Kanban de Leads → 100% Supabase

## Contexto importante (decisões que preciso confirmar)

1. **Não existe tabela `organizations` neste projeto.** O multi-tenant é feito via tabela `tenants` (UUID). A tabela `leads` **já existe** com `tenant_id uuid`, `full_name`, `phone`, `email`, `status`, `sales_value`, `priority`, `tags`, `assigned_user_id`, `score_ia`, `ia_*` etc. **Vou usar a tabela existente** em vez de criar uma nova — assim não perdemos o resto do CRM (IA, marketing, performance) que já referencia `leads`.

2. **Não há autenticação real implementada.** O `useAuthStore` retorna um usuário fake com `tenant_id: 'tenant-1'` (string, não UUID). Para o Kanban funcionar com RLS real, precisamos de **um tenant UUID fixo de desenvolvimento** + ajustar o `useAuthStore` para usar esse UUID. Auth completa via Supabase Auth fica fora desse escopo (é trabalho próprio).

3. **Mapeamento de stages:** vou usar os valores que o schema `leads.status` já aceita (texto livre) e padronizar as colunas do Kanban como labels exibidos, persistindo internamente: `novo`, `em_atendimento`, `agendado`, `perdido`, `fechado`.

---

## PARTE 1 — Migração + seed inicial

Migration única:
- Criar tenant fixo de dev `00000000-0000-0000-0000-000000000001` ("Ótica Catelan Matriz") se não existir.
- Adicionar colunas faltantes em `leads`: `notes text`, `source text` (já temos `source_id`, mas a UI usa rótulo livre `whatsapp/instagram/google/direct`).
- Ajustar/criar RLS de `leads`: políticas permissivas por enquanto (`USING (true)` para SELECT/INSERT/UPDATE/DELETE) com comentário "TODO: trocar por auth.uid() quando autenticação for implementada". Sem isso o front mock-auth não acessa nada.
- Garantir GRANTs para `anon`, `authenticated`, `service_role`.
- Seed: inserir João Silva e Maria Souza apenas se a tabela estiver vazia para esse tenant.

## PARTE 2 — Camada de dados

- Trocar `useAuthStore` para usar o UUID do tenant dev (mantém formato compatível).
- Reescrever `src/hooks/use-kanban.ts`: remover Zustand mock, exportar hooks baseados em **TanStack Query**:
  - `useLeads()` → `useQuery` lendo `leads` filtrado por `tenant_id`.
  - `useCreateLead()`, `useUpdateLead()`, `useMoveLead()`, `useDeleteLead()` → `useMutation` com `invalidateQueries(['leads'])`.
- Manter a interface `Lead` mas mapeada para colunas reais do banco (`full_name` ↔ `name`, `sales_value` ↔ `value`, `status` ↔ stage).
- Pipelines continuam mockados (não há tabela de pipelines) — só serve pra agrupar visualmente; vou simplificar para 1 pipeline único enquanto não houver tabela.

## PARTE 3 — UI do Kanban (`KanbanBoard.tsx`)

- Substituir leitura do store por `useLeads()`.
- **Botão "Novo Lead"**: abre Dialog com form (nome, telefone, email, valor, source, notas) → `useCreateLead`.
- **Clique no card**: abre **Sheet lateral** (`@/components/ui/sheet`) com detalhes completos editáveis (nome, telefone, email, valor, stage, source, notas) + botão "Salvar" → `useUpdateLead`. Mostra também `score_ia`, `ia_summary` se houver.
- **4 ícones do card** (cada um abre seu próprio modal/ação, `stopPropagation` para não abrir o Sheet):
  1. 📅 **Calendário** → Dialog de agendamento (data/hora/tipo de exame) → insere em `appointments` real + toast.
  2. 💬 **Chat** → `navigate({ to: '/chat', search: { phone: lead.phone } })` (rota chat já lê `phone` para filtrar — ajuste pequeno na rota).
  3. 📍 **Localização** → Dialog mostra `units` disponíveis (já existem no schema) e permite associar via `unit_id` → `useUpdateLead`.
  4. 💲 **Valor** → Dialog com Input numérico → `useUpdateLead({ sales_value })`.
- Estado vazio bonito quando não há leads.
- Toasts (`sonner`) em todas mutations.

## PARTE 4 — Drag & drop persistente

- Manter HTML5 drag-and-drop atual.
- No `onDrop` chamar `useMoveLead({ id, status })` → UPDATE real + toast "Lead movido para X".
- Optimistic update via `queryClient.setQueryData` para feedback imediato.
- Manter dialogs especiais ao soltar em "Agendado" (abre modal de agenda) e "Perdido" (motivo).

## PARTE 5 — Seed/exemplo

- Botão extra no header "Importar exemplos" que insere 3 leads de demonstração (apenas se não houver leads ainda). Aparece desabilitado quando já há dados.

---

## Arquivos afetados

- `supabase/migrations/<timestamp>_kanban_leads_setup.sql` (nova)
- `src/hooks/use-auth.ts` (trocar tenant_id para UUID)
- `src/hooks/use-kanban.ts` (reescrever — Query-based)
- `src/components/kanban/KanbanBoard.tsx` (UI + handlers reais)
- `src/components/kanban/LeadDetailSheet.tsx` (novo — painel lateral)
- `src/components/kanban/LeadFormDialog.tsx` (novo — criar/editar)
- `src/components/kanban/LeadValueDialog.tsx`, `LeadLocationDialog.tsx` (novos — modais dos ícones)
- `src/routes/chat.tsx` (aceitar `?phone=` na search para abrir a conversa certa)

## O que **não** vou fazer (fora de escopo)

- Não implemento Supabase Auth completo agora — sigo com o mock-auth mas usando UUID real. RLS fica permissiva com TODO.
- Não migro Agenda/Chat para Supabase real nesta tarefa (Chat depende do webhook que já está gravando em `whatsapp_message_logs` — tarefa separada).
- Não crio tabela `organizations` (o projeto usa `tenants`).

---

**Quer que eu prossiga com esse plano?** Se preferir, posso também:
- (a) Implementar Supabase Auth de verdade primeiro, antes do Kanban (mais trabalhoso, mas RLS fica correta).
- (b) Fazer só o essencial: persistir leads + drag/drop, deixar os 4 modais dos ícones em fase 2.

## Diagnóstico do bug "clicar no lead não faz nada"

O `/chat` (`src/routes/chat.tsx`) tem **3 colunas fixas lado a lado**:

```text
[ Lista 360px ] [ Conversa flex-1 ] [ Painel IA/Perfil 340px ]
```

Soma mínima ≈ **900px**. No seu viewport atual (**768px**) e em qualquer tablet/notebook estreito:

- A coluna da conversa fica **espremida ou empurrada para fora** da tela.
- O clique **funciona** (`setSelectedPhone` é chamado), mas o painel da conversa renderizado fica fora do viewport ou atrás da coluna 3.
- Resultado visual: "cliquei e não aconteceu nada".

Não é bug de handler — é bug de layout. A correção definitiva é tornar o `/chat` responsivo no mesmo padrão WhatsApp Web: lista → conversa → detalhes, com drill-down quando não couber tudo.

## O que vou implementar

### 1. Layout responsivo no `/chat` desktop (corrige o clique morto)

- **≥ 1280px (xl)**: mantém as 3 colunas como hoje.
- **1024–1279px (lg)**: 2 colunas — lista (320px) + conversa (flex-1). Painel direito (IA/Perfil) vira um **Sheet** lateral aberto por um botão "Detalhes" no header.
- **< 1024px**: 1 coluna por vez no estilo drill-down:
  - Sem conversa selecionada → mostra só a lista.
  - Com conversa selecionada → mostra só a conversa + botão "voltar" no header.
  - Botão "Detalhes" abre o painel IA/Perfil como Sheet inferior/lateral.

O estado `selectedPhone` já controla isso — basta usar classes condicionais e o componente Sheet do shadcn (já instalado).

### 2. Barra de atalhos rápidos no cabeçalho da conversa

Hoje o header da conversa só tem: encaminhar, ligar, more. Vou adicionar uma **toolbar logo abaixo do header** com:

| Atalho | Ação |
|---|---|
| **Status** (Select) | Move o lead de coluna (open → in_progress → scheduled → showed_up → lost…), reusando as `kanban_columns` do tenant. Update direto no `leads.status` / `custom_column_id`, igual ao Kanban. |
| **Agendar** | Abre o mesmo dialog do `LeadQuickActions` (data/hora + cria appointment + move para `scheduled`). |
| **Transferir** | Reaproveita o dialog `isRoutingOpen` que **já existe** no arquivo, mas hoje só mostra toast fake. Vou trocar pelo Select real de atendentes (carregado de `profiles` do tenant via `useTeam` / query) e fazer o `UPDATE leads.assigned_user_id`. |
| **Local** | Abre `LeadLocationDialog` (já existe). |
| **Valor** | Abre `LeadValueDialog` (já existe). |
| **Ver ficha** | Abre o Sheet do painel direito (em telas pequenas). |

Implementação: reusar o componente `LeadQuickActions` (já existe, `variant="compact"`) + adicionar um `Select` de status ao lado. O componente já tem os 4 atalhos do print (Agendar / Conversar / Local / Valor) — só precisa ocultar "Conversar" (`hideChat`) porque já estamos no chat, e somar status + transferir.

### 3. Tornar o "Transferir" funcional

O dialog `isRoutingOpen` no `chat.tsx` hoje tem opções hardcoded ("Carlos", "Ana", "Roberto") e só dá `toast.success`. Vou:

- Carregar atendentes reais com `useTeam()` (hook já existe via `src/lib/team.functions.ts`).
- Ao confirmar: `UPDATE leads SET assigned_user_id = :userId, status = 'in_progress' WHERE id = :leadId` (mesma lógica da fila).
- Invalidar `['leads', tenantId]` e `useWhatsAppChat`.
- Manter as opções de "Fila Circular" / "Especialista" como rótulo visual mas com toast informando que ainda não estão automatizadas (até o plano de distribuição que ficou para depois).

## Estrutura técnica

```text
src/routes/chat.tsx
  - adicionar useState selectedPhone já existe ✅
  - novo: const showList = !selectedPhone || isWide
  - novo: const [detailsOpen, setDetailsOpen] = useState(false)
  - col 1: className condicional (hidden em < lg quando há conversa)
  - col 2: header ganha botão "voltar" (< lg) e botão "detalhes" (< xl)
  - col 2: nova ChatQuickActionsBar logo abaixo do header
  - col 3: vira Sheet em < xl, mantém fixed em xl+

src/components/chat/ChatQuickActionsBar.tsx (NOVO)
  - Select de status (usa useKanbanColumns)
  - Botão Transferir → abre dialog
  - Reusa <LeadQuickActions lead={lead} variant="compact" hideChat />
  - Botão "Ver ficha" só aparece quando o painel direito está como Sheet
```

## Fora do escopo

- **Distribuição automática / round-robin / cap por atendente**: já combinamos discutir depois deste fix.
- Não vou mexer no envio de mensagem, gravação de áudio nem na lógica do `useWhatsAppChat`.
- Não vou redesenhar o mobile `/m/chat/$phone` — ele já tem layout próprio.
- Não vou alterar nenhuma rota, query ou tabela do Supabase.

## Pergunta antes de executar

Você quer que o atalho **"Status"** mostre **todas as colunas do Kanban** do tenant (incluindo as customizadas), ou apenas os status do sistema (Em Atendimento, Agendado, Fechado, Follow-up, Perdido)?
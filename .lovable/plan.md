## Objetivo

Garantir que o **lead** apareça com os mesmos dados e os mesmos atalhos rápidos em **toda** a aplicação — Chat (desktop), Kanban (desktop), Sheet do Kanban, Chat mobile e Funil mobile — e corrigir o clique no lead que hoje não responde em tablet/celular.

## Diagnóstico atual

| Local | O que mostra hoje | Problema |
|---|---|---|
| Kanban → card | Dados básicos + 4 atalhos (Agenda, Chat, Mapa, Valor) | ✅ referência |
| Kanban → "abrir lead" (sheet) | `LeadProfilePanel` completo + edição | Falta atalhos rápidos |
| Chat desktop → aba "Lead" | `LeadProfilePanel` completo | Falta atalhos rápidos |
| Chat desktop → aba "IA SDR" | Resumo IA com layout próprio (duplicado) | Inconsistente com o painel |
| Mobile `/m/chat/:phone` → Ficha | `LeadInfoSheet` com lista de Fields simples | Dados diferentes do desktop, sem histórico, sem receita, sem atalhos |
| Mobile `/m/leads` | Placeholder "em construção" | Clicar no menu não leva a nada útil |
| Mobile `/m/funil` | Placeholder "em construção" | Idem |

## O que vamos construir

### 1. Componente único de atalhos: `LeadQuickActions`
Novo arquivo `src/components/leads/LeadQuickActions.tsx` com os 4 botões já existentes no card do Kanban (Agendar, Conversar, Local, Valor) + estado dos diálogos. Recebe o lead e callbacks; renderiza compacto (icon-only) ou estendido (icon + label) via prop `variant`.

### 2. Atualizar `LeadProfilePanel`
- Aceitar prop `showActions?: boolean` (default `true`).
- Quando `true`, renderiza `LeadQuickActions` logo abaixo do cabeçalho.
- Aceitar prop `onOpenChat?` opcional para usar a navegação correta em mobile (`/m/chat/$phone`) vs desktop (`/chat?phone=`).

### 3. Reusar em todos os lugares

- **Kanban `LeadDetailSheet`** → já usa `LeadProfilePanel`, agora ganha os atalhos automaticamente.
- **Kanban `LeadCard`** → continua com a versão compacta dos botões inline.
- **Chat desktop (`src/routes/chat.tsx`)** → aba "Lead" passa a ser o `LeadProfilePanel` com atalhos (`onOpenChat` no-op porque já está no chat). A aba "IA SDR" mantém apenas o foco em insights da IA.
- **Mobile `/m/chat/$phone` → `LeadInfoSheet`** → substituir a renderização atual de `Field`s pelo `LeadProfilePanel` (`compact`), trazendo histórico, receita, resumo da consulta e atalhos. O atalho de chat fica oculto (já está no chat) e o atalho de agendar abre um sheet mobile.

### 4. Mobile: fazer o lead realmente abrir

- **`/m/leads`**: trocar o placeholder por uma lista vertical estilo "feed" dos leads do usuário (mesma `useLeads()` filtrada por `assigned_user_id`). Cada item abre um **Sheet** (`side="bottom"`) com o `LeadProfilePanel` completo + atalhos.
- **`/m/funil`**: trocar o placeholder por um kanban horizontal scrollável (mesmas colunas do `useKanbanColumns`), cards menores. Tocar no card abre o mesmo Sheet.

## Estrutura técnica

```text
src/components/leads/
  LeadProfilePanel.tsx       (existente, adiciona showActions/onOpenChat)
  LeadQuickActions.tsx       (NOVO)
  LeadDetailMobileSheet.tsx  (NOVO — wrapper para mobile)

src/components/kanban/
  KanbanBoard.tsx            (LeadCard continua usando atalhos inline)
  LeadDetailSheet.tsx        (mantém edição, ganha atalhos via panel)

src/routes/
  chat.tsx                   (aba "Lead" simplificada)
  m.chat.$phone.tsx          (LeadInfoSheet usa LeadProfilePanel)
  m.leads.tsx                (lista de leads do usuário)
  m.funil.tsx                (mini kanban mobile)
```

## Comportamento dos atalhos

| Botão | Desktop | Mobile |
|---|---|---|
| Agendar | Abre dialog de agendamento (mesmo do Kanban) | Mesmo dialog |
| Conversar | Navega para `/chat?phone=...` (oculto se já está no chat) | Navega para `/m/chat/$phone` |
| Local | Abre `LeadLocationDialog` | Idem |
| Valor | Abre `LeadValueDialog` | Idem |

## Fora do escopo

- Não vou redesenhar o Kanban desktop pra rodar no celular (existe a rota mobile dedicada `/m/funil`).
- Não vou mexer no envio de mensagem do chat, apenas no painel do lead.
- Permissões já são respeitadas pelo `usePermissions` existente.

## Pergunta antes de executar

A descrição "no tablet e celular quando clica no lead não acontece nada" — confirma que isso acontece principalmente em **`/m/leads`** e **`/m/funil`** (que hoje são placeholders)? Ou você está vendo um clique morto em outro lugar específico (ex: dentro da conversa do `/m/chat`)? Se for outro lugar, me diga onde para eu cobrir no plano.

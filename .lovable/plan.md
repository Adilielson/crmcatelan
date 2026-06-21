## Objetivo

Fazer a IA SDR soar como a Raiana: concisa, analítica, humana. Hoje a Sombra aprende frases vencedoras misturadas de todos os atendentes — vamos focar nela (e em qualquer outra "referência" que você marcar), priorizar conversas que terminaram em agendamento/fechamento, e extrair um **perfil de estilo** que entra direto no prompt da IA SDR.

## O que muda

### 1. Banco — marcar referências e guardar o estilo
- `profiles.is_reference_agent boolean default false` — você marca a Raiana (e outras) na tela de Equipe com um toggle "Referência de atendimento".
- `ai_reference_style_profiles` (nova tabela, 1 linha por tenant):
  - `style_guide jsonb` — traços extraídos (ex.: `avg_msg_length`, `questions_per_message`, `uses_emoji`, `uses_client_name`, `opening_patterns`, `closing_patterns`, `tone_descriptors`)
  - `style_prompt text` — versão pronta pra colar no system prompt
  - `sample_count int`, `last_built_at timestamptz`
- `ai_knowledge_patterns.weight numeric default 1` — peso da frase (3x quando vem de lead ganho).
- `ai_knowledge_patterns.agent_id uuid` — pra dar visibilidade de quem ensinou.

### 2. Aprendizado com peso e atribuição
Em `ai-insights.functions.ts` (analyzeLeadConversation):
- Identifica o atendente humano da mensagem (via `messages.profile_id` se existir, senão por nome no transcript).
- Se for `is_reference_agent = true`: salva pattern com `agent_id` e `weight = 3` quando outcome ∈ {scheduled, checked_in, showed_up}.
- Outros atendentes / outcomes neutros: `weight = 1`.
- Patterns de leads `lost` → `weight = 0.3` (ainda aprendem, mas afundam no ranking).

### 3. Style guide automático (o coração da mudança)
Novo server fn `buildReferenceStyleProfile(tenantId)`:
1. Busca as últimas 50 conversas atendidas por agentes-referência que terminaram bem.
2. Extrai só as mensagens **outbound da Raiana**.
3. Calcula métricas determinísticas: média de caracteres por mensagem, % com emoji, % com pergunta, palavras de abertura mais comuns, uso do nome do cliente.
4. Manda pra IA um meta-prompt: "analise estas mensagens da Raiana e descreva o estilo dela em até 8 bullets curtos — tom, comprimento, ritmo, perguntas, gatilhos, o que ela NÃO faz."
5. Grava `style_guide` (métricas) + `style_prompt` (texto pronto) em `ai_reference_style_profiles`.

### 4. Injeção no prompt da IA SDR
No system prompt da IA SDR (e do `suggestReply`), substituir o bloco genérico "frases que funcionam" por:

```
=== ESTILO DE ATENDIMENTO (siga rigorosamente) ===
{style_prompt da Raiana}

Métricas a respeitar:
- Mensagens de até {avg_msg_length} caracteres
- No máximo 1 pergunta por mensagem
- {uses_emoji ? "Emoji ocasional" : "Sem emojis"}
- Sempre use o nome do cliente quando souber

=== FRASES DE REFERÊNCIA (use como inspiração, não copie literal) ===
{top 10 winning_phrases ordenadas por weight * occurrences, só de agentes-referência}
```

Resultado: respostas mais curtas, menos "IA-zadas", no ritmo da Raiana.

### 5. Quando rodar (ambos)
- **Trigger por evento**: quando um lead atendido por agente-referência muda pra `scheduled`/`checked_in`/`showed_up`, dispara `analyzeLeadConversation` + agenda rebuild do style profile (debounce 1h).
- **Cron diário 03:00**: roda `buildReferenceStyleProfile` pra cada tenant que tem ≥1 referência. Rota nova em `src/routes/api/public/hooks/build-reference-style.ts` chamada via pg_cron.

### 6. UI mínima
- Em **Equipe / Profiles**: toggle "Referência de atendimento" (só admin vê).
- Em **Dashboard IA** (ou onde já tem insights): card "Estilo da Raiana" mostrando os bullets do `style_prompt` + métricas + botão "Recalcular agora".

## Detalhes técnicos

- Migração: 1 coluna em `profiles`, 2 colunas em `ai_knowledge_patterns`, 1 tabela nova com RLS (`tenant_id` scoping, leitura para `authenticated` do mesmo tenant, write só via service_role).
- Identificação do atendente nas mensagens: hoje `messages` não tem `profile_id` confiável — usar `sender_name` como fallback e tentar match por `profiles.full_name ILIKE`. Se nada bater, descarta a mensagem do treino (sem ruído).
- Custos de IA: o rebuild gasta ~1 chamada Gemini Flash por tenant/dia. Trigger por evento reusa a análise que já roda hoje.
- Backward compat: enquanto não houver style_profile, o prompt cai no comportamento atual.

## Fora do escopo desta iteração
- Tela de aprovação manual do style guide (você escolheu "automático").
- Captura de áudios / tempo de resposta da Raiana.
- Script de qualificação (sequência de perguntas) — fica pra próxima se topar.

Posso seguir e implementar?
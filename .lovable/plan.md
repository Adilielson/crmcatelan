## Objetivo

Fazer o Simulador de Chat comportar-se **exatamente** como a IA do WhatsApp real, e dar ao admin controle real sobre as regras de comportamento — sem depender de deploy de código.

## Diagnóstico atual

| Item | Simulador (`/api/ai-training/simulate-chat`) | Webhook real (`whatsapp-webhook`) |
|---|---|---|
| Modelo | `gpt-4o-mini` | `gpt-5-mini` |
| Regras fixas (`CORE_BEHAVIOR_RULES`) | ❌ não injeta | ✅ injeta hardcoded |
| Tools (agendar, remarcar, etc.) | ❌ não usa | ✅ usa |
| Contexto de hora ("AGORA são HH:MM") | ❌ | ✅ |
| Regras editáveis pelo admin | ❌ (código) | ❌ (código) |

Consequência: o admin testa no simulador, vê um comportamento, e o WhatsApp responde diferente. E qualquer ajuste nas 10 regras exige deploy.

## Etapas

### 1. Banco — tornar regras editáveis
Migration: adicionar `behavior_rules TEXT` em `ai_configs`, com seed do `CORE_BEHAVIOR_RULES` atual.

### 2. Prompt builder compartilhado
Criar `src/lib/ai-prompt-builder.ts` — função pura que monta o system prompt idêntico para os dois lados:
- Persona (`prompt_system`)
- Regras de comportamento (do banco, com fallback para as regras hardcoded)
- Contexto de horário/janelas de exame (Optometrista)
- FAQ, documentos de conhecimento, scripts, perguntas de qualificação
- Estilo de referência (Raiana)
- Timestamp real "AGORA são HH:MM"

### 3. Simulador = Webhook
Refatorar `src/routes/api/ai-training/simulate-chat.ts`:
- Usar `gpt-5-mini` (mesmo modelo do webhook)
- Usar `ai-prompt-builder` compartilhado
- Habilitar as mesmas tools em **modo dry-run** (retornam mocks — não criam agendamento real, não movem Kanban)
- Injetar timestamp real
- Retornar também o prompt final montado (para debug do admin)

### 4. Webhook lê do banco
Refatorar `supabase/functions/whatsapp-webhook/index.ts` para ler `behavior_rules` de `ai_configs` (com fallback para `CORE_BEHAVIOR_RULES` do `prompt-rules.ts` se coluna vazia). Deploy da edge function.

### 5. UI — aba "Regras de Comportamento"
Nova aba em `/ai-training` (roles admin/super_admin/manager):
- Textarea grande com as 10 regras editáveis
- Botão "Restaurar padrões de fábrica"
- Aviso: "Estas regras se aplicam ao WhatsApp real e ao simulador"
- Save invalida cache; próximo turno já usa a nova versão

### 6. Copilot melhorado
Em `src/lib/ai-training.functions.ts` + `PromptCopilotCard`:
- Trocar para `gpt-5-mini` (mesmo modelo)
- Permitir editar também `behavior_rules`
- Retornar **diff visual** (antes/depois por campo) antes de aplicar
- Botão "Aplicar e Testar" → salva + abre o simulador com uma mensagem inicial
- Se o modelo decidir não alterar nada, mostrar aviso explícito ao admin (em vez de aparentar sucesso silencioso)

## Detalhes técnicos

- `ai-prompt-builder.ts` fica em `src/lib/` e é importado por: o server function do simulador **e** também exposto via Deno-compat para o edge function (mais simples: duplicar como `supabase/functions/whatsapp-webhook/prompt-builder.ts` e cobrir os dois com o mesmo teste de snapshot).
- Testes de regressão em `tests/prompt-rules.test.ts` são estendidos: garantir que builder produz saída idêntica para o mesmo input em ambos os lados.
- Tools em dry-run: mesmo schema OpenAI, mas `execute` retorna `{ok:true, mock:true, ...}` sem tocar Supabase.
- Migration inclui `GRANT` correto e não altera RLS (coluna nova em tabela já existente).
- Não mexer no Kill Switch, no aprendizado contínuo nem no realtime — fora do escopo.

## Fora do escopo (para depois)
- Versionamento visual de regras (já existe `ai_config_versions`, usar depois).
- A/B testing de prompts.
- Migração das tools de agendamento para o simulador em modo "real opcional".
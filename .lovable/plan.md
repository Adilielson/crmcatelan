
## Diagnóstico — o que já existe

Antes de criar algo novo, mapeei tudo relacionado a lembretes/notificações:

- **Aba "Notificações" em Configurações** → existe o `TabsTrigger` mas o `TabsContent` está **vazio**. É o local perfeito para plugar a Central.
- **`NotificationCenter` (sininho no topo)** → só mostra alertas internos do sistema (lead parado, no-show, etc.). Não gerencia mensagens enviadas ao cliente.
- **Lembretes de agendamento** → templates hard-coded em `process-appointment-reminders.ts` (função `renderMessage`) e prazos hard-coded no trigger `schedule_appointment_reminders` (−24h, −22h, −3h, −1h).
- **Follow-ups pós-exame** → templates hard-coded no objeto `TEMPLATES` de `process-followups.ts` e prazos hard-coded no trigger `create_followup_schedule` (1, 3, 7, 15, 30, 60, 120, 180 dias).
- **No-show** → parcialmente configurável em `noshow_settings` (preset light/normal), sem edição de texto.
- **IA (agente WhatsApp)** → hoje não lê nenhum desses textos; responde livre.

**Conclusão:** não existe uma central editável. Precisa ser criada, e nada precisa ser removido — apenas conectado.

---

## O que vou construir: "Central de Lembretes"

Um único lugar em **Configurações → Notificações** onde o admin edita:
- **Mensagem** (com variáveis `{nome}`, `{data}`, `{hora}`, `{endereco}`, `{telefone}`)
- **Quando disparar** (offset em minutos antes/depois do evento)
- **Canal** (WhatsApp / ligação manual)
- **Ativo/inativo** (liga/desliga o passo sem apagar)

Cobrindo os 3 fluxos: **Confirmação de agendamento**, **Follow-up pós-exame**, **Alerta de no-show**.

---

## Detalhes técnicos

### 1. Banco (migration)
Nova tabela `reminder_templates`:
- `tenant_id`, `kind` (`appointment` | `followup` | `noshow`), `step_key` (ex: `confirm_24h`, `followup_d3`, `noshow_t15`)
- `label`, `message_template` (texto com placeholders), `channel` (`whatsapp` | `call`)
- `offset_minutes` (negativo = antes do evento, positivo = depois), `enabled`, `position`
- RLS: tenant admin/manager edita; service_role lê tudo
- Trigger `seed_reminder_templates_for_tenant` popula os defaults atuais em novos tenants
- Backfill: rodar seed para todos os tenants existentes

Reescrever os triggers para lerem da tabela:
- `schedule_appointment_reminders` → itera pelas linhas ativas de `kind='appointment'` e cria `appointment_reminders` com o `offset_minutes` da linha
- `create_followup_schedule` → mesma coisa para `kind='followup'`
- `schedule_noshow_alerts` → idem para `kind='noshow'` (substitui o preset light/normal)

### 2. Processadores (server routes)
- `process-appointment-reminders.ts`, `process-followups.ts`, `process-noshow-alerts.ts`: buscam o `message_template` da linha correspondente e renderizam com os placeholders reais. Fallback para o texto atual se a linha for removida.

### 3. UI — `RemindersCenterTab.tsx`
Layout mobile-first (CRM roda no celular):
- 3 seções colapsáveis (Confirmação / Follow-up / No-show)
- Cada passo: card com preview do texto, offset legível ("24h antes", "3 dias depois"), switch ativo, botão editar
- Dialog de edição: textarea grande + chips clicáveis para inserir variáveis + input de offset com selector de unidade (min/h/dias) + preview renderizado com dados fake
- Botão "Restaurar padrão" por passo

### 4. IA lê os templates
Adicionar em `supabase/functions/whatsapp-webhook/agent-tools.ts` uma tool `get_reminder_schedule` que retorna, para o tenant, quais lembretes o cliente vai receber e quando. Assim quando o cliente pergunta "vou receber lembrete?" a IA responde com dado real, e quando envia manualmente pode usar o mesmo texto padrão.

### 5. Ordem de execução
1. Migration (tabela + seed + reescrita dos 3 triggers + backfill)
2. Atualizar os 3 processadores para ler o template do banco
3. Criar `RemindersCenterTab.tsx` + hook `use-reminder-templates.ts`
4. Plugar no `TabsContent value="notifications"` de `settings.tsx`
5. Adicionar tool na IA do WhatsApp

Confirma que sigo por aí?

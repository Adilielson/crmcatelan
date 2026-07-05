# Fluxo No-Show com confirmação humana

Baseado nas suas escolhas: alertas vão para o **atendente que agendou**, com **configuração em Configurações**, **resumo no fim do dia** e coluna **"Recuperação No-Show"** ativa.

---

## 1. Antes da consulta (já existe — só ajustar)

Já temos `appointment_reminders` com `confirm_24h`, `confirm_retry_2h`, `day_morning`, `final_1h`. Mantém como está.

---

## 2. Na hora da consulta — sem marcar no-show automático

Quando o horário passa **sem check-in** e **sem status "compareceu/cancelado"**, o card entra em modo "aguardando confirmação":

- Badge amarelo **"Aguardando check-in"** + cronômetro (T+15, T+30, T+45, T+60…)
- Card **NÃO sai** da coluna Agendado
- Sistema **nunca** marca no-show sozinho

### Alertas escalonados (todos vão para o atendente que agendou o `appointment`)

| Momento | Canal | Mensagem |
|---|---|---|
| T+15min | In-app (sino + toast) | "Ataíde estava marcado 14h. Já chegou?" |
| T+30min | In-app + **WhatsApp do atendente** | "⚠️ Confirmar presença: Ataíde (14h). Responda: 1-Compareceu / 2-Não veio / 3-Remarcar" |
| T+45min | In-app + WhatsApp (2ª tentativa) | Mesma pergunta, tom mais urgente |
| T+60min | Card fica **vermelho piscando** + entrada no resumo do dia | — |

**Nada é automático.** Só o atendente ou gerente resolve pelos 3 botões do card:
- ✅ **Compareceu** → check-in retroativo, fluxo normal
- ❌ **Não compareceu** → dialog de motivo obrigatório → coluna "Recuperação No-Show"
- 🔄 **Remarcar** → escolhe nova data → volta pra "Agendado"

---

## 3. Resumo diário às 19h

WhatsApp para cada atendente com agendamentos do dia **sem resolução**:

```
📋 Resumo 15/12 – Fim do dia
Você tem 2 agendamentos sem confirmação:
• Ataíde – 14h (aguardando há 5h)
• Maria Silva – 16h (aguardando há 3h)
Resolva agora no CRM: [link]
```

Se o atendente responder pelo WhatsApp ("1 Ataíde compareceu"), o webhook processa e atualiza o card.

---

## 4. Coluna "Recuperação No-Show" (nova)

Entra automático quando o atendente marca "Não compareceu". Fica **entre "Agendado" e "Em Negociação"**.

**Motivos obrigatórios** (definem a cadência):

| Motivo | O que acontece |
|---|---|
| Doente/imprevisto | T+0 empatia, retomada em 15d |
| Esqueceu | T+0 remarcação suave, retomada em 7d |
| Sem tempo agora | Retomada em 30d |
| Desistiu do exame | Vai pra **Perdido** com nutrição em 60d |
| Comprou fora | Vai pra **Perdido** sem reengajamento |
| Não respondeu | Cadência automática (ver abaixo) |

### Cadência "Recuperação No-Show" (WhatsApp em rascunho para a atendente aprovar)

- **T+0h:** "Oi Ataíde, senti sua falta hoje na consulta. Tudo bem contigo?"
- **T+48h:** "Consegue vir amanhã ou quinta? Tenho 10h e 15h."
- **T+7d:** "Última chance essa semana pra ajustar sua visão. Posso reservar?"

Sem resposta em 7d → **Perdido** com motivo `nao_respondeu`.

---

## 5. Configurações → nova aba "Alertas de No-Show"

Página `/settings` ganha aba onde o admin controla:

- **Ligar/desligar alertas no-show** (switch geral)
- **Intervalos:** T+15/T+30/T+45 (padrão) ou T+30/T+60 (menos ruído)
- **Enviar WhatsApp para o atendente:** on/off
- **Enviar WhatsApp para o gerente também:** on/off + campo do número
- **Resumo diário 19h:** on/off + horário customizável
- **Cadência de recuperação:** editar textos dos 3 toques (T+0/T+48h/T+7d)

Tudo salvo em nova tabela `noshow_settings` (1 linha por tenant).

---

## 6. Banco — o que precisa mudar

### Novas colunas / tabelas
1. **Coluna kanban "Recuperação No-Show"** — via `seed_kanban_columns_for_tenant` + insert para tenants existentes (posição 35, entre Agendado e Negociação, `system_key='noshow_recovery'`)
2. **`noshow_settings`** — configurações da aba
3. **`noshow_alerts`** — fila de alertas pendentes (appointment_id, kind='t15|t30|t45', scheduled_at, sent_at, channel)
4. **`noshow_reason` enum** — `doente`, `esqueceu`, `sem_tempo`, `desistiu`, `comprou_fora`, `nao_respondeu`
5. **`appointments.noshow_reason`** — coluna opcional
6. **`leads.noshow_recovery_step`** — 0/1/2 para saber qual toque enviar

### Trigger novo
Quando `appointments.scheduled_at + 15/30/45min < now()` sem check-in → cria linhas em `noshow_alerts`. Isso já tem infra parecida em `appointment_reminders` — dá pra reaproveitar o padrão.

### Cron (pg_cron a cada 5min)
Chama `/api/public/hooks/process-noshow-alerts` que:
- Envia in-app + WhatsApp para o atendente
- Cria cadência de recuperação quando marcado no-show
- Manda resumo às 19h

---

## 7. Ordem de implementação

1. Migration: coluna kanban + `noshow_settings` + `noshow_alerts` + enum
2. UI do card: badge "Aguardando check-in" + cronômetro + 3 botões (Compareceu / Não compareceu / Remarcar)
3. Dialog "Marcar No-Show" com motivo obrigatório
4. Página `/settings` → aba "Alertas de No-Show"
5. Server route `/api/public/hooks/process-noshow-alerts` + pg_cron 5min
6. Resumo diário 19h (mesma rota, branch por horário)
7. Webhook WhatsApp entende respostas "1/2/3 nome" e atualiza card

---

## Duas confirmações rápidas antes de codar

1. **Aba de config:** faz sentido criar dentro de `/settings` existente (nova tab) ou preferir página separada `/settings/noshow`?
2. **WhatsApp para o atendente:** ele precisa ter **número cadastrado no `profiles`** (hoje só tem email). Adiciono campo `phone` em profiles e um input no perfil do usuário?

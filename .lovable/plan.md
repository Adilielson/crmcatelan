## Funil de Conversão — Ótica Catelan

Mapeamento de etapas no Kanban atual + regras de SLA, automações e follow-up para garantir conversão em cada fase.

---

### Etapa 1 — Agendamento do Exame
**Coluna Kanban:** `Leads Prontos` → `Em Atendimento` → `Agendado`

**Regras:**
- **SLA de 1º contato:** atendente deve responder lead novo em até **15 min** (horário comercial). Após isso, badge vermelho "atrasado" no card.
- **3 tentativas de contato** em janelas diferentes (manhã, tarde, noite) antes de mover para `Perdido`.
- **Mensagens-padrão (WhatsApp):**
  - Msg 1 (imediata): saudação + oferta de horários
  - Msg 2 (+4h se sem resposta): reforço + benefício (ex: "exame gratuito")
  - Msg 3 (+24h): última tentativa + senso de urgência
- **Auto-mover para `Agendado`** quando appointment for criado na Agenda.
- **Lembrete automático** 24h e 2h antes do exame (WhatsApp).

---

### Etapa 2 — Comparecimento ao Exame (Check-IN)
**Coluna:** `Agendado` → `Check-IN OK`

**Regras:**
- Check-IN na Agenda move lead para `Check-IN OK` (já implementado).
- **Se no-show:** lead volta para `Em Atendimento` com tag `reagendar` + tarefa automática de contato no mesmo dia.
- **Pós-exame imediato:** após exame, atendente preenche resultado (precisa de óculos? sim/não) — se sim, lead segue para próxima etapa; se não, vai para `Pós-venda futura` (coluna customizada sugerida) com follow-up de 6 meses.

---

### Etapa 3 — Venda de Óculos
**Coluna nova sugerida:** `Em Negociação` (entre `Check-IN OK` e `Fechado`)

**Regras:**
- Lead com exame feito + precisa de óculos → move para `Em Negociação`.
- **SLA de fechamento:** 48h após o exame. Se passar, badge amarelo "esfriando".
- **Campo obrigatório ao fechar:** `sales_value` (já existe). Ao mover para `Fechado`, abrir dialog pedindo valor + forma de pagamento.
- **Auto-checkout na Agenda** quando lead for movido para `Fechado` (fecha o ciclo Agenda↔Kanban).

---

### Etapa 4 — Follow-up de Não-Compradores (o gap atual)
**Coluna nova sugerida:** `Follow-up` (separada de `Perdido`)

**Diferença chave:** `Perdido` = não quer mais. `Follow-up` = não comprou agora, mas é qualificado.

**Cadência sugerida (automática):**
| Quando | Canal | Conteúdo |
|---|---|---|
| D+3 | WhatsApp | "Conseguiu pensar sobre o óculos?" + foto de modelo |
| D+7 | WhatsApp | Oferta com desconto/condição especial |
| D+15 | Ligação | Atendente liga pessoalmente |
| D+30 | WhatsApp | Nova coleção / promoção sazonal |
| D+90 | WhatsApp | Reativação ("faz tempo que não te vemos") |
| D+180 | WhatsApp | Lembrete de novo exame anual |

- Após D+180 sem resposta → move para `Perdido` automaticamente.
- Qualquer resposta do lead → volta para `Em Negociação` e notifica atendente.

---

### O que precisa ser construído

**Banco / lógica:**
1. Migration: adicionar 2 colunas de sistema — `Em Negociação` e `Follow-up`.
2. Tabela `lead_followups`: agenda de toques (lead_id, scheduled_at, channel, template, status).
3. Trigger: ao mover para `Follow-up`, criar 6 toques agendados automaticamente.
4. Edge function diária (pg_cron): processar toques do dia → enviar WhatsApp via uazapi.
5. Trigger: ao mover para `Fechado`, fazer auto-checkout do appointment correspondente.
6. Trigger: ao criar appointment → mover lead para `Agendado`.

**Frontend:**
1. Dialog de fechamento (`CloseLeadDialog`) pedindo valor + forma de pagamento.
2. Badges visuais de SLA (verde/amarelo/vermelho) por tempo na coluna.
3. Aba "Follow-ups de hoje" na Agenda mostrando toques agendados.
4. Tag automática `reagendar` em no-shows.
5. Templates de mensagem editáveis em Configurações.

**Configurável por tenant:**
- SLA de cada etapa (minutos/horas).
- Cadência de follow-up (dias entre toques).
- Templates de mensagem (variáveis: `{{nome}}`, `{{loja}}`, `{{horario}}`).

---

### Perguntas antes de codar

1. **Cadência D+3/7/15/30/90/180** está boa ou quer ajustar (ex: mais agressivo nos primeiros 30 dias)?
2. **Auto-envio de WhatsApp** ou apenas criar a tarefa e atendente confirma o envio? (auto = mais conversão, manual = mais controle)
3. Quer que eu já implemente **tudo numa tacada** ou prefere fasear (ex: fase 1 = colunas novas + dialog de fechamento; fase 2 = follow-up automático)?
4. **Comissão por venda** entra agora? (poderia registrar % do `sales_value` por atendente em `professional_performance`)

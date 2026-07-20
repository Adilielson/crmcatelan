## Diagnóstico

Hoje o CRM tem:
- **Lembretes de agendamento** (24h/3h/1h antes) — editáveis na "Central de Lembretes".
- **Follow-up pós-exame** (`lead_followups`) — dispara depois que o lead cai no status `followup`.
- **Follow-up de silêncio** (lead parou de responder) — **não existe**. Se o cliente some no meio da conversa, ninguém puxa de volta. É esse o gap.

Além disso, a Central de Lembretes de hoje só deixa editar textos, offsets e ligar/desligar. Não deixa **criar novas cadências**, mudar canal em massa, testar preview, nem ver quantos leads foram recuperados. Não tem cara de CRM profissional (tipo RD, HubSpot, Pipedrive).

## O que vamos entregar

### 1. Nova cadência: "Reengajamento de Lead Silencioso"

Cliente que **abriu conversa e parou de responder** entra automaticamente numa régua configurável. Exemplo padrão:

```text
+2h   → toque leve ("ainda posso te ajudar?")
+1 dia → autoridade + CTA concreto (oferece horário)
+3 dias → última tentativa ("posso encerrar seu atendimento?")
+7 dias → marca lead como frio (move no Kanban)
```

Cada toque:
- respeita horário comercial da ótica (não manda 22h)
- para automaticamente se o lead responder
- para se o lead agendar / for atribuído a atendente humano
- respeita Kill Switch da IA e `autopilot_enabled`

### 2. Tela nova: "Cadências de Follow-up" (em Configurações → IA)

CRUD completo, cara de CRM profissional:

- Lista de cadências (Reengajamento, Pós-exame, Aniversário do exame, No-show recovery...)
- Editor visual de cada cadência: adicionar/remover passos, arrastar ordem, definir offset (horas/dias), canal (WhatsApp/ligação), mensagem com variáveis (`{nome}`, `{primeiro_nome}`, `{ultima_msg}`, `{dias_sem_resposta}`)
- Preview ao vivo da mensagem com dados de um lead real
- Toggle ligado/desligado por cadência
- Métricas por cadência: enviados, respondidos, taxa de reengajamento, agendamentos recuperados (últimos 30 dias)
- Botão "Restaurar padrões"

### 3. Pequenos ajustes de "cara de CRM profissional"

Escopo mínimo pra não estourar o ticket:
- Ícones e agrupamento visual da nova tela igual aos padrões de CRM (coluna de passos à esquerda, editor à direita)
- Badges de status por cadência (Ativa / Pausada / Rascunho)
- Card de KPIs no topo (leads em cadência agora, respostas hoje, agendamentos recuperados na semana)

## Como funciona por baixo (parte técnica)

- Nova tabela `followup_cadences` (id, tenant_id, trigger_type, name, enabled, metrics_cache).
- Nova tabela `followup_cadence_steps` (cadence_id, order, offset_minutes, channel, message_template, enabled).
- Trigger `trigger_type = 'lead_silent'` monitora `whatsapp_messages`: quando o último inbound do lead ficou sem resposta por > offset do 1º passo, agenda em `lead_followups` os N passos.
- Reaproveita o worker `process-followups` já existente (só amplia pra ler qualquer template configurável, não só os hardcoded).
- Cancelamento automático: quando chega nova mensagem inbound do lead, marca passos futuros como `skipped` (`response_at = now()`).
- Respeita `business_hours` (já existe em `business-hours.server.ts`) — se o horário calculado cai fora, empurra pro próximo slot útil.
- Todas as edições feitas pelo admin no frontend valem imediatamente (sem deploy), igual à Central de Lembretes atual.

## Fora do escopo (fica pra depois)

- A/B test de cadências.
- Cadências por segmento (só quem gastou > X, só quem veio do Instagram, etc.).
- E-mail e SMS (por ora só WhatsApp e ligação manual, como hoje).

## Perguntas antes de eu começar

1. A régua padrão sugerida (+2h, +1d, +3d, +7d) faz sentido, ou você quer outra? (dá pra mudar depois na UI, mas é o seed inicial)
2. Depois de X dias sem resposta, você quer que o lead **saia do Kanban** (vai pra "Perdido") ou só ganhe um badge de "frio" e continue lá?
3. Quer que a IA (Lú) escreva a mensagem de reengajamento **dinamicamente** olhando o histórico da conversa, ou usa **template fixo** com variáveis? (dinâmico = mais humano, custa mais tokens; fixo = mais barato e previsível)

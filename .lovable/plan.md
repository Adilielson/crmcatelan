## Objetivo

Três entregas que se complementam:

1. **Fuso correto da Ótica Catelan** salvo no banco (e seletor para qualquer tenant).
2. **Tela Agenda → Configurações**: dropdown de fuso horário.
3. **Lógica de "parado"** reescrita: usa última mensagem recebida vs. enviada, e só conta minutos dentro do horário comercial da loja.

---

## 1) Migration — coluna de fuso + colunas de mensagem no lead

**Tabela `tenants`**
- Adicionar `timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo'`.
- `UPDATE tenants SET timezone='America/Cuiaba' WHERE id = (Ótica Catelan Matriz)` — confirme se Cuiabá é o fuso certo (Catelan fica em MT?). Se for outro, me diga antes.

**Tabela `leads`** — duas colunas novas:
- `last_inbound_at TIMESTAMPTZ` (última mensagem do cliente).
- `last_outbound_at TIMESTAMPTZ` (última mensagem da loja/IA).
- Backfill a partir de `messages` (max por `direction`).

**Trigger em `messages`** (AFTER INSERT):
- Atualiza `leads.last_inbound_at` ou `last_outbound_at` conforme `direction`.
- Mantém `updated_at` intocado nessas atualizações específicas (evita falso "movimento" do lead).

**Função `is_waiting_response(lead) → bool`**
- Retorna `true` se `last_inbound_at > COALESCE(last_outbound_at, 'epoch')`.

**Função `business_minutes_between(_tenant_id, _from, _to) → INT`**
- Calcula minutos úteis entre dois timestamps respeitando `agenda_business_hours` do tenant e o fuso do tenant (converte `_from/_to` para o timezone do tenant antes de iterar dias).
- Desconta intervalo de almoço.

**Reescrever `notify_stale_leads()`**
- Trocar `l.updated_at < now() - interval 'Xh'` por `business_minutes_between(tenant_id, GREATEST(last_inbound_at, updated_at), now()) >= threshold`.
- Só notifica leads **aguardando resposta da loja** (`last_inbound_at > last_outbound_at`) OU leads em `open` sem nenhuma mensagem ainda.
- Thresholds (em minutos comerciais): `open=60`, `in_progress=240`, `negotiating=240`.
- Fora do horário comercial → nenhum minuto conta → nenhuma notificação extra criada de madrugada.

---

## 2) UI — Seletor de fuso em Agenda

Arquivo: `src/components/agenda/AgendaSettingsDialog.tsx`.

- Adicionar `<Select>` "Fuso horário" no topo do diálogo, com opções IANA principais do Brasil:
  - `America/Sao_Paulo` (Brasília — padrão)
  - `America/Cuiaba` (MT)
  - `America/Manaus` (AM/RO/RR)
  - `America/Belem` (PA leste)
  - `America/Fortaleza` (NE)
  - `America/Noronha` (FN)
  - `America/Rio_Branco` (AC)
- Persistir via `update` em `tenants.timezone` (somente admin do tenant — RLS já cobre).
- Hook novo `src/hooks/use-tenant-timezone.ts` (read + mutation, invalida `['tenant', tenantId]`).
- Toast de confirmação.

Também passa a usar esse fuso em qualquer formatador de data/hora existente da agenda (centraliza num helper `src/lib/tz.ts` com `formatInTz(date, tenantTz, pattern)` usando `Intl.DateTimeFormat`).

---

## 3) Detalhes técnicos

```text
notify_stale_leads()
   │
   ├── seleciona leads em (open|in_progress|negotiating) AGUARDANDO resposta
   │     (last_inbound_at IS NULL e status=open, OU last_inbound_at > last_outbound_at)
   │
   ├── para cada lead:
   │     waited_min = business_minutes_between(
   │                    tenant_id,
   │                    COALESCE(last_inbound_at, updated_at),
   │                    now())
   │     if waited_min >= threshold(status): cria notificação (dedupe 24h igual ao atual)
   │
   └── usa tenants.timezone para janela diária; respeita lunch_start/lunch_end
```

**Compatibilidade**: a coluna `timezone` tem default, então tenants existentes não quebram. O trigger de `messages` só dispara em novas mensagens; o backfill cuida do histórico. As 3 RPCs com `REVOKE EXECUTE` recém-aplicadas permanecem só para `service_role` (cron).

**Tipos**: após a migration, `src/integrations/supabase/types.ts` será regenerado e referenciado nos componentes/hook novos. Nada para o usuário fazer.

---

## Confirmações antes de eu mandar a migration

1. **Fuso da Catelan Matriz**: Cuiabá (`America/Cuiaba`, UTC−4)? Ou outro?
2. **Thresholds em minutos comerciais** (60 / 240 / 240) batem com a regra atual ou querem ajustar?
3. OK trigger atualizar `last_inbound_at/outbound_at` sem mexer no `updated_at` (para a coluna "Tempo parado" da equipe não ficar zerando a cada mensagem da IA)?
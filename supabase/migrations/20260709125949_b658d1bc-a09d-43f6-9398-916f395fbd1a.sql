
-- 1. Table
CREATE TABLE public.reminder_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('appointment','followup','noshow')),
  step_key TEXT NOT NULL,
  label TEXT NOT NULL,
  message_template TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp','call')),
  offset_minutes INTEGER NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, kind, step_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminder_templates TO authenticated;
GRANT ALL ON public.reminder_templates TO service_role;

ALTER TABLE public.reminder_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reminder_templates_select_tenant" ON public.reminder_templates
FOR SELECT TO authenticated
USING (tenant_id = public.get_current_user_tenant() OR public.is_super_admin());

CREATE POLICY "reminder_templates_write_admin" ON public.reminder_templates
FOR ALL TO authenticated
USING (public.is_super_admin() OR public.is_tenant_admin_or_manager(auth.uid(), tenant_id))
WITH CHECK (public.is_super_admin() OR public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE TRIGGER trg_reminder_templates_updated_at
BEFORE UPDATE ON public.reminder_templates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Seed defaults for existing tenants
INSERT INTO public.reminder_templates (tenant_id, kind, step_key, label, message_template, channel, offset_minutes, position)
SELECT t.id, x.kind, x.step_key, x.label, x.message_template, x.channel, x.offset_minutes, x.position
FROM public.tenants t
CROSS JOIN (VALUES
  ('appointment','confirm_24h','Confirmação 24h antes','Olá, {nome}! Passando para confirmar seu agendamento amanhã ({data} às {hora}) na Ótica Catelã. Tudo certo para amanhã? Confirme aqui. Se não puder vir, nos avise.','whatsapp',-1440,10),
  ('appointment','confirm_retry_2h','Reenvio de confirmação','Oi, {nome}! Ainda não recebemos sua confirmação do agendamento de amanhã ({data} às {hora}). Consegue confirmar por aqui?','whatsapp',-1320,20),
  ('appointment','day_morning','Lembrete do dia','Ei, {nome}! Hoje é o dia do nosso agendamento ({hora})! Estamos te esperando na Ótica Catelã.','whatsapp',-180,30),
  ('appointment','final_1h','Lembrete final (1h antes)','{nome}, falta só 1 hora! Estamos te esperando na Ótica Catelã{endereco_opt}.','whatsapp',-60,40),
  ('followup','followup_d1','Follow-up 1 dia','Olá {nome}! Aqui é da Ótica Catelan 👋 Como foi a experiência no exame? Já pensou no modelo de óculos que gostaria?','whatsapp',1440,10),
  ('followup','followup_d3','Follow-up 3 dias','Oi {nome}, tudo bem? Conseguiu pensar sobre o óculos? Temos várias opções na loja, posso separar algumas pra você ver 😊','whatsapp',4320,20),
  ('followup','followup_d7','Follow-up 7 dias','Olá {nome}! Essa semana estamos com uma condição especial em armações + lentes. Topa dar uma passada pra ver?','whatsapp',10080,30),
  ('followup','followup_d15','Follow-up 15 dias (ligação)','[LIGAÇÃO] Ligar para {nome} ({telefone}) — reativação pós-exame.','call',21600,40),
  ('followup','followup_d30','Follow-up 30 dias','Oi {nome}! 🆕 Chegaram coleções novas na Ótica Catelan. Vem dar uma olhada quando puder!','whatsapp',43200,50),
  ('followup','followup_d60','Follow-up 60 dias','Olá {nome}, faz um tempo que não te vemos por aqui. Posso te ajudar com algo? Temos novidades 😊','whatsapp',86400,60),
  ('followup','followup_d120','Follow-up 120 dias','Oi {nome}! Lembrete: você fez exame há cerca de 4 meses. Já está usando óculos? Posso te dar uma dica especial.','whatsapp',172800,70),
  ('followup','followup_d180','Follow-up 180 dias','Olá {nome}! Já faz 6 meses do seu exame. Que tal agendar uma revisão? É rapidinho e sem custo.','whatsapp',259200,80),
  ('noshow','t15','Alerta no-show 15 min','[INTERNO] {nome} não fez check-in 15 min após o horário. Acionar contato.','whatsapp',15,10),
  ('noshow','t30','Alerta no-show 30 min','[INTERNO] {nome} não fez check-in 30 min após o horário.','whatsapp',30,20),
  ('noshow','t45','Alerta no-show 45 min','[INTERNO] {nome} não fez check-in 45 min após o horário. Marcar como no-show.','whatsapp',45,30)
) AS x(kind,step_key,label,message_template,channel,offset_minutes,position)
ON CONFLICT (tenant_id, kind, step_key) DO NOTHING;

-- 3. Seed trigger for new tenants
CREATE OR REPLACE FUNCTION public.seed_reminder_templates_for_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.reminder_templates (tenant_id, kind, step_key, label, message_template, channel, offset_minutes, position) VALUES
    (NEW.id,'appointment','confirm_24h','Confirmação 24h antes','Olá, {nome}! Passando para confirmar seu agendamento amanhã ({data} às {hora}) na Ótica Catelã. Tudo certo para amanhã? Confirme aqui. Se não puder vir, nos avise.','whatsapp',-1440,10),
    (NEW.id,'appointment','confirm_retry_2h','Reenvio de confirmação','Oi, {nome}! Ainda não recebemos sua confirmação do agendamento de amanhã ({data} às {hora}). Consegue confirmar por aqui?','whatsapp',-1320,20),
    (NEW.id,'appointment','day_morning','Lembrete do dia','Ei, {nome}! Hoje é o dia do nosso agendamento ({hora})! Estamos te esperando na Ótica Catelã.','whatsapp',-180,30),
    (NEW.id,'appointment','final_1h','Lembrete final (1h antes)','{nome}, falta só 1 hora! Estamos te esperando na Ótica Catelã{endereco_opt}.','whatsapp',-60,40),
    (NEW.id,'followup','followup_d1','Follow-up 1 dia','Olá {nome}! Como foi o exame? Já pensou no óculos?','whatsapp',1440,10),
    (NEW.id,'followup','followup_d3','Follow-up 3 dias','Oi {nome}, conseguiu pensar sobre o óculos?','whatsapp',4320,20),
    (NEW.id,'followup','followup_d7','Follow-up 7 dias','Olá {nome}! Temos condição especial em armações + lentes.','whatsapp',10080,30),
    (NEW.id,'followup','followup_d15','Follow-up 15 dias (ligação)','[LIGAÇÃO] Ligar para {nome} ({telefone}).','call',21600,40),
    (NEW.id,'followup','followup_d30','Follow-up 30 dias','Oi {nome}! Chegaram coleções novas.','whatsapp',43200,50),
    (NEW.id,'followup','followup_d60','Follow-up 60 dias','Olá {nome}, temos novidades 😊','whatsapp',86400,60),
    (NEW.id,'followup','followup_d120','Follow-up 120 dias','Oi {nome}! Já faz 4 meses do exame.','whatsapp',172800,70),
    (NEW.id,'followup','followup_d180','Follow-up 180 dias','Olá {nome}! 6 meses do exame — que tal revisar?','whatsapp',259200,80),
    (NEW.id,'noshow','t15','Alerta no-show 15 min','[INTERNO] {nome} não fez check-in 15 min após o horário.','whatsapp',15,10),
    (NEW.id,'noshow','t30','Alerta no-show 30 min','[INTERNO] {nome} não fez check-in 30 min após o horário.','whatsapp',30,20),
    (NEW.id,'noshow','t45','Alerta no-show 45 min','[INTERNO] {nome} não fez check-in 45 min após o horário.','whatsapp',45,30)
  ON CONFLICT (tenant_id, kind, step_key) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_reminder_templates ON public.tenants;
CREATE TRIGGER trg_seed_reminder_templates
AFTER INSERT ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.seed_reminder_templates_for_tenant();

-- 4. Appointment reminder trigger (reads from templates)
CREATE OR REPLACE FUNCTION public.schedule_appointment_reminders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
  v_when TIMESTAMPTZ;
BEGIN
  IF NEW.status IN ('cancelled','completed','no_show') THEN
    UPDATE public.appointment_reminders
       SET status = 'skipped',
           error_message = COALESCE(error_message, 'Agendamento ' || NEW.status::text)
     WHERE appointment_id = NEW.id AND status = 'pending';
    RETURN NEW;
  END IF;

  IF NEW.status = 'confirmed' AND (TG_OP = 'UPDATE') AND (OLD.status IS DISTINCT FROM 'confirmed') THEN
    UPDATE public.appointment_reminders
       SET status = 'confirmed'
     WHERE appointment_id = NEW.id
       AND status = 'pending'
       AND kind IN ('confirm_24h','confirm_retry_2h');
  END IF;

  IF (TG_OP = 'INSERT') OR (NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at) THEN
    DELETE FROM public.appointment_reminders
     WHERE appointment_id = NEW.id AND status = 'pending';

    FOR r IN
      SELECT step_key, offset_minutes
        FROM public.reminder_templates
       WHERE tenant_id = NEW.tenant_id
         AND kind = 'appointment'
         AND enabled = true
       ORDER BY position
    LOOP
      v_when := NEW.scheduled_at + (r.offset_minutes || ' minutes')::interval;
      IF v_when > now() AND NEW.status NOT IN ('confirmed','cancelled','completed','no_show') THEN
        INSERT INTO public.appointment_reminders (tenant_id, appointment_id, lead_id, kind, scheduled_at)
        VALUES (NEW.tenant_id, NEW.id, NEW.lead_id, r.step_key, v_when);
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- 5. Followup trigger (reads from templates)
CREATE OR REPLACE FUNCTION public.create_followup_schedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
BEGIN
  IF NEW.status = 'followup' AND (OLD.status IS DISTINCT FROM 'followup') THEN
    DELETE FROM public.lead_followups WHERE lead_id = NEW.id AND status = 'pending';
    FOR r IN
      SELECT step_key, channel, offset_minutes
        FROM public.reminder_templates
       WHERE tenant_id = NEW.tenant_id
         AND kind = 'followup'
         AND enabled = true
       ORDER BY position
    LOOP
      INSERT INTO public.lead_followups (tenant_id, lead_id, day_offset, channel, template_key, scheduled_at)
      VALUES (
        NEW.tenant_id, NEW.id,
        GREATEST(1, (r.offset_minutes / 1440)),
        r.channel,
        r.step_key,
        now() + (r.offset_minutes || ' minutes')::interval
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

-- 6. No-show alert trigger (reads from templates)
CREATE OR REPLACE FUNCTION public.schedule_noshow_alerts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_settings RECORD;
  r RECORD;
  v_when TIMESTAMPTZ;
BEGIN
  IF NEW.status IN ('cancelled','completed','no_show') THEN
    UPDATE public.noshow_alerts
       SET status = 'skipped',
           error_message = COALESCE(error_message, 'Agendamento ' || NEW.status::text)
     WHERE appointment_id = NEW.id AND status = 'pending';
    RETURN NEW;
  END IF;

  IF NEW.checkin_at IS NOT NULL AND (TG_OP = 'UPDATE') AND OLD.checkin_at IS NULL THEN
    UPDATE public.noshow_alerts
       SET status = 'skipped', error_message = 'Check-in realizado'
     WHERE appointment_id = NEW.id AND status = 'pending';
    RETURN NEW;
  END IF;

  IF NOT (TG_OP = 'INSERT' OR NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_settings FROM public.noshow_settings WHERE tenant_id = NEW.tenant_id;
  IF v_settings.id IS NULL OR NOT v_settings.enabled THEN
    RETURN NEW;
  END IF;

  DELETE FROM public.noshow_alerts
   WHERE appointment_id = NEW.id AND status = 'pending';

  FOR r IN
    SELECT step_key, offset_minutes
      FROM public.reminder_templates
     WHERE tenant_id = NEW.tenant_id
       AND kind = 'noshow'
       AND enabled = true
     ORDER BY position
  LOOP
    v_when := NEW.scheduled_at + (r.offset_minutes || ' minutes')::interval;
    IF v_when > now() THEN
      INSERT INTO public.noshow_alerts (
        tenant_id, appointment_id, lead_id, attendant_id, kind, scheduled_at
      ) VALUES (
        NEW.tenant_id, NEW.id, NEW.lead_id,
        COALESCE(NEW.professional_id, (SELECT assigned_user_id FROM public.leads WHERE id = NEW.lead_id)),
        r.step_key, v_when
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

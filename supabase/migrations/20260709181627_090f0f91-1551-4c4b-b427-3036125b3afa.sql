-- Remove o lembrete de 22h (reenvio de confirmação / confirm_retry_2h) de todos os tenants
DELETE FROM public.reminder_templates
WHERE kind = 'appointment' AND step_key = 'confirm_retry_2h';

-- Cancela lembretes pendentes já agendados para esse passo
DELETE FROM public.appointment_reminders
WHERE kind = 'confirm_retry_2h' AND status = 'pending';

-- Atualiza o trigger de agendamento para não referenciar o step removido
CREATE OR REPLACE FUNCTION public.schedule_appointment_reminders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
       AND kind IN ('confirm_24h');
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

-- Atualiza a função de seed para não recriar o lembrete de 22h em novos tenants
CREATE OR REPLACE FUNCTION public.seed_reminder_templates_for_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.reminder_templates (tenant_id, kind, step_key, label, message_template, channel, offset_minutes, position) VALUES
    (NEW.id,'appointment','confirm_24h','Confirmação 24h antes','Olá, {nome}! Passando para confirmar seu agendamento amanhã ({data} às {hora}) na Ótica Catelã. Tudo certo para amanhã? Confirme aqui. Se não puder vir, nos avise.','whatsapp',-1440,10),
    (NEW.id,'appointment','day_morning','Lembrete do dia','Ei, {nome}! Hoje é o dia do nosso agendamento ({hora})! Estamos te esperando na Ótica Catelã.','whatsapp',-180,20),
    (NEW.id,'appointment','final_1h','Lembrete final (1h antes)','{nome}, falta só 1 hora! Estamos te esperando na Ótica Catelã{endereco_opt}.','whatsapp',-60,30),
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
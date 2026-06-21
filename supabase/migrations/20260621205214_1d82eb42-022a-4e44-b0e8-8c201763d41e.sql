
-- ============================================================
-- FASE A: enriquecer lead_pipeline_history como tabela de eventos
-- ============================================================
ALTER TABLE public.lead_pipeline_history
  ADD COLUMN IF NOT EXISTS tenant_id uuid,
  ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'stage_change',
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS metadata jsonb;

CREATE INDEX IF NOT EXISTS idx_lph_lead_created ON public.lead_pipeline_history(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lph_tenant_event ON public.lead_pipeline_history(tenant_id, event_type);

-- Trigger: log mudança de atendente
CREATE OR REPLACE FUNCTION public.log_lead_assignment_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.assigned_user_id IS DISTINCT FROM OLD.assigned_user_id THEN
    INSERT INTO public.lead_pipeline_history (tenant_id, lead_id, event_type, changed_by, metadata)
    VALUES (NEW.tenant_id, NEW.id, 'assignment_change', auth.uid(),
      jsonb_build_object('from_user', OLD.assigned_user_id, 'to_user', NEW.assigned_user_id));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_lead_assignment_change ON public.leads;
CREATE TRIGGER trg_log_lead_assignment_change
  AFTER UPDATE OF assigned_user_id ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.log_lead_assignment_change();

-- Trigger: log eventos de agendamento
CREATE OR REPLACE FUNCTION public.log_appointment_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_event text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.lead_pipeline_history (tenant_id, lead_id, event_type, changed_by, metadata)
    VALUES (NEW.tenant_id, NEW.lead_id, 'appointment_created', auth.uid(),
      jsonb_build_object('appointment_id', NEW.id, 'scheduled_at', NEW.scheduled_at, 'professional_id', NEW.professional_id, 'unit_id', NEW.unit_id, 'type_exam', NEW.type_exam));
    RETURN NEW;
  END IF;

  IF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at THEN
    INSERT INTO public.lead_pipeline_history (tenant_id, lead_id, event_type, changed_by, metadata)
    VALUES (NEW.tenant_id, NEW.lead_id, 'appointment_rescheduled', auth.uid(),
      jsonb_build_object('appointment_id', NEW.id, 'from', OLD.scheduled_at, 'to', NEW.scheduled_at));
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_event := CASE NEW.status::text
      WHEN 'completed' THEN 'appointment_completed'
      WHEN 'no_show' THEN 'appointment_no_show'
      WHEN 'cancelled' THEN 'appointment_cancelled'
      WHEN 'confirmed' THEN 'appointment_confirmed'
      ELSE NULL END;
    IF v_event IS NOT NULL THEN
      INSERT INTO public.lead_pipeline_history (tenant_id, lead_id, event_type, changed_by, metadata)
      VALUES (NEW.tenant_id, NEW.lead_id, v_event, auth.uid(),
        jsonb_build_object('appointment_id', NEW.id, 'scheduled_at', NEW.scheduled_at, 'cancellation_reason', NEW.cancellation_reason));
    END IF;
  END IF;

  IF NEW.checkin_at IS DISTINCT FROM OLD.checkin_at AND NEW.checkin_at IS NOT NULL THEN
    INSERT INTO public.lead_pipeline_history (tenant_id, lead_id, event_type, changed_by, metadata)
    VALUES (NEW.tenant_id, NEW.lead_id, 'appointment_checkin', auth.uid(),
      jsonb_build_object('appointment_id', NEW.id, 'at', NEW.checkin_at));
  END IF;

  IF NEW.checkout_at IS DISTINCT FROM OLD.checkout_at AND NEW.checkout_at IS NOT NULL THEN
    INSERT INTO public.lead_pipeline_history (tenant_id, lead_id, event_type, changed_by, metadata)
    VALUES (NEW.tenant_id, NEW.lead_id, 'appointment_checkout', auth.uid(),
      jsonb_build_object('appointment_id', NEW.id, 'at', NEW.checkout_at));
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_appointment_events ON public.appointments;
CREATE TRIGGER trg_log_appointment_events
  AFTER INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.log_appointment_events();

-- ============================================================
-- FASE B: tabela de compras (LTV real)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lead_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  unit_id uuid,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  attendant_id uuid,
  purchase_date date NOT NULL DEFAULT current_date,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  product_description text,
  payment_method text,
  installments integer,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_purchases TO authenticated;
GRANT ALL ON public.lead_purchases TO service_role;

ALTER TABLE public.lead_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members read purchases"
  ON public.lead_purchases FOR SELECT TO authenticated
  USING (tenant_id = public.get_current_user_tenant());

CREATE POLICY "tenant members insert purchases"
  ON public.lead_purchases FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_current_user_tenant());

CREATE POLICY "admin manager update purchases"
  ON public.lead_purchases FOR UPDATE TO authenticated
  USING (tenant_id = public.get_current_user_tenant()
    AND public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE POLICY "admin manager delete purchases"
  ON public.lead_purchases FOR DELETE TO authenticated
  USING (tenant_id = public.get_current_user_tenant()
    AND public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

DROP TRIGGER IF EXISTS trg_lead_purchases_updated_at ON public.lead_purchases;
CREATE TRIGGER trg_lead_purchases_updated_at
  BEFORE UPDATE ON public.lead_purchases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_lead_purchases_lead ON public.lead_purchases(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_purchases_tenant_date ON public.lead_purchases(tenant_id, purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_lead_purchases_attendant ON public.lead_purchases(attendant_id);

-- Trigger: log compra na timeline
CREATE OR REPLACE FUNCTION public.log_purchase_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.lead_pipeline_history (tenant_id, lead_id, event_type, changed_by, metadata)
  VALUES (NEW.tenant_id, NEW.lead_id, 'purchase', auth.uid(),
    jsonb_build_object(
      'purchase_id', NEW.id,
      'amount', NEW.amount,
      'product', NEW.product_description,
      'date', NEW.purchase_date,
      'attendant_id', NEW.attendant_id,
      'payment_method', NEW.payment_method,
      'installments', NEW.installments
    ));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_purchase_event ON public.lead_purchases;
CREATE TRIGGER trg_log_purchase_event
  AFTER INSERT ON public.lead_purchases
  FOR EACH ROW EXECUTE FUNCTION public.log_purchase_event();

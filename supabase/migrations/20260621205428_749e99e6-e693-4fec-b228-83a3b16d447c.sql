
CREATE OR REPLACE FUNCTION public.log_lead_stage_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_duration interval;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_duration := now() - COALESCE(OLD.updated_at, OLD.created_at);
    INSERT INTO public.lead_pipeline_history
      (tenant_id, lead_id, event_type, stage_from, stage_to, changed_by, duration, metadata)
    VALUES (
      NEW.tenant_id, NEW.id, 'stage_change',
      OLD.status, NEW.status, auth.uid(), v_duration,
      jsonb_build_object(
        'lost_reason', NEW.lost_reason,
        'lost_reason_note', NEW.lost_reason_note,
        'sales_value', NEW.sales_value,
        'assigned_user_id', NEW.assigned_user_id
      )
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_lead_stage_change ON public.leads;
CREATE TRIGGER trg_log_lead_stage_change
  AFTER UPDATE OF status ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.log_lead_stage_change();

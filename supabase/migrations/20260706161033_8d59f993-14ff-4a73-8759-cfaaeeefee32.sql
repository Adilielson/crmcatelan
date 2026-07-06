-- 1. Remover colunas Fechado (showed_up) e Perdido (lost) do kanban
-- leads.custom_column_id tem ON DELETE SET NULL, então nenhum lead se perde.
DELETE FROM public.kanban_columns
WHERE is_system = true
  AND system_key IN ('showed_up', 'lost');

-- 2. Atualizar seed function para novos tenants (sem Fechado/Perdido)
CREATE OR REPLACE FUNCTION public.seed_kanban_columns_for_tenant()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.kanban_columns (tenant_id, name, color, position, is_system, system_key)
  VALUES
    (NEW.id, 'Leads Prontos',        '#3b82f6', 10, true, 'open'),
    (NEW.id, 'Em Atendimento',       '#f59e0b', 20, true, 'in_progress'),
    (NEW.id, 'Agendado',             '#8b5cf6', 30, true, 'scheduled'),
    (NEW.id, 'Recuperação No-Show',  '#f97316', 35, true, 'noshow_recovery'),
    (NEW.id, 'Check-IN OK',          '#10b981', 40, true, 'checked_in'),
    (NEW.id, 'Em Negociação',        '#06b6d4', 45, true, 'negotiating'),
    (NEW.id, 'Follow-up',            '#eab308', 55, true, 'followup')
  ON CONFLICT (tenant_id, system_key) DO NOTHING;
  RETURN NEW;
END;
$function$;
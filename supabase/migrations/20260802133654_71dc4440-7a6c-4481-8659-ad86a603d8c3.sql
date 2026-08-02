DROP TRIGGER IF EXISTS update_performance_metrics_trigger ON public.appointments;
DROP FUNCTION IF EXISTS public.update_performance_metrics() CASCADE;
DROP TABLE IF EXISTS public.professional_performance CASCADE;
DELETE FROM public.module_permissions WHERE module_key = 'performance';
DELETE FROM public.user_module_overrides WHERE module_key = 'performance';
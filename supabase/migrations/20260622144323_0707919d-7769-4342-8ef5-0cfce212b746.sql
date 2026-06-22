WITH ranked_goals AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id, unit_id, month
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.revenue_goals
)
DELETE FROM public.revenue_goals rg
USING ranked_goals ranked
WHERE rg.id = ranked.id
  AND ranked.rn > 1;

ALTER TABLE public.revenue_goals
  DROP CONSTRAINT IF EXISTS revenue_goals_tenant_id_unit_id_month_key;

ALTER TABLE public.revenue_goals
  ADD CONSTRAINT revenue_goals_tenant_id_unit_id_month_key
  UNIQUE NULLS NOT DISTINCT (tenant_id, unit_id, month);
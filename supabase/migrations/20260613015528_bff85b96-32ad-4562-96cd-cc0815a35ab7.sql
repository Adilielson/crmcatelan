
-- 1) Merge the duplicate pair: keep AGENDADO (4e98...), reparent children from PERDIDO (6c18...)
DO $$
DECLARE
  v_keep uuid := '4e98500d-0578-4987-99db-7799c3eb1587';
  v_drop uuid := '6c181091-0466-4c62-8993-ae13f83d095a';
BEGIN
  IF EXISTS (SELECT 1 FROM public.leads WHERE id = v_drop)
     AND EXISTS (SELECT 1 FROM public.leads WHERE id = v_keep) THEN
    UPDATE public.appointments              SET lead_id = v_keep WHERE lead_id = v_drop;
    UPDATE public.lead_followups            SET lead_id = v_keep WHERE lead_id = v_drop;
    UPDATE public.lead_pipeline_history     SET lead_id = v_keep WHERE lead_id = v_drop;
    UPDATE public.conversations             SET lead_id = v_keep WHERE lead_id = v_drop;
    UPDATE public.lead_consultation_summary SET lead_id = v_keep WHERE lead_id = v_drop;
    DELETE FROM public.leads WHERE id = v_drop;
  END IF;
END $$;

-- 2) Normalize all lead phones: digits-only, prepend '55' for BR-length numbers missing country code.
UPDATE public.leads
SET phone = CASE
  WHEN phone IS NULL OR phone = '' THEN phone
  WHEN length(regexp_replace(phone,'\D','','g')) BETWEEN 10 AND 11
       AND left(regexp_replace(phone,'\D','','g'),2) <> '55'
    THEN '55' || regexp_replace(phone,'\D','','g')
  ELSE regexp_replace(phone,'\D','','g')
END
WHERE phone IS NOT NULL AND phone <> '';

-- 3) After normalization, collapse any remaining same-tenant duplicates by keeping the most recently updated lead.
DO $$
DECLARE r RECORD; v_keep uuid;
BEGIN
  FOR r IN
    SELECT tenant_id, phone, array_agg(id ORDER BY updated_at DESC) AS ids
    FROM public.leads
    WHERE phone IS NOT NULL AND phone <> ''
    GROUP BY tenant_id, phone
    HAVING count(*) > 1
  LOOP
    v_keep := r.ids[1];
    UPDATE public.appointments              SET lead_id = v_keep WHERE lead_id = ANY(r.ids) AND lead_id <> v_keep;
    UPDATE public.lead_followups            SET lead_id = v_keep WHERE lead_id = ANY(r.ids) AND lead_id <> v_keep;
    UPDATE public.lead_pipeline_history     SET lead_id = v_keep WHERE lead_id = ANY(r.ids) AND lead_id <> v_keep;
    UPDATE public.conversations             SET lead_id = v_keep WHERE lead_id = ANY(r.ids) AND lead_id <> v_keep;
    UPDATE public.lead_consultation_summary SET lead_id = v_keep WHERE lead_id = ANY(r.ids) AND lead_id <> v_keep;
    DELETE FROM public.leads WHERE id = ANY(r.ids) AND id <> v_keep;
  END LOOP;
END $$;

-- 4) Prevent future duplicates: unique (tenant_id, phone) when phone is set.
CREATE UNIQUE INDEX IF NOT EXISTS leads_tenant_phone_unique
  ON public.leads (tenant_id, phone)
  WHERE phone IS NOT NULL AND phone <> '';

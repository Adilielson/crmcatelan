
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS patient_name text,
  ADD COLUMN IF NOT EXISTS patient_relation text,
  ADD COLUMN IF NOT EXISTS patient_age integer,
  ADD COLUMN IF NOT EXISTS schedule_preferences jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.leads.patient_name IS 'Nome do paciente que fará o exame quando for pessoa diferente do contato (ex.: esposo, filho). Vazio quando o próprio contato é o paciente.';
COMMENT ON COLUMN public.leads.patient_relation IS 'Relação do paciente com o contato do WhatsApp (esposo, esposa, filho, filha, mãe, pai, amigo, etc).';
COMMENT ON COLUMN public.leads.patient_age IS 'Idade do paciente em anos, quando informado.';
COMMENT ON COLUMN public.leads.schedule_preferences IS 'Preferências e restrições de agenda capturadas pela IA: {periodo_preferido, horario_preferido, evitar_dias, restricoes, observacoes}.';

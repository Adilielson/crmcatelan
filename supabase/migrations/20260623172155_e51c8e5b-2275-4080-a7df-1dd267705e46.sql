ALTER TABLE public.whatsapp_message_logs ADD COLUMN IF NOT EXISTS transcription text;

ALTER TABLE public.ai_learning_insights
  ADD COLUMN IF NOT EXISTS pain_points jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS fears jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS decision_blockers jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS audio_messages_analyzed integer DEFAULT 0;
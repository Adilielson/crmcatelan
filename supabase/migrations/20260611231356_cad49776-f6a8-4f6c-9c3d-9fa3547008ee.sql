ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS prescription_image_path text,
  ADD COLUMN IF NOT EXISTS prescription_ocr_at timestamptz;
ALTER TABLE public.facts
ADD COLUMN IF NOT EXISTS visual_key TEXT;

UPDATE public.facts
SET visual_key = CASE
  WHEN COALESCE(source_label, '') ILIKE '%NASA%' THEN 'space-observatory'
  WHEN COALESCE(source_label, '') ILIKE '%Stanford Encyclopedia%' THEN 'philosophy-library'
  WHEN COALESCE(source_label, '') ILIKE '%MedlinePlus%' THEN 'health-brief'
  WHEN COALESCE(category, '') ILIKE '%BILIM%' THEN 'science-focus'
  WHEN COALESCE(category, '') ILIKE '%TARIH%' THEN 'history-archive'
  WHEN COALESCE(category, '') ILIKE '%FELSEFE%' THEN 'philosophy-marble'
  WHEN COALESCE(category, '') ILIKE '%TEKNOLOJI%' THEN 'technology-grid'
  WHEN COALESCE(category, '') ILIKE '%SAGLIK%' THEN 'health-brief'
  ELSE 'editorial-deep'
END
WHERE visual_key IS NULL;

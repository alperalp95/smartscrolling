ALTER TABLE public.books
ADD COLUMN IF NOT EXISTS access_tier TEXT NOT NULL DEFAULT 'premium';

ALTER TABLE public.books
DROP CONSTRAINT IF EXISTS books_access_tier_check;

ALTER TABLE public.books
ADD CONSTRAINT books_access_tier_check
CHECK (access_tier IN ('free_anchor', 'premium'));

UPDATE public.books
SET
  access_tier = CASE
    WHEN id = '11111111-1111-1111-1111-111111111111' THEN 'free_anchor'
    ELSE 'premium'
  END,
  is_premium = CASE
    WHEN id = '11111111-1111-1111-1111-111111111111' THEN FALSE
    ELSE TRUE
  END;

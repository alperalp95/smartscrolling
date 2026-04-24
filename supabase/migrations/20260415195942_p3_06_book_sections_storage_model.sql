CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.books
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'public_domain',
ADD COLUMN IF NOT EXISTS source_format TEXT,
ADD COLUMN IF NOT EXISTS source_storage_bucket TEXT,
ADD COLUMN IF NOT EXISTS source_storage_path TEXT,
ADD COLUMN IF NOT EXISTS total_sections INT DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.book_sections (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id          UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  section_order    INT NOT NULL,
  title            TEXT,
  plain_text       TEXT NOT NULL,
  summary          TEXT,
  word_count       INT DEFAULT 0,
  estimated_pages  INT DEFAULT 1,
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(book_id, section_order)
);

CREATE INDEX IF NOT EXISTS idx_book_sections_book_order
  ON public.book_sections(book_id, section_order);

ALTER TABLE public.book_sections ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'book_sections'
      AND policyname = 'Anyone can read book sections'
  ) THEN
    CREATE POLICY "Anyone can read book sections"
      ON public.book_sections
      FOR SELECT
      USING (true);
  END IF;
END $$;

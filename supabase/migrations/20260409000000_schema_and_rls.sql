-- Habilite UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users tablosu (Auth schema ile bağlanabilir ama şimdilik public.users kullanıyoruz)
CREATE TABLE public.users (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT UNIQUE,
  display_name TEXT,
  avatar_url   TEXT,
  interests    TEXT[],
  plan         TEXT DEFAULT 'free',
  streak_days  INT DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- 2. Facts (Bilgi Kartları / Hap Bilgiler)
CREATE TABLE public.facts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title        TEXT NOT NULL,
  content      TEXT NOT NULL,
  category     TEXT NOT NULL,    -- Ana Kategori: 'Bilim', 'Tarih' vs.
  tags         TEXT[] DEFAULT '{}', -- Alt Etiketler: ['uzay', 'kara-delik']
  read_time_sq INT DEFAULT 30,   -- Okuma süresi (saniye)
  source_url   TEXT,
  source_label TEXT,
  verified     BOOLEAN DEFAULT false,
  media_url    TEXT,
  published_at DATE,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- 3. Books (Kitaplar)
CREATE TABLE public.books (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title        TEXT NOT NULL,
  author       TEXT NOT NULL,
  cover_url    TEXT,
  description  TEXT,
  category     TEXT,
  total_pages  INT,
  epub_url     TEXT,
  is_premium   BOOLEAN DEFAULT false,
  language     TEXT DEFAULT 'tr',
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- 4. Book Highlights (Kelime ve Referanslar)
CREATE TABLE public.book_highlights (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id       UUID REFERENCES public.books(id) ON DELETE CASCADE,
  word          TEXT NOT NULL,
  type          TEXT NOT NULL,
  context       TEXT,
  ai_definition TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 5. Reading Progress (Kullanıcı İlerlemesi)
CREATE TABLE public.reading_progress (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES public.users(id) ON DELETE CASCADE,
  book_id      UUID REFERENCES public.books(id) ON DELETE CASCADE,
  current_page INT DEFAULT 0,
  last_read_at TIMESTAMPTZ DEFAULT now(),
  completed    BOOLEAN DEFAULT false,
  UNIQUE(user_id, book_id)
);

-- 6. Bookmarks (Kullanıcı Kaydedilenleri)
CREATE TABLE public.bookmarks (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES public.users(id) ON DELETE CASCADE,
  fact_id    UUID REFERENCES public.facts(id) ON DELETE CASCADE,
  book_id    UUID REFERENCES public.books(id) ON DELETE CASCADE,
  note       TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Chat Sessions (Yapay Zeka Sohbet Geçmişi)
CREATE TABLE public.chat_sessions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES public.users(id) ON DELETE CASCADE,
  context_type TEXT,
  context_id   UUID,
  messages     JSONB,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- 8. User Activity (Günlük Seri / Streak Tracking)
CREATE TABLE public.user_activity (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES public.users(id) ON DELETE CASCADE,
  date        DATE DEFAULT CURRENT_DATE,
  facts_read  INT DEFAULT 0,
  pages_read  INT DEFAULT 0,
  ai_queries  INT DEFAULT 0,
  UNIQUE(user_id, date)
);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------------
-- RLS POLICIES
-- -----------------------------------------------------------------------------------

-- Users Table Policies
CREATE POLICY "Users can insert their own row" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own row" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can select their own profile" ON public.users FOR SELECT USING (auth.uid() = id);

-- Public Read data (Facts, Books, Highlights)
CREATE POLICY "Anyone can read facts" ON public.facts FOR SELECT USING (true);
CREATE POLICY "Anyone can read books" ON public.books FOR SELECT USING (true);
CREATE POLICY "Anyone can read book highlights" ON public.book_highlights FOR SELECT USING (true);

-- User Data (Reading Progress)
CREATE POLICY "Users can manage their own progress" ON public.reading_progress FOR ALL USING (auth.uid() = user_id);

-- User Data (Bookmarks)
CREATE POLICY "Users can manage their own bookmarks" ON public.bookmarks FOR ALL USING (auth.uid() = user_id);

-- User Data (Chat Sessions)
CREATE POLICY "Users can manage their own chat sessions" ON public.chat_sessions FOR ALL USING (auth.uid() = user_id);

-- User Data (User Activity)
CREATE POLICY "Users can manage their own activity" ON public.user_activity FOR ALL USING (auth.uid() = user_id);

import type { Database as SupabaseDatabase } from './supabase';

export type Database = SupabaseDatabase;
export type FactRow = Database['public']['Tables']['facts']['Row'];
export type BookRow = Database['public']['Tables']['books']['Row'] & {
  access_tier?: 'free_anchor' | 'premium' | null;
};
export type BookSectionRow = Database['public']['Tables']['book_sections']['Row'];
export type BookHighlightRow = Database['public']['Tables']['book_highlights']['Row'];
export type UserRow = Database['public']['Tables']['users']['Row'];

export type FactType = {
  id: string;
  content: string;
  category: string;
  title: string;
  tags: string[];
  read_time_sq: number;
  source_url?: string | null;
  source_label?: string | null;
  verified?: boolean;
  media_url?: string | null;
  published_at?: string | null;
  created_at?: string;
  visual_key?: string | null;
  likes: number;
  gradientStart?: string;
  gradientEnd?: string;
};

export type UserType = {
  id: string;
  name: string;
  email: string;
  streakDays: number;
  avatarUrl?: string;
};

// Kitap modelleri Phase 3'te kullanılacak
export type BookType = {
  id: string;
  title: string;
  author: string;
  coverUrl?: string | null;
  description?: string | null;
  category?: string | null;
  totalPages?: number | null;
  epubUrl?: string | null;
  isPremium: boolean;
  language?: string | null;
  sourceType?: string | null;
  sourceFormat?: string | null;
  sourceStorageBucket?: string | null;
  sourceStoragePath?: string | null;
  totalSections?: number | null;
  accessTier?: 'free_anchor' | 'premium' | null;
  progress?: number;
};

export type BookSectionType = {
  id: string;
  book_id: string;
  section_order: number;
  title?: string | null;
  plain_text: string;
  summary?: string | null;
  word_count?: number | null;
  estimated_pages?: number | null;
  created_at?: string;
};

export type ReadingProgressType = {
  user_id: string;
  book_id: string;
  current_page: number;
  last_read_at: string;
  completed: boolean;
};

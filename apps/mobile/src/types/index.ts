import type { Database as SupabaseDatabase } from './supabase';

export type Database = SupabaseDatabase;
export type FactRow = Database['public']['Tables']['facts']['Row'];
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

export type SeriesSummary = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  category: string | null;
  coverUrl: string | null;
  cardCount: number;
  sectionCount: number;
  isFree: boolean;
  isFeatured: boolean;
  publishedAt: string | null;
};

export type SeriesSection = {
  title: string;
  firstPosition: number;
  cardCount: number;
};

export type SeriesDetail = SeriesSummary & {
  sections: SeriesSection[];
  sourceTitle: string;
  sourceUrl: string;
  license: string;
};

export type SeriesCard = {
  position: number;
  sectionTitle: string;
  body: string;
};

export type SeriesProgress = {
  seriesId: string;
  lastPosition: number;
  completedAt: string | null;
};

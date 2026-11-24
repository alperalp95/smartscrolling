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

import { create } from 'zustand';
import type { FactType } from '../types';

const SUPABASE_URL = 'https://gfbhzvaqngaxucbjljht.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmYmh6dmFxbmdheHVjYmpsamh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MjEyMjIsImV4cCI6MjA5MTQ5NzIyMn0.An0x826hB2EZl3r-zsps5hva1ehSEddDxFB1b05LCYE';

interface FeedState {
  facts: FactType[];
  likedIds: string[];
  savedIds: string[];
  isLoading: boolean;
  activeCategory: string;
  fetchFacts: () => Promise<void>;
  toggleLike: (id: string) => void;
  toggleSave: (id: string) => void;
  setActiveCategory: (cat: string) => void;
}

export const useFeedStore = create<FeedState>()((set, get) => ({
  facts: [],
  likedIds: [],
  savedIds: [],
  isLoading: false,
  activeCategory: 'logo',

  fetchFacts: async () => {
    const { facts } = get();
    if (facts.length > 0) return;

    set({ isLoading: true });

    try {
      console.log('[Dev] Fetching facts...');
      const res = await fetch(`${SUPABASE_URL}/rest/v1/facts?select=*&order=created_at.asc`, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });

      const data = await res.json();
      console.log(
        '[Dev] Response status:',
        res.status,
        'count:',
        Array.isArray(data) ? data.length : 'not array',
        data,
      );

      if (!res.ok) {
        console.error('[Dev] Fetch failed:', data);
        set({ isLoading: false });
        return;
      }

      set({ facts: data as FactType[], isLoading: false });
    } catch (e) {
      console.error('[Dev] fetchFacts exception:', e);
      set({ isLoading: false });
    }
  },

  toggleLike: (id: string) => {
    const { likedIds } = get();
    set({ likedIds: likedIds.includes(id) ? likedIds.filter((x) => x !== id) : [...likedIds, id] });
  },

  toggleSave: (id: string) => {
    const { savedIds } = get();
    set({ savedIds: savedIds.includes(id) ? savedIds.filter((x) => x !== id) : [...savedIds, id] });
  },

  setActiveCategory: (cat: string) => set({ activeCategory: cat }),
}));

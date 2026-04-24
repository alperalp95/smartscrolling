import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

interface AuthState {
  hasPremium: boolean;
  session: Session | null;
  user: User | null;
  isInitializing: boolean;
  postAuthRedirectPath: string | null;
  setSession: (session: Session | null) => void;
  setHasPremium: (hasPremium: boolean) => void;
  finishInitializing: () => void;
  setPostAuthRedirectPath: (path: string | null) => void;
  clearPostAuthRedirectPath: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  hasPremium: false,
  session: null,
  user: null,
  isInitializing: false,
  postAuthRedirectPath: null,
  setSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
    }),
  setHasPremium: (hasPremium) => set({ hasPremium }),
  finishInitializing: () => set({ isInitializing: false }),
  setPostAuthRedirectPath: (path) => set({ postAuthRedirectPath: path }),
  clearPostAuthRedirectPath: () => set({ postAuthRedirectPath: null }),
}));

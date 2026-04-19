import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import type { UserRole } from '@/types/ui';

interface AuthState {
  session: Session | null;
  user: User | null;
  role: UserRole | null;
  organizationId: string | null;
  profileLoaded: boolean;
  setSession: (session: Session | null) => void;
  setProfile: (organizationId: string | null, role: UserRole | null) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  role: null,
  organizationId: null,
  profileLoaded: false,
  setSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
      role: null,
      organizationId: null,
      profileLoaded: false, // loadProfile will set this true after fetching from DB
    }),
  setProfile: (organizationId, role) => set({ organizationId, role, profileLoaded: true }),
  clearSession: () => set({ session: null, user: null, role: null, organizationId: null, profileLoaded: false }),
}));

import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import type { UserRole } from '@/types/ui';

export interface Organization {
  id: string;
  name: string;
  timezone: string;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  role: UserRole | null;
  organizationId: string | null;
  organization: Organization | null;
  profileLoaded: boolean;
  setSession: (session: Session | null) => void;
  setProfile: (organizationId: string | null, role: UserRole | null) => void;
  setOrganization: (organization: Organization | null) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  role: null,
  organizationId: null,
  organization: null,
  profileLoaded: false,
  setSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
      role: null,
      organizationId: null,
      organization: null,
      profileLoaded: false, // loadProfile will set this true after fetching from DB
    }),
  setProfile: (organizationId, role) => set({ organizationId, role, profileLoaded: true }),
  setOrganization: (organization) => set({ organization }),
  clearSession: () => set({ session: null, user: null, role: null, organizationId: null, organization: null, profileLoaded: false }),
}));

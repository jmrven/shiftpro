import { supabase } from './supabase';
import { useAuthStore } from '@/stores/authStore';
import type { UserRole } from '@/types/ui';

export async function loadProfile(userId: string): Promise<void> {
  const { setProfile } = useAuthStore.getState();
  const { data } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', userId)
    .maybeSingle();
  setProfile(
    data?.organization_id ?? null,
    (data?.role as UserRole) ?? null
  );
}

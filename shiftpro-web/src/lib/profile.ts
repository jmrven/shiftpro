import { supabase } from './supabase';
import { useAuthStore } from '@/stores/authStore';
import type { UserRole } from '@/types/ui';

export async function loadProfile(userId: string): Promise<void> {
  const { setProfile, setOrganization } = useAuthStore.getState();
  const { data } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', userId)
    .maybeSingle();
  const orgId = data?.organization_id ?? null;
  setProfile(orgId, (data?.role as UserRole) ?? null);

  if (orgId) {
    const { data: orgData } = await supabase
      .from('organizations')
      .select('id, name, timezone')
      .eq('id', orgId)
      .maybeSingle();
    if (orgData) {
      setOrganization({ id: orgData.id, name: orgData.name, timezone: orgData.timezone ?? 'UTC' });
    }
  }
}

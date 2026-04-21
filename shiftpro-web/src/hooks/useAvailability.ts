import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { Database } from '@/types/database';

export type AvailabilityRow = Database['public']['Tables']['employee_availability']['Row'];

export type UpsertAvailabilityPayload = Database['public']['Tables']['employee_availability']['Insert'];

export function useAvailability(profileId?: string) {
  const user = useAuthStore((s) => s.user);
  const organizationId = useAuthStore((s) => s.organizationId);
  const targetId = profileId ?? user?.id;

  return useQuery({
    queryKey: ['availability', organizationId, targetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_availability')
        .select('id, profile_id, day_of_week, is_available, start_time, end_time, organization_id, created_at, updated_at')
        .eq('organization_id', organizationId!)
        .eq('profile_id', targetId!);
      if (error) throw error;
      return data;
    },
    enabled: !!targetId && !!organizationId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAllAvailability() {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: ['availability-all', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_availability')
        .select('id, profile_id, day_of_week, is_available, start_time, end_time, organization_id, created_at, updated_at')
        .eq('organization_id', organizationId!);
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpsertAvailability() {
  const qc = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);

  return useMutation({
    mutationFn: async (rows: Array<Omit<UpsertAvailabilityPayload, 'organization_id'>>) => {
      if (!organizationId) throw new Error('Organization context missing');
      const withOrg = rows.map((r) => ({
        ...r,
        organization_id: organizationId,
      }));
      const { data, error } = await supabase
        .from('employee_availability')
        .upsert(withOrg, { onConflict: 'profile_id,day_of_week' })
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['availability'] });
      qc.invalidateQueries({ queryKey: ['availability-all', organizationId] });
    },
  });
}

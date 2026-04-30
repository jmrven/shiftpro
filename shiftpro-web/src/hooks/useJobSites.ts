import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { Database } from '@/types/database';

export type JobSiteRow = {
  id: string;
  name: string;
  address: string | null;
  geofence_radius_meters: number;
  is_active: boolean;
};

type JobSiteUpdate = Database['public']['Tables']['job_sites']['Update'];
type JobSiteInsert = Database['public']['Tables']['job_sites']['Insert'];

export function useJobSites() {
  const { organizationId } = useAuthStore();

  return useQuery({
    queryKey: ['job-sites', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_sites')
        .select('id, name, address, geofence_radius_meters, is_active')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as JobSiteRow[];
    },
    enabled: !!organizationId,
  });
}

export function useUpsertJobSite() {
  const qc = useQueryClient();
  const { organizationId } = useAuthStore();

  return useMutation({
    mutationFn: async (payload: {
      id?: string;
      name: string;
      address?: string;
      latitude?: number;
      longitude?: number;
      geofence_radius_meters: number;
    }) => {
      const { id, latitude, longitude, name, address, geofence_radius_meters } = payload;
      const location =
        latitude !== undefined && longitude !== undefined
          ? (`POINT(${longitude} ${latitude})` as unknown)
          : undefined;

      if (id) {
        const row: JobSiteUpdate = {
          name,
          address: address ?? null,
          geofence_radius_meters,
          ...(location !== undefined ? { location } : {}),
        };
        const { error } = await supabase.from('job_sites').update(row).eq('id', id);
        if (error) throw error;
      } else {
        const row: JobSiteInsert = {
          name,
          address: address ?? null,
          geofence_radius_meters,
          organization_id: organizationId!,
          ...(location !== undefined ? { location } : {}),
        };
        const { error } = await supabase.from('job_sites').insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['job-sites', organizationId] }),
  });
}

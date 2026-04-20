import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

export type Schedule = {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
};

export function useSchedules() {
  const { organizationId } = useAuthStore();
  return useQuery({
    queryKey: ['schedules', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedules')
        .select('id, name, color, is_active')
        .eq('organization_id', organizationId!)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Schedule[];
    },
    enabled: !!organizationId,
  });
}

export function useCreateSchedule() {
  const qc = useQueryClient();
  const { organizationId } = useAuthStore();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('schedules')
        .insert({ organization_id: organizationId!, name })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules'] }),
  });
}

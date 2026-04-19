import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { callFunction } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import type { InviteEmployeeRequest } from '@/types/api';
import type { Database } from '@/types/database';

type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export function useEmployees() {
  const { organizationId } = useAuthStore();

  return useQuery({
    queryKey: ['employees', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, profile_positions(position_id, positions(id, name, color))')
        .eq('organization_id', organizationId!)
        .order('last_name');
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });
}

export function useInviteEmployee() {
  const qc = useQueryClient();
  const { organizationId } = useAuthStore();

  return useMutation({
    mutationFn: (body: InviteEmployeeRequest) => callFunction('invite-employee', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees', organizationId] }),
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  const { organizationId } = useAuthStore();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: ProfileUpdate }) => {
      const { error } = await supabase.from('profiles').update(updates).eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['employees', organizationId] });
      qc.invalidateQueries({ queryKey: ['employee', id] });
    },
  });
}

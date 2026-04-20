import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { callFunction } from '@/lib/api';

export type ShiftRow = {
  id: string;
  schedule_id: string;
  profile_id: string | null;
  position_id: string | null;
  job_site_id: string | null;
  start_time: string;
  end_time: string;
  break_minutes: number;
  notes: string | null;
  status: 'draft' | 'published';
  is_open_shift: boolean;
  color: string | null;
  position: { name: string; color: string } | null;
  profile: { first_name: string; last_name: string; hourly_rate: number | null } | null;
};

export type CreateShiftPayload = {
  schedule_id: string;
  profile_id: string | null;
  position_id: string | null;
  job_site_id: string | null;
  start_time: string;
  end_time: string;
  break_minutes: number;
  notes?: string;
};

export function useShifts(scheduleId: string | null, weekStart: Date, weekEnd: Date) {
  return useQuery({
    queryKey: ['shifts', scheduleId, weekStart.toISOString(), weekEnd.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shifts')
        .select(`
          id, schedule_id, profile_id, position_id, job_site_id,
          start_time, end_time, break_minutes, notes, status, is_open_shift, color,
          position:positions(name, color),
          profile:profiles!profile_id(first_name, last_name, hourly_rate)
        `)
        .eq('schedule_id', scheduleId!)
        .gte('start_time', weekStart.toISOString())
        .lt('start_time', weekEnd.toISOString())
        .order('start_time');
      if (error) throw error;
      return data as unknown as ShiftRow[];
    },
    enabled: !!scheduleId,
  });
}

export function useCreateShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateShiftPayload) =>
      callFunction<ShiftRow>('create-shift', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shifts'] }),
  });
}

export function useUpdateShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, position: _pos, profile: _prof, ...patch }: Partial<ShiftRow> & { id: string }) => {
      const { data, error } = await supabase
        .from('shifts')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shifts'] }),
  });
}

export function useDeleteShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('shifts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shifts'] }),
  });
}

export function useEmployeesForSchedule(scheduleId: string | null) {
  return useQuery({
    queryKey: ['schedule-employees', scheduleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_schedules')
        .select(`
          id, sort_order,
          profile:profiles(id, first_name, last_name, hourly_rate, avatar_url, status)
        `)
        .eq('schedule_id', scheduleId!)
        .order('sort_order');
      if (error) throw error;
      return data as Array<{
        id: string;
        sort_order: number;
        profile: {
          id: string;
          first_name: string;
          last_name: string;
          hourly_rate: number | null;
          avatar_url: string | null;
          status: string;
        };
      }>;
    },
    enabled: !!scheduleId,
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { callFunction } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

export type ClockActionType = 'clock_in' | 'clock_out' | 'break_start' | 'break_end';

export type ClockState = 'clocked_out' | 'clocked_in' | 'on_break';

export type ClockStatus = {
  status: ClockState;
  sinceTimestamp: string | null;
};

export type ClockActionResponse = {
  event: {
    id: string;
    event_type: ClockActionType;
    timestamp: string;
    is_within_geofence: boolean | null;
  };
  timesheet?: {
    id: string;
    clock_in: string | null;
    clock_out: string | null;
    break_minutes: number;
    total_minutes: number | null;
  };
  geofence_warning?: string;
};

export type TimesheetRow = {
  id: string;
  profile_id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  break_minutes: number;
  total_minutes: number | null;
  regular_minutes: number | null;
  overtime_minutes: number | null;
  is_manual_entry: boolean;
  status: 'pending' | 'approved' | 'rejected';
  notes: string | null;
  profile: { first_name: string; last_name: string; avatar_url: string | null } | null;
};

const STATE_MAP: Record<string, ClockState> = {
  clock_in: 'clocked_in',
  break_end: 'clocked_in',
  clock_out: 'clocked_out',
  break_start: 'on_break',
};

export function useClockState() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['clock-state', user?.id],
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from('clock_events')
        .select('event_type, timestamp')
        .eq('profile_id', user!.id)
        .gte('timestamp', todayStart.toISOString())
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { status: 'clocked_out' as ClockState, sinceTimestamp: null };
      return {
        status: STATE_MAP[data.event_type] ?? 'clocked_out',
        sinceTimestamp: data.timestamp as string,
      };
    },
    enabled: !!user,
    refetchInterval: 60_000,
  });
}

export function useClockAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      action: ClockActionType;
      latitude?: number;
      longitude?: number;
    }) => callFunction<ClockActionResponse>('clock-action', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clock-state'] });
      qc.invalidateQueries({ queryKey: ['timesheets'] });
      qc.invalidateQueries({ queryKey: ['clock-events'] });
    },
  });
}

export function useActiveTimesheets() {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: ['clock-events', 'active', organizationId],
    queryFn: async () => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('timesheets')
        .select('id, profile_id, clock_in, profile:profiles!profile_id(first_name, last_name, avatar_url)')
        .eq('organization_id', organizationId!)
        .eq('date', todayStr)
        .not('clock_in', 'is', null)
        .is('clock_out', null);
      if (error) throw error;
      return data as Array<{
        id: string;
        profile_id: string;
        clock_in: string;
        profile: { first_name: string; last_name: string; avatar_url: string | null } | null;
      }>;
    },
    enabled: !!organizationId,
    refetchInterval: 30_000,
  });
}

export function useNoShows() {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: ['clock-events', 'no-shows', organizationId],
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const cutoff = new Date(Date.now() - 15 * 60 * 1000);

      const [shiftsRes, clockedRes] = await Promise.all([
        supabase
          .from('shifts')
          .select('id, profile_id, start_time, profile:profiles!profile_id(first_name, last_name)')
          .eq('status', 'published')
          .not('profile_id', 'is', null)
          .gte('start_time', todayStart.toISOString())
          .lte('start_time', cutoff.toISOString()),
        supabase
          .from('clock_events')
          .select('profile_id')
          .eq('organization_id', organizationId!)
          .eq('event_type', 'clock_in')
          .gte('timestamp', todayStart.toISOString()),
      ]);

      if (shiftsRes.error) throw shiftsRes.error;
      if (clockedRes.error) throw clockedRes.error;

      const clockedInIds = new Set((clockedRes.data ?? []).map((e) => e.profile_id));
      return (shiftsRes.data ?? []).filter(
        (s) => s.profile_id && !clockedInIds.has(s.profile_id)
      ) as Array<{
        id: string;
        profile_id: string;
        start_time: string;
        profile: { first_name: string; last_name: string } | null;
      }>;
    },
    enabled: !!organizationId,
    refetchInterval: 60_000,
  });
}

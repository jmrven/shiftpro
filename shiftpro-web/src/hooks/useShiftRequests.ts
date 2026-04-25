import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { callFunction } from '@/lib/api';

export type RequestStatus = 'pending' | 'approved' | 'denied' | 'canceled';
export type RequestType   = 'swap' | 'offer' | 'drop' | 'open_shift';

export type ShiftRequestRow = {
  id: string;
  type: RequestType;
  status: RequestStatus;
  requester_id: string;
  shift_id: string;
  target_shift_id: string | null;
  target_profile_id: string | null;
  manager_note: string | null;
  requester_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  requester: { first_name: string; last_name: string } | null;
  shift: {
    start_time: string;
    end_time: string;
    profile: { first_name: string; last_name: string } | null;
    position: { name: string; color: string } | null;
  } | null;
  target_shift: {
    start_time: string;
    end_time: string;
    profile: { first_name: string; last_name: string } | null;
  } | null;
};

export function useShiftRequests(status: RequestStatus | 'all' = 'pending') {
  const organizationId = useAuthStore((s) => s.organizationId);

  return useQuery({
    queryKey: ['shift-requests', organizationId, status],
    queryFn: async () => {
      // RLS enforces org isolation; add explicit status filter when not fetching all
      const selectStr = `
        id, type, status, requester_id, shift_id, target_shift_id, target_profile_id,
        manager_note, requester_note, reviewed_by, reviewed_at, created_at,
        requester:profiles!requester_id(first_name, last_name),
        shift:shifts!shift_id(
          start_time, end_time,
          profile:profiles!profile_id(first_name, last_name),
          position:positions!position_id(name, color)
        ),
        target_shift:shifts!target_shift_id(
          start_time, end_time,
          profile:profiles!profile_id(first_name, last_name)
        )
      `;

      let q = supabase
        .from('shift_requests')
        .select(selectStr)
        .eq('organization_id', organizationId!)
        .order('created_at', { ascending: false });
      if (status !== 'all') q = q.eq('status', status);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as ShiftRequestRow[];
    },
    enabled: !!organizationId,
  });
}

export type MyShiftRequestRow = Pick<
  ShiftRequestRow,
  'id' | 'type' | 'status' | 'shift_id' | 'target_shift_id' | 'requester_note' | 'manager_note' | 'created_at'
> & {
  shift: { start_time: string; end_time: string; position: { name: string; color: string } | null } | null;
};

export function useMyShiftRequests() {
  const user = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: ['my-shift-requests', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shift_requests')
        .select(`
          id, type, status, shift_id, target_shift_id, requester_note, manager_note, created_at,
          shift:shifts!shift_id(
            start_time, end_time,
            position:positions!position_id(name, color)
          )
        `)
        .eq('requester_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as MyShiftRequestRow[];
    },
    enabled: !!user?.id,
  });
}

export type CreateShiftRequestPayload = {
  shift_id: string;
  type: RequestType;
  target_shift_id?: string;
  target_profile_id?: string;
  requester_note?: string;
};

export function useCreateShiftRequest() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const organizationId = useAuthStore((s) => s.organizationId);

  return useMutation({
    mutationFn: async (payload: CreateShiftRequestPayload) => {
      const { data, error } = await supabase
        .from('shift_requests')
        .insert({
          ...payload,
          organization_id: organizationId!,
          requester_id: user!.id,
          status: 'pending' as RequestStatus,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shift-requests'] });
      qc.invalidateQueries({ queryKey: ['my-shift-requests'] });
    },
  });
}

export function useRespondToRequest() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      requestId,
      action,
      managerNote,
    }: {
      requestId: string;
      action: 'approve' | 'deny';
      managerNote?: string;
    }) =>
      callFunction('handle-shift-request', {
        request_id: requestId,
        action,
        manager_note: managerNote,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shift-requests'] });
      qc.invalidateQueries({ queryKey: ['shifts'] });
      qc.invalidateQueries({ queryKey: ['my-shift-requests'] });
    },
  });
}

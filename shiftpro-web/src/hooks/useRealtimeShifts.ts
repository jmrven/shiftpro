import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useRealtimeShifts(scheduleId: string | null) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!scheduleId) return;

    const channel = supabase
      .channel(`shifts:${scheduleId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shifts',
          filter: `schedule_id=eq.${scheduleId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['shifts', scheduleId] });
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [scheduleId, qc]);
}

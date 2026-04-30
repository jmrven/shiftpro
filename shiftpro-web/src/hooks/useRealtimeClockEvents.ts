import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useRealtimeClockEvents(organizationId: string | null) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!organizationId) return;

    const channel = supabase
      .channel(`clock_events:${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clock_events',
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['clock-events'] });
          qc.invalidateQueries({ queryKey: ['clock-state'] });
        }
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [organizationId, qc]);
}

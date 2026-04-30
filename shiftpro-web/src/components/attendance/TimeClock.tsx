import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/cn';
import { useClockState, useClockAction } from '@/hooks/useClockEvents';
import { useGeolocation } from '@/hooks/useGeolocation';

export function TimeClock() {
  const { data: clockStatus } = useClockState();
  const clockAction = useClockAction();
  const geo = useGeolocation();
  const [geofenceWarning, setGeofenceWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const status = clockStatus?.status ?? 'clocked_out';

  const { request: requestGeo } = geo;
  useEffect(() => {
    requestGeo();
  }, [requestGeo]);

  async function handleAction(action: 'clock_in' | 'clock_out' | 'break_start' | 'break_end') {
    setError(null);
    setGeofenceWarning(null);
    try {
      const result = await clockAction.mutateAsync({
        action,
        latitude: geo.latitude ?? undefined,
        longitude: geo.longitude ?? undefined,
      });
      if (result.geofence_warning) {
        setGeofenceWarning(result.geofence_warning);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Clock action failed');
    }
  }

  const statusLabel = {
    clocked_out: { text: 'Clocked Out', color: 'text-muted-foreground', dot: 'bg-gray-400' },
    clocked_in: { text: 'Clocked In', color: 'text-green-600', dot: 'bg-green-500' },
    on_break: { text: 'On Break', color: 'text-yellow-600', dot: 'bg-yellow-500' },
  }[status];

  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-4 max-w-sm">
      <div className="flex items-center gap-2">
        <span className={cn('w-3 h-3 rounded-full', statusLabel.dot)} />
        <span className={cn('font-semibold text-lg', statusLabel.color)}>{statusLabel.text}</span>
        {clockStatus?.sinceTimestamp && (
          <span className="text-xs text-muted-foreground ml-auto">
            {formatDistanceToNow(new Date(clockStatus.sinceTimestamp), { addSuffix: true })}
          </span>
        )}
      </div>

      <div className="text-xs text-muted-foreground">
        {geo.loading && <span>Acquiring GPS…</span>}
        {geo.error && <span className="text-yellow-600">GPS unavailable — clocking without location</span>}
        {geo.latitude && !geo.error && (
          <span className="text-green-600">GPS ready</span>
        )}
        {!geo.latitude && !geo.loading && !geo.error && (
          <button onClick={geo.request} className="underline text-primary">Enable GPS</button>
        )}
      </div>

      {geofenceWarning && (
        <div className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
          ⚠ {geofenceWarning}
        </div>
      )}

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {status === 'clocked_out' && (
          <button
            onClick={() => handleAction('clock_in')}
            disabled={clockAction.isPending}
            className="px-5 py-2.5 rounded-md bg-green-600 text-white font-medium text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {clockAction.isPending ? 'Clocking In…' : 'Clock In'}
          </button>
        )}

        {status === 'clocked_in' && (
          <>
            <button
              onClick={() => handleAction('break_start')}
              disabled={clockAction.isPending}
              className="px-4 py-2 rounded-md bg-yellow-500 text-white font-medium text-sm hover:bg-yellow-600 disabled:opacity-50 transition-colors"
            >
              Start Break
            </button>
            <button
              onClick={() => handleAction('clock_out')}
              disabled={clockAction.isPending}
              className="px-4 py-2 rounded-md bg-destructive text-white font-medium text-sm hover:bg-destructive/90 disabled:opacity-50 transition-colors"
            >
              Clock Out
            </button>
          </>
        )}

        {status === 'on_break' && (
          <button
            onClick={() => handleAction('break_end')}
            disabled={clockAction.isPending}
            className="px-5 py-2.5 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            End Break
          </button>
        )}
      </div>
    </div>
  );
}

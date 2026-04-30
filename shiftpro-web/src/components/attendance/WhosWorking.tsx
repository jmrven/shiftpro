import { format } from 'date-fns';
import { useActiveTimesheets } from '@/hooks/useClockEvents';
import { useRealtimeClockEvents } from '@/hooks/useRealtimeClockEvents';
import { useAuthStore } from '@/stores/authStore';

export function WhosWorking() {
  const organizationId = useAuthStore((s) => s.organizationId);
  useRealtimeClockEvents(organizationId);
  const { data: active = [], isLoading } = useActiveTimesheets();

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {active.length === 0 ? (
        <div className="p-4 text-sm text-muted-foreground">No one is currently clocked in.</div>
      ) : (
        <ul className="divide-y divide-border">
          {active.map((ts) => (
            <li key={ts.id} className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                <span className="text-sm font-medium">
                  {ts.profile?.first_name} {ts.profile?.last_name}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                since {format(new Date(ts.clock_in), 'h:mm a')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

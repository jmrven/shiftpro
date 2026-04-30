import { formatInTimeZone } from 'date-fns-tz';
import { useNoShows } from '@/hooks/useClockEvents';
import { useAuthStore } from '@/stores/authStore';

export function NoShowWidget() {
  const timezone = useAuthStore((s) => s.organization?.timezone ?? 'UTC');
  const { data: noShows = [], isLoading, isError } = useNoShows();

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (isError) return <div className="text-sm text-destructive">Failed to load no-show data.</div>;

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {noShows.length === 0 ? (
        <div className="p-4 text-sm text-muted-foreground">No missing clock-ins detected.</div>
      ) : (
        <ul className="divide-y divide-border">
          {noShows.map((s) => (
            <li key={s.id} className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-destructive flex-shrink-0" />
                <span className="text-sm font-medium">
                  {s.profile?.first_name} {s.profile?.last_name}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                Shift started {formatInTimeZone(new Date(s.start_time), timezone, 'h:mm a')} — not clocked in
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

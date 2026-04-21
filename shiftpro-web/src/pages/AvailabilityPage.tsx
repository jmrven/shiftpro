import { useState, useEffect } from 'react';
import { useAvailability, useUpsertAvailability } from '@/hooks/useAvailability';
import { useAuthStore } from '@/stores/authStore';
import type { Database } from '@/types/database';

type DayOfWeek = Database['public']['Enums']['day_of_week'];

const DAYS: { label: string; value: DayOfWeek }[] = [
  { label: 'Sunday', value: 'sunday' },
  { label: 'Monday', value: 'monday' },
  { label: 'Tuesday', value: 'tuesday' },
  { label: 'Wednesday', value: 'wednesday' },
  { label: 'Thursday', value: 'thursday' },
  { label: 'Friday', value: 'friday' },
  { label: 'Saturday', value: 'saturday' },
];

interface DayState {
  is_available: boolean;
  start_time: string;
  end_time: string;
}

function buildInitial(rows: Array<{ day_of_week: DayOfWeek; is_available: boolean; start_time: string | null; end_time: string | null }> | null | undefined): Record<DayOfWeek, DayState> {
  const initial: Record<DayOfWeek, DayState> = {
    sunday: { is_available: false, start_time: '09:00', end_time: '17:00' },
    monday: { is_available: false, start_time: '09:00', end_time: '17:00' },
    tuesday: { is_available: false, start_time: '09:00', end_time: '17:00' },
    wednesday: { is_available: false, start_time: '09:00', end_time: '17:00' },
    thursday: { is_available: false, start_time: '09:00', end_time: '17:00' },
    friday: { is_available: false, start_time: '09:00', end_time: '17:00' },
    saturday: { is_available: false, start_time: '09:00', end_time: '17:00' },
  };
  if (rows) {
    for (const row of rows) {
      initial[row.day_of_week] = {
        is_available: row.is_available,
        start_time: row.start_time ?? '09:00',
        end_time: row.end_time ?? '17:00',
      };
    }
  }
  return initial;
}

export function AvailabilityPage() {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading } = useAvailability();
  const upsert = useUpsertAvailability();

  const [days, setDays] = useState<Record<DayOfWeek, DayState>>(() => buildInitial(data));
  const [savedMsg, setSavedMsg] = useState(false);

  // Sync when data loads
  useEffect(() => {
    if (data) {
      setDays(buildInitial(data));
    }
  }, [data]);

  function updateDay(day: DayOfWeek, patch: Partial<DayState>) {
    setDays((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));
  }

  async function handleSave() {
    if (!user) return;
    const payload = DAYS.map(({ value }) => ({
      profile_id: user.id,
      day_of_week: value,
      is_available: days[value].is_available,
      start_time: days[value].is_available ? days[value].start_time : null,
      end_time: days[value].is_available ? days[value].end_time : null,
    }));
    await upsert.mutateAsync(payload);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">My Availability</h1>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-lg border border-border bg-card divide-y divide-border">
          {DAYS.map(({ label, value }) => {
            const day = days[value];
            return (
              <div key={value} className="flex items-center gap-4 px-5 py-4">
                <span className="w-28 text-sm font-medium">{label}</span>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={day.is_available}
                    onChange={(e) => updateDay(value, { is_available: e.target.checked })}
                    className="h-4 w-4 rounded border-input accent-primary"
                  />
                  <span className="text-sm">Available</span>
                </label>

                {day.is_available ? (
                  <div className="flex items-center gap-2 ml-auto">
                    <input
                      type="time"
                      value={day.start_time}
                      onChange={(e) => updateDay(value, { start_time: e.target.value })}
                      className="rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <span className="text-muted-foreground text-sm">–</span>
                    <input
                      type="time"
                      value={day.end_time}
                      onChange={(e) => updateDay(value, { end_time: e.target.value })}
                      className="rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                ) : (
                  <span className="ml-auto text-sm text-muted-foreground">Not available</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={upsert.isPending}
          className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
        >
          {upsert.isPending ? 'Saving…' : 'Save Availability'}
        </button>
        {savedMsg && (
          <span className="text-sm text-green-600 font-medium">Saved!</span>
        )}
      </div>
    </div>
  );
}

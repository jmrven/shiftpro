import { useState } from 'react';
import {
  startOfWeek,
  addDays,
  endOfWeek,
  addWeeks,
  subWeeks,
  format,
  isToday,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useSchedules } from '@/hooks/useSchedules';
import { useShifts } from '@/hooks/useShifts';
import type { ShiftRow } from '@/hooks/useShifts';
import {
  getWeekDays,
  shiftsForCell,
  shiftDurationHours,
  formatShiftTime,
} from '@/lib/scheduleUtils';
import { cn } from '@/lib/cn';

function ShiftCard({ shift, timezone }: { shift: ShiftRow; timezone: string }) {
  const start = formatShiftTime(new Date(shift.start_time), timezone);
  const end   = formatShiftTime(new Date(shift.end_time), timezone);
  const hours = shiftDurationHours(
    new Date(shift.start_time),
    new Date(shift.end_time),
    shift.break_minutes,
  );
  const color = shift.color ?? shift.position?.color ?? '#6366f1';
  return (
    <div className="rounded p-2 text-white text-xs" style={{ backgroundColor: color }}>
      <div className="font-semibold">{start} – {end}</div>
      {shift.position && (
        <div className="opacity-90 truncate">{shift.position.name}</div>
      )}
      <div className="opacity-75">{hours.toFixed(1)}h</div>
    </div>
  );
}

export function MySchedulePage() {
  const user = useAuthStore((s) => s.user);
  const organization = useAuthStore((s) => s.organization);
  const timezone = organization?.timezone ?? 'America/Los_Angeles';

  const displayName = user?.email?.split('@')[0] ?? 'Me';

  const [currentWeek, setCurrentWeek] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 0 }),
  );

  const weekStart = currentWeek;
  const weekEnd   = addDays(endOfWeek(currentWeek, { weekStartsOn: 0 }), 1);
  const weekDays  = getWeekDays(currentWeek);

  const { data: schedules = [] } = useSchedules();
  const firstScheduleId = schedules[0]?.id ?? null;

  const { data: allShifts = [], isLoading } = useShifts(firstScheduleId, weekStart, weekEnd);

  const userId = user?.id ?? '';
  const publishedShifts = allShifts.filter(
    (s) => s.status === 'published' && s.profile_id === userId,
  );

  const totalHours = publishedShifts.reduce((sum, s) => {
    return sum + shiftDurationHours(
      new Date(s.start_time),
      new Date(s.end_time),
      s.break_minutes,
    );
  }, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h1 className="text-xl font-semibold">My Schedule</h1>
          <p className="text-sm text-muted-foreground">{displayName}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
            className="h-8 w-8 rounded border border-input flex items-center justify-center hover:bg-accent"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium px-2 min-w-[180px] text-center">
            {format(currentWeek, 'MMM d')} – {format(addDays(currentWeek, 6), 'MMM d, yyyy')}
          </span>
          <button
            onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
            className="h-8 w-8 rounded border border-input flex items-center justify-center hover:bg-accent"
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 0 }))}
            className="h-8 px-3 rounded border border-input text-sm hover:bg-accent"
          >
            Today
          </button>
        </div>
      </div>

      {/* 7-day grid */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            Loading…
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((day) => {
                const today = isToday(day);
                const dayShifts = shiftsForCell(publishedShifts, userId, day, timezone);

                return (
                  <div key={day.toISOString()} className="flex flex-col gap-1">
                    {/* Day header */}
                    <div
                      className={cn(
                        'text-center py-2 rounded text-xs font-medium',
                        today
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <div>{format(day, 'EEE')}</div>
                      <div className="text-sm font-bold">{format(day, 'd')}</div>
                    </div>

                    {/* Shifts or placeholder */}
                    {dayShifts.length > 0 ? (
                      <div className="space-y-1">
                        {dayShifts.map((shift) => (
                          <ShiftCard key={shift.id} shift={shift} timezone={timezone} />
                        ))}
                      </div>
                    ) : (
                      <div className="border border-dashed border-border rounded min-h-[60px]" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer summary */}
            <div className="mt-4 text-sm text-muted-foreground">
              {publishedShifts.length === 0 ? (
                <p>No published shifts this week.</p>
              ) : (
                <p>
                  {publishedShifts.length} shift{publishedShifts.length !== 1 ? 's' : ''} ·{' '}
                  {totalHours.toFixed(1)} hours total
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

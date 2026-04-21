import { useState } from 'react';
import { startOfWeek, addDays, endOfWeek, addWeeks, subWeeks, format } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useSchedules } from '@/hooks/useSchedules';
import { useShifts, useEmployeesForSchedule } from '@/hooks/useShifts';
import { getWeekDays, employeeSortComparator } from '@/lib/scheduleUtils';
import { ScheduleGrid } from '@/components/schedule/ScheduleGrid';

export function TeamSchedulePage() {
  const organization = useAuthStore((s) => s.organization);
  const timezone = organization?.timezone ?? 'America/Los_Angeles';

  const [currentWeek, setCurrentWeek] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 0 }),
  );
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);

  const weekStart = currentWeek;
  const weekEnd   = addDays(endOfWeek(currentWeek, { weekStartsOn: 0 }), 1);
  const weekDays  = getWeekDays(currentWeek);

  const { data: schedules = [] } = useSchedules();
  const activeScheduleId = selectedScheduleId ?? schedules[0]?.id ?? null;

  const { data: shifts = [], isLoading } = useShifts(activeScheduleId, weekStart, weekEnd);
  const { data: employees = [] } = useEmployeesForSchedule(activeScheduleId);

  const sortedEmployees = [...employees].sort(employeeSortComparator('first_name'));
  const publishedShifts = shifts.filter((s) => s.status === 'published');

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <h1 className="text-xl font-semibold">Team Schedule</h1>
        <div className="flex items-center gap-2">
          <select
            value={activeScheduleId ?? ''}
            onChange={(e) => setSelectedScheduleId(e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
          >
            {schedules.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button
            onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
            className="h-9 w-9 rounded-md border border-input flex items-center justify-center hover:bg-accent"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium px-2 min-w-[160px] text-center">
            {format(currentWeek, 'MMM d')} – {format(addWeeks(currentWeek, 1), 'MMM d, yyyy')}
          </span>
          <button
            onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
            className="h-9 w-9 rounded-md border border-input flex items-center justify-center hover:bg-accent"
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 0 }))}
            className="h-9 px-3 rounded-md border border-input text-sm hover:bg-accent"
          >
            Today
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            Loading…
          </div>
        ) : (
          <ScheduleGrid
            weekDays={weekDays}
            employees={sortedEmployees}
            shifts={publishedShifts}
            timezone={timezone}
            onCellClick={() => {}}
            onShiftClick={() => {}}
            showOpenShiftsRow={false}
          />
        )}
      </div>
    </div>
  );
}

import { startOfWeek, addDays } from 'date-fns';
import { toZonedTime, format } from 'date-fns-tz';

export function getWeekDays(referenceDate: Date, weekStartsOn: 0 | 1 = 0): Date[] {
  const start = startOfWeek(referenceDate, { weekStartsOn });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function shiftDurationHours(
  start: Date,
  end: Date,
  breakMinutes: number,
): number {
  const totalMs = end.getTime() - start.getTime();
  if (totalMs <= 0) return 0;
  return totalMs / 3_600_000 - breakMinutes / 60;
}

export function shiftLaborCost(
  hours: number,
  hourlyRate: number | null,
): number {
  if (!hourlyRate) return 0;
  return hours * hourlyRate;
}

export function formatShiftTime(date: Date, timezone: string): string {
  const zoned = toZonedTime(date, timezone);
  return format(zoned, 'h:mm a', { timeZone: timezone });
}

/**
 * Returns the YYYY-MM-DD date string of a UTC timestamp in the given timezone.
 * cellDate is treated as "the local calendar date whose UTC midnight matches",
 * i.e. we read its year/month/day fields directly (they represent the local date).
 */
function localDateStr(utcDate: Date, timezone: string): string {
  return format(toZonedTime(utcDate, timezone), 'yyyy-MM-dd', { timeZone: timezone });
}

export function shiftsForCell<T extends { profile_id: string | null; start_time: string }>(
  shifts: T[],
  profileId: string,
  cellDate: Date,
  timezone: string,
): T[] {
  // cellDate is passed as a Date whose UTC y/m/d represents the desired local date
  const cellStr = `${cellDate.getUTCFullYear()}-${String(cellDate.getUTCMonth() + 1).padStart(2, '0')}-${String(cellDate.getUTCDate()).padStart(2, '0')}`;
  return shifts.filter((s) => {
    if (s.profile_id !== profileId) return false;
    return localDateStr(new Date(s.start_time), timezone) === cellStr;
  });
}

export function openShiftsForCell<T extends { is_open_shift: boolean; start_time: string }>(
  shifts: T[],
  cellDate: Date,
  timezone: string,
): T[] {
  const cellStr = `${cellDate.getUTCFullYear()}-${String(cellDate.getUTCMonth() + 1).padStart(2, '0')}-${String(cellDate.getUTCDate()).padStart(2, '0')}`;
  return shifts.filter((s) => {
    if (!s.is_open_shift) return false;
    return localDateStr(new Date(s.start_time), timezone) === cellStr;
  });
}

export type EmployeeSortMode = 'first_name' | 'last_name' | 'custom';

type SortableEmployee = {
  sort_order: number;
  profile: { first_name: string; last_name: string };
};

export function employeeSortComparator(mode: EmployeeSortMode) {
  return (a: SortableEmployee, b: SortableEmployee): number => {
    if (mode === 'first_name') return a.profile.first_name.localeCompare(b.profile.first_name);
    if (mode === 'last_name')  return a.profile.last_name.localeCompare(b.profile.last_name);
    return a.sort_order - b.sort_order;
  };
}

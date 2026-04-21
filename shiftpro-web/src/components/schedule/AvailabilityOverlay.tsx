import { toZonedTime } from 'date-fns-tz';
import type { AvailabilityRow } from '@/hooks/useAvailability';

const DAY_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

interface Props {
  availability: AvailabilityRow[];
  profileId: string;
  cellDate: Date;
  timezone: string;
}

export function AvailabilityOverlay({ availability, profileId, cellDate, timezone }: Props) {
  const localDate = toZonedTime(cellDate, timezone);
  const dayIndex  = localDate.getDay();
  const dayName   = Object.keys(DAY_INDEX).find((k) => DAY_INDEX[k] === dayIndex);
  const row       = availability.find(
    (a) => a.profile_id === profileId && a.day_of_week === dayName
  );

  if (!row) return null;

  if (!row.is_available) {
    return (
      <div className="absolute inset-0 bg-red-50 opacity-40 pointer-events-none rounded" />
    );
  }

  if (row.start_time || row.end_time) {
    return (
      <div className="absolute inset-x-0 bottom-0 h-1 bg-green-400 opacity-50 pointer-events-none rounded-b" />
    );
  }

  return null;
}

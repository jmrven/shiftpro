import { format, addWeeks, subWeeks } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Schedule } from '@/hooks/useSchedules';

interface Props {
  schedules: Schedule[];
  selectedScheduleId: string | null;
  currentWeek: Date;
  onScheduleChange: (id: string) => void;
  onWeekChange: (date: Date) => void;
  onPublish: () => void;
  isPublishing: boolean;
}

export function ScheduleToolbar({
  schedules, selectedScheduleId, currentWeek,
  onScheduleChange, onWeekChange, onPublish, isPublishing,
}: Props) {
  const weekLabel = format(currentWeek, 'MMM d') + ' – ' + format(addWeeks(currentWeek, 1), 'MMM d, yyyy');

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border bg-background">
      <select
        value={selectedScheduleId ?? ''}
        onChange={(e) => onScheduleChange(e.target.value)}
        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
      >
        {schedules.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>

      <div className="flex items-center gap-1 ml-auto">
        <button
          onClick={() => onWeekChange(subWeeks(currentWeek, 1))}
          className="h-9 w-9 flex items-center justify-center rounded-md border border-input hover:bg-accent"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium px-3 min-w-[160px] text-center">{weekLabel}</span>
        <button
          onClick={() => onWeekChange(addWeeks(currentWeek, 1))}
          className="h-9 w-9 flex items-center justify-center rounded-md border border-input hover:bg-accent"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          onClick={() => onWeekChange(new Date())}
          className="h-9 px-3 rounded-md border border-input text-sm hover:bg-accent ml-1"
        >
          Today
        </button>
      </div>

      <button
        onClick={onPublish}
        disabled={isPublishing}
        className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50 ml-2"
      >
        {isPublishing ? 'Publishing…' : 'Publish'}
      </button>
    </div>
  );
}

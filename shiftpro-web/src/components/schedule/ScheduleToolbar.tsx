import { useState } from 'react';
import { format, addWeeks, subWeeks } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Schedule } from '@/hooks/useSchedules';
import type { EmployeeSortMode } from '@/lib/scheduleUtils';

interface Props {
  schedules: Schedule[];
  selectedScheduleId: string | null;
  currentWeek: Date;
  onScheduleChange: (id: string) => void;
  onWeekChange: (date: Date) => void;
  onPublish: () => void;
  isPublishing: boolean;
  sortMode: EmployeeSortMode;
  onSortChange: (mode: EmployeeSortMode) => void;
  showAvailability: boolean;
  onToggleAvailability: () => void;
  showTimeOff: boolean;
  onToggleTimeOff: () => void;
  onOpenTemplates: () => void;
  onClearShifts: () => void;
  onExportCSV: () => void;
  onCopyPreviousWeek: () => void;
}

export function ScheduleToolbar({
  schedules, selectedScheduleId, currentWeek,
  onScheduleChange, onWeekChange, onPublish, isPublishing,
  sortMode, onSortChange,
  showAvailability, onToggleAvailability,
  showTimeOff, onToggleTimeOff,
  onOpenTemplates, onClearShifts, onExportCSV, onCopyPreviousWeek,
}: Props) {
  const [toolsOpen, setToolsOpen] = useState(false);
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

      <select
        aria-label="Sort employees"
        value={sortMode}
        onChange={(e) => onSortChange(e.target.value as EmployeeSortMode)}
        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
      >
        <option value="custom">Custom Order</option>
        <option value="first_name">First Name</option>
        <option value="last_name">Last Name</option>
      </select>

      <button
        onClick={onToggleAvailability}
        className={`h-9 px-3 rounded-md border text-sm transition-colors ${
          showAvailability
            ? 'bg-primary/10 border-primary text-primary'
            : 'border-input text-muted-foreground hover:bg-accent'
        }`}
      >
        Availability
      </button>
      <button
        onClick={onToggleTimeOff}
        className={`h-9 px-3 rounded-md border text-sm transition-colors ${
          showTimeOff
            ? 'bg-primary/10 border-primary text-primary'
            : 'border-input text-muted-foreground hover:bg-accent'
        }`}
      >
        Time Off
      </button>

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

      <div className="relative">
        <button
          onClick={() => setToolsOpen((v) => !v)}
          className="h-9 px-3 rounded-md border border-input text-sm hover:bg-accent"
        >
          Tools ▾
        </button>
        {toolsOpen && (
          <div className="absolute right-0 top-full mt-1 w-48 rounded-md border border-border bg-background shadow-lg z-20">
            <button onClick={() => { onOpenTemplates(); setToolsOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-accent">Templates…</button>
            <button onClick={() => { onCopyPreviousWeek(); setToolsOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-accent">Copy Previous Week</button>
            <button onClick={() => { onExportCSV(); setToolsOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-accent">Export CSV</button>
            <hr className="border-border my-1" />
            <button onClick={() => { onClearShifts(); setToolsOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-destructive hover:bg-accent">Clear Shifts…</button>
          </div>
        )}
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

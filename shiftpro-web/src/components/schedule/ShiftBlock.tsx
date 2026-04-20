import { formatShiftTime, shiftDurationHours } from '@/lib/scheduleUtils';
import type { ShiftRow } from '@/hooks/useShifts';

interface Props {
  shift: ShiftRow;
  timezone: string;
  onClick: (shift: ShiftRow) => void;
  isDragging?: boolean;
}

export function ShiftBlock({ shift, timezone, onClick, isDragging }: Props) {
  const color = shift.color ?? shift.position?.color ?? '#6366f1';
  const startLabel = formatShiftTime(new Date(shift.start_time), timezone);
  const endLabel   = formatShiftTime(new Date(shift.end_time), timezone);
  const hours = shiftDurationHours(
    new Date(shift.start_time),
    new Date(shift.end_time),
    shift.break_minutes,
  );

  return (
    <button
      onClick={() => onClick(shift)}
      style={{ backgroundColor: color }}
      className={`
        w-full text-left rounded px-1.5 py-1 text-white text-xs
        shadow-sm select-none cursor-pointer transition-opacity
        ${isDragging ? 'opacity-40' : 'opacity-100'}
      `}
    >
      <div className="font-semibold truncate">
        {startLabel} – {endLabel}
      </div>
      {shift.position && (
        <div className="truncate opacity-90">{shift.position.name}</div>
      )}
      <div className="flex items-center justify-between mt-0.5 opacity-75">
        <span>{hours.toFixed(1)}h</span>
        {shift.status === 'draft' && (
          <span className="text-[9px] font-bold tracking-wide bg-white/20 rounded px-1">
            DRAFT
          </span>
        )}
      </div>
    </button>
  );
}

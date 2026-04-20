import React from 'react';
import { format } from 'date-fns';
import { useDrop } from 'react-dnd';
import { cn } from '@/lib/cn';
import { ShiftBlock } from './ShiftBlock';
import { shiftsForCell, openShiftsForCell } from '@/lib/scheduleUtils';
import type { ShiftRow } from '@/hooks/useShifts';

type Employee = {
  id: string;
  sort_order: number;
  profile: {
    id: string;
    first_name: string;
    last_name: string;
    hourly_rate: number | null;
    avatar_url: string | null;
    status: string;
  };
};

interface GridCellProps {
  shifts: ShiftRow[];
  timezone: string;
  onShiftClick: (shift: ShiftRow) => void;
  onCellClick: () => void;
  onDrop: (shiftId: string) => void;
}

function GridCell({ shifts, timezone, onShiftClick, onCellClick, onDrop }: GridCellProps) {
  const [{ isOver }, drop] = useDrop({
    accept: 'SHIFT',
    drop: (item: { id: string }) => onDrop(item.id),
    collect: (monitor) => ({ isOver: monitor.isOver() }),
  });

  return (
    <div
      ref={drop}
      onClick={shifts.length === 0 ? onCellClick : undefined}
      className={cn(
        'min-h-[60px] border-r border-b border-border p-1 space-y-1 relative',
        isOver && 'bg-primary/5',
        shifts.length === 0 && 'cursor-pointer hover:bg-accent/50 group',
      )}
    >
      {shifts.length === 0 && (
        <span className="absolute inset-0 flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 text-xl">
          +
        </span>
      )}
      {shifts.map((s) => (
        <ShiftBlock
          key={s.id}
          shift={s}
          timezone={timezone}
          onClick={onShiftClick}
        />
      ))}
    </div>
  );
}

interface Props {
  weekDays: Date[];
  employees: Employee[];
  shifts: ShiftRow[];
  timezone: string;
  onCellClick: (profileId: string | null, date: Date) => void;
  onShiftClick: (shift: ShiftRow) => void;
  onShiftDrop?: (shiftId: string, newProfileId: string | null, newDate: Date) => void;
  showOpenShiftsRow?: boolean;
}

export function ScheduleGrid({
  weekDays, employees, shifts, timezone,
  onCellClick, onShiftClick, onShiftDrop,
  showOpenShiftsRow = true,
}: Props) {
  const colCount = weekDays.length;

  return (
    <div className="overflow-x-auto">
      <div
        className="min-w-[700px]"
        style={{ display: 'grid', gridTemplateColumns: `180px repeat(${colCount}, 1fr)` }}
      >
        {/* Header row */}
        <div className="bg-muted border-r border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
          Employee
        </div>
        {weekDays.map((day) => (
          <div
            key={day.toISOString()}
            className="bg-muted border-r border-b border-border px-2 py-2 text-center text-xs font-medium text-muted-foreground"
          >
            <div>{format(day, 'EEE')}</div>
            <div className="text-foreground font-semibold">{format(day, 'd')}</div>
          </div>
        ))}

        {/* Open Shifts row */}
        {showOpenShiftsRow && (
          <>
            <div className="border-r border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground flex items-center">
              Open Shifts
            </div>
            {weekDays.map((day) => {
              const cellShifts = openShiftsForCell(shifts, day, timezone);
              return (
                <GridCell
                  key={day.toISOString()}
                  shifts={cellShifts}
                  timezone={timezone}
                  onShiftClick={onShiftClick}
                  onCellClick={() => onCellClick(null, day)}
                  onDrop={(shiftId) => onShiftDrop?.(shiftId, null, day)}
                />
              );
            })}
          </>
        )}

        {/* Employee rows */}
        {employees.map(({ id: empSchedId, profile }) => (
          <React.Fragment key={empSchedId}>
            <div className="border-r border-b border-border px-3 py-2 flex items-center gap-2 text-sm">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} className="h-6 w-6 rounded-full object-cover" alt="" />
              ) : (
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                  {profile.first_name[0]}
                </div>
              )}
              <span className="truncate font-medium">
                {profile.first_name} {profile.last_name}
              </span>
            </div>
            {weekDays.map((day) => {
              const cellShifts = shiftsForCell(shifts, profile.id, day, timezone);
              return (
                <GridCell
                  key={`${profile.id}-${day.toISOString()}`}
                  shifts={cellShifts}
                  timezone={timezone}
                  onShiftClick={onShiftClick}
                  onCellClick={() => onCellClick(profile.id, day)}
                  onDrop={(shiftId) => onShiftDrop?.(shiftId, profile.id, day)}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

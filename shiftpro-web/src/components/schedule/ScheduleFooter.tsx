import { shiftDurationHours, shiftLaborCost, shiftsForCell, openShiftsForCell } from '@/lib/scheduleUtils';
import type { ShiftRow } from '@/hooks/useShifts';

interface Props {
  weekDays: Date[];
  shifts: ShiftRow[];
  timezone: string;
  employeeRates: Record<string, number | null>;
  defaultRate: number | null;
}

function calcDayTotals(dayShifts: ShiftRow[], employeeRates: Record<string, number | null>, defaultRate: number | null) {
  let hours = 0;
  let cost = 0;
  for (const s of dayShifts) {
    const h = shiftDurationHours(new Date(s.start_time), new Date(s.end_time), s.break_minutes);
    hours += h;
    const rate = (s.profile_id ? employeeRates[s.profile_id] : null) ?? defaultRate;
    cost += shiftLaborCost(h, rate);
  }
  return { hours, cost };
}

export function ScheduleFooter({ weekDays, shifts, timezone, employeeRates, defaultRate }: Props) {
  const allProfiles = [...new Set(shifts.map((s) => s.profile_id).filter(Boolean))] as string[];

  const dayTotals = weekDays.map((day) => {
    const dayShifts = [
      ...allProfiles.flatMap((pid) => shiftsForCell(shifts, pid, day, timezone)),
      ...openShiftsForCell(shifts, day, timezone),
    ];
    // Deduplicate by shift id
    const seen = new Set<string>();
    const uniqueDayShifts = dayShifts.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
    return calcDayTotals(uniqueDayShifts, employeeRates, defaultRate);
  });

  const grandHours = dayTotals.reduce((a, d) => a + d.hours, 0);
  const grandCost  = dayTotals.reduce((a, d) => a + d.cost, 0);

  return (
    <div
      className="min-w-[700px] border-t-2 border-border bg-muted/50"
      style={{ display: 'grid', gridTemplateColumns: `180px repeat(${weekDays.length}, 1fr)` }}
    >
      <div className="px-3 py-2 text-xs font-semibold text-muted-foreground">
        <div>TOTALS</div>
        <div>{grandHours.toFixed(1)}h</div>
        {grandCost > 0 && <div>${grandCost.toFixed(0)}</div>}
      </div>
      {dayTotals.map((total, i) => (
        <div key={i} className="border-r border-border px-2 py-2 text-xs text-center text-muted-foreground">
          <div>{total.hours.toFixed(1)}h</div>
          {total.cost > 0 && <div>${total.cost.toFixed(0)}</div>}
        </div>
      ))}
    </div>
  );
}

import { describe, it, expect } from 'vitest';
import {
  getWeekDays,
  shiftDurationHours,
  shiftLaborCost,
  formatShiftTime,
  shiftsForCell,
  openShiftsForCell,
  employeeSortComparator,
} from './scheduleUtils';

describe('getWeekDays', () => {
  it('returns 7 dates starting from Sunday for a mid-week date', () => {
    const result = getWeekDays(new Date(2026, 3, 22, 12, 0, 0)); // April 22 local noon
    expect(result).toHaveLength(7);
    const first = result[0];
    expect(first.getFullYear()).toBe(2026);
    expect(first.getMonth()).toBe(3); // April
    expect(first.getDate()).toBe(19); // Sunday April 19
    const last = result[6];
    expect(last.getDate()).toBe(25); // Saturday April 25
  });
});

describe('shiftDurationHours', () => {
  it('subtracts break minutes from total duration', () => {
    const start = new Date('2026-04-22T08:00:00Z');
    const end   = new Date('2026-04-22T16:00:00Z');
    expect(shiftDurationHours(start, end, 30)).toBeCloseTo(7.5);
  });
  it('returns 0 for zero-duration shift', () => {
    const t = new Date('2026-04-22T08:00:00Z');
    expect(shiftDurationHours(t, t, 0)).toBe(0);
  });
});

describe('shiftLaborCost', () => {
  it('multiplies hours by rate', () => {
    expect(shiftLaborCost(8, 20)).toBe(160);
  });
  it('returns 0 when rate is null', () => {
    expect(shiftLaborCost(8, null)).toBe(0);
  });
});

describe('formatShiftTime', () => {
  it('formats UTC timestamp as local time in given timezone', () => {
    // 2026-04-22T16:00:00Z = 9:00 AM PDT (America/Los_Angeles, UTC-7 in April)
    const t = new Date('2026-04-22T16:00:00Z');
    const result = formatShiftTime(t, 'America/Los_Angeles');
    expect(result).toMatch(/^9:00 AM$/);
  });
});

describe('shiftsForCell', () => {
  it('returns shifts matching profile_id and date in org timezone', () => {
    const shifts: Array<{ id: string; profile_id: string | null; is_open_shift: boolean; start_time: string; end_time: string }> = [
      { id: '1', profile_id: 'abc', is_open_shift: false, start_time: '2026-04-22T15:00:00Z', end_time: '2026-04-22T23:00:00Z' },
      { id: '2', profile_id: 'xyz', is_open_shift: false, start_time: '2026-04-22T15:00:00Z', end_time: '2026-04-22T23:00:00Z' },
      { id: '3', profile_id: 'abc', is_open_shift: false, start_time: '2026-04-23T15:00:00Z', end_time: '2026-04-23T23:00:00Z' },
    ];
    const cellDate = new Date('2026-04-22T00:00:00Z');
    const result = shiftsForCell(shifts, 'abc', cellDate, 'America/Los_Angeles');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('places shift on correct local date even when UTC date differs (negative-offset timezone)', () => {
    // 2026-04-23T13:30:00Z = April 23 at 6:30 AM PDT (UTC-7) — belongs to Apr 23 local
    const shifts: Array<{ id: string; profile_id: string | null; is_open_shift: boolean; start_time: string; end_time: string }> = [
      { id: 'a', profile_id: 'abc', is_open_shift: false, start_time: '2026-04-23T13:30:00Z', end_time: '2026-04-23T21:30:00Z' },
    ];
    const cellDate = new Date('2026-04-23T00:00:00Z');
    const result = shiftsForCell(shifts, 'abc', cellDate, 'America/Los_Angeles');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('does not include shift from a different UTC date that is the same UTC date as cellDate but different local date', () => {
    // 2026-04-22T23:30:00Z = April 22 at 4:30 PM PDT — belongs to Apr 22 local, not Apr 23
    const shifts: Array<{ id: string; profile_id: string | null; is_open_shift: boolean; start_time: string; end_time: string }> = [
      { id: 'b', profile_id: 'abc', is_open_shift: false, start_time: '2026-04-22T23:30:00Z', end_time: '2026-04-23T07:30:00Z' },
    ];
    const cellDate = new Date('2026-04-23T00:00:00Z'); // asking for Apr 23
    const result = shiftsForCell(shifts, 'abc', cellDate, 'America/Los_Angeles');
    expect(result).toHaveLength(0); // shift is on Apr 22 local, should not appear on Apr 23 cell
  });
});

describe('openShiftsForCell', () => {
  it('returns only open shifts for the given date', () => {
    const shifts: Array<{ id: string; profile_id: string | null; is_open_shift: boolean; start_time: string; end_time: string }> = [
      { id: '1', profile_id: null,  is_open_shift: true,  start_time: '2026-04-22T15:00:00Z', end_time: '2026-04-22T23:00:00Z' },
      { id: '2', profile_id: 'abc', is_open_shift: false, start_time: '2026-04-22T15:00:00Z', end_time: '2026-04-22T23:00:00Z' },
    ];
    const cellDate = new Date('2026-04-22T00:00:00Z');
    const result = openShiftsForCell(shifts, cellDate, 'America/Los_Angeles');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });
});

describe('employeeSortComparator', () => {
  const employees = [
    { sort_order: 2, profile: { id: 'c', first_name: 'Carlos', last_name: 'Reyes', hourly_rate: null, avatar_url: null, status: 'active' } },
    { sort_order: 0, profile: { id: 'a', first_name: 'Alex',   last_name: 'Park',  hourly_rate: null, avatar_url: null, status: 'active' } },
    { sort_order: 1, profile: { id: 'b', first_name: 'Beth',   last_name: 'Adams', hourly_rate: null, avatar_url: null, status: 'active' } },
  ];

  it('sorts by first name', () => {
    const sorted = [...employees].sort(employeeSortComparator('first_name'));
    expect(sorted.map((e) => e.profile.first_name)).toEqual(['Alex', 'Beth', 'Carlos']);
  });

  it('sorts by last name', () => {
    const sorted = [...employees].sort(employeeSortComparator('last_name'));
    expect(sorted.map((e) => e.profile.last_name)).toEqual(['Adams', 'Park', 'Reyes']);
  });

  it('sorts by custom sort_order', () => {
    const sorted = [...employees].sort(employeeSortComparator('custom'));
    expect(sorted.map((e) => e.sort_order)).toEqual([0, 1, 2]);
  });
});

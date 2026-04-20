import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { ScheduleGrid } from './ScheduleGrid';
import { getWeekDays } from '@/lib/scheduleUtils';

const weekDays = getWeekDays(new Date(2026, 3, 19)); // April 19, 2026 (local)

const employees = [
  { id: 'emp-sched-1', sort_order: 0,
    profile: { id: 'p1', first_name: 'Alex', last_name: 'P', hourly_rate: 20, avatar_url: null, status: 'active' } },
  { id: 'emp-sched-2', sort_order: 1,
    profile: { id: 'p2', first_name: 'Maria', last_name: 'A', hourly_rate: 18, avatar_url: null, status: 'active' } },
];

const shifts = [
  {
    id: 's1', schedule_id: 'sc1', profile_id: 'p1', position_id: null, job_site_id: null,
    start_time: '2026-04-20T16:00:00Z', end_time: '2026-04-21T00:00:00Z',
    break_minutes: 30, notes: null, status: 'draft' as const,
    is_open_shift: false, color: null,
    position: { name: 'Wrangler', color: '#10B981' },
    profile: { first_name: 'Alex', last_name: 'P', hourly_rate: 20 },
  },
];

const wrap = (ui: React.ReactNode) => (
  <DndProvider backend={HTML5Backend}>{ui}</DndProvider>
);

describe('ScheduleGrid', () => {
  it('renders employee names', () => {
    render(wrap(
      <ScheduleGrid
        weekDays={weekDays}
        employees={employees}
        shifts={shifts}
        timezone="America/Los_Angeles"
        onCellClick={vi.fn()}
        onShiftClick={vi.fn()}
      />
    ));
    expect(screen.getByText('Alex P')).toBeTruthy();
    expect(screen.getByText('Maria A')).toBeTruthy();
  });

  it('renders day column headers', () => {
    render(wrap(
      <ScheduleGrid
        weekDays={weekDays}
        employees={employees}
        shifts={shifts}
        timezone="America/Los_Angeles"
        onCellClick={vi.fn()}
        onShiftClick={vi.fn()}
      />
    ));
    expect(screen.getByText(/Sun/i)).toBeTruthy();
    expect(screen.getByText(/Mon/i)).toBeTruthy();
  });

  it('renders shift block for matching employee and day', () => {
    render(wrap(
      <ScheduleGrid
        weekDays={weekDays}
        employees={employees}
        shifts={shifts}
        timezone="America/Los_Angeles"
        onCellClick={vi.fn()}
        onShiftClick={vi.fn()}
      />
    ));
    expect(screen.getByText('Wrangler')).toBeTruthy();
  });
});

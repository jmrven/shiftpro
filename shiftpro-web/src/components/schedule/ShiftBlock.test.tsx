import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShiftBlock } from './ShiftBlock';
import type { ShiftRow } from '@/hooks/useShifts';

const baseShift: ShiftRow = {
  id: 'shift-1',
  schedule_id: 'sched-1',
  profile_id: 'profile-1',
  position_id: 'pos-1',
  job_site_id: null,
  start_time: '2026-04-22T16:00:00Z',  // 9am Pacific (PDT = UTC-7)
  end_time:   '2026-04-23T00:00:00Z',  // 5pm Pacific
  break_minutes: 30,
  notes: null,
  status: 'draft',
  is_open_shift: false,
  color: null,
  position: { name: 'Wrangler', color: '#10B981' },
  profile: { first_name: 'Alex', last_name: 'P', hourly_rate: 20 },
};

describe('ShiftBlock', () => {
  it('renders time range', () => {
    render(
      <ShiftBlock shift={baseShift} timezone="America/Los_Angeles" onClick={vi.fn()} />
    );
    expect(screen.getByText(/9:00 AM/)).toBeTruthy();
    expect(screen.getByText(/5:00 PM/)).toBeTruthy();
  });

  it('renders position name', () => {
    render(
      <ShiftBlock shift={baseShift} timezone="America/Los_Angeles" onClick={vi.fn()} />
    );
    expect(screen.getByText('Wrangler')).toBeTruthy();
  });

  it('uses position color as background', () => {
    const { container } = render(
      <ShiftBlock shift={baseShift} timezone="America/Los_Angeles" onClick={vi.fn()} />
    );
    const block = container.firstChild as HTMLElement;
    expect(block.style.backgroundColor).toBe('rgb(16, 185, 129)'); // #10B981
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(
      <ShiftBlock shift={baseShift} timezone="America/Los_Angeles" onClick={onClick} />
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledWith(baseShift);
  });

  it('shows DRAFT badge when status is draft', () => {
    render(
      <ShiftBlock shift={baseShift} timezone="America/Los_Angeles" onClick={vi.fn()} />
    );
    expect(screen.getByText('DRAFT')).toBeTruthy();
  });
});

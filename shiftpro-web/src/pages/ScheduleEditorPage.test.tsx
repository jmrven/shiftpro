import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { ScheduleEditorPage } from './ScheduleEditorPage';

vi.mock('@/hooks/useSchedules', () => ({
  useSchedules: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/hooks/useShifts', () => ({
  useShifts: () => ({ data: [], isLoading: false }),
  useEmployeesForSchedule: () => ({ data: [], isLoading: false }),
  useUpdateShift: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector?: (s: { organization: { timezone: string } }) => unknown) => {
    const state = { organization: { timezone: 'America/Los_Angeles' } };
    return selector ? selector(state) : state;
  },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <DndProvider backend={HTML5Backend}>
    <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
  </DndProvider>
);

describe('ScheduleEditorPage', () => {
  it('renders the Schedule Editor heading', () => {
    render(<ScheduleEditorPage />, { wrapper });
    expect(screen.getByText('Schedule Editor')).toBeTruthy();
  });

  it('shows empty-state message when no schedules exist', () => {
    render(<ScheduleEditorPage />, { wrapper });
    expect(screen.getByText(/no schedules/i)).toBeTruthy();
  });
});

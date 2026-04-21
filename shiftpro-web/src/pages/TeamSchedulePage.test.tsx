import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TeamSchedulePage } from './TeamSchedulePage';

vi.mock('@/hooks/useSchedules', () => ({
  useSchedules: () => ({ data: [{ id: 's1', name: 'Central', color: '#3B82F6', is_active: true }], isLoading: false }),
}));
vi.mock('@/hooks/useShifts', () => ({
  useShifts: () => ({ data: [], isLoading: false }),
  useEmployeesForSchedule: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (sel: (s: any) => any) => sel({
    user: { id: 'p1', email: 'manager@test.com' },
    organization: { id: 'org1', name: 'Org', timezone: 'America/Los_Angeles' },
    organizationId: 'org1',
  }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <DndProvider backend={HTML5Backend}>
    <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
  </DndProvider>
);

describe('TeamSchedulePage', () => {
  it('renders Team Schedule heading', () => {
    render(<TeamSchedulePage />, { wrapper });
    expect(screen.getByText('Team Schedule')).toBeTruthy();
  });

  it('renders day headers in the grid', () => {
    render(<TeamSchedulePage />, { wrapper });
    expect(screen.getByText(/Sun/i)).toBeTruthy();
  });
});

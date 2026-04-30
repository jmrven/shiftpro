import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

vi.mock('@/hooks/useClockEvents', () => ({
  useClockState: vi.fn(() => ({ data: { status: 'clocked_out', sinceTimestamp: null }, isSuccess: true })),
  useClockAction: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useActiveTimesheets: vi.fn(() => ({ data: [], isSuccess: true })),
  useNoShows: vi.fn(() => ({ data: [], isSuccess: true })),
}));
vi.mock('@/hooks/useGeolocation', () => ({
  useGeolocation: vi.fn(() => ({ latitude: null, longitude: null, error: null, loading: false, request: vi.fn() })),
}));
vi.mock('@/hooks/useRealtimeClockEvents', () => ({
  useRealtimeClockEvents: vi.fn(),
}));
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (sel: (s: { role: string; organization: { timezone: string } | null; organizationId: string | null }) => unknown) =>
    sel({ role: 'admin', organization: { timezone: 'America/Los_Angeles' }, organizationId: 'org-1' }),
}));

import { AttendancePage } from './AttendancePage';

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

describe('AttendancePage', () => {
  it('renders page heading', () => {
    render(<AttendancePage />, { wrapper });
    expect(screen.getByText(/attendance/i)).toBeInTheDocument();
  });

  it("renders Who's Working section for admin", () => {
    render(<AttendancePage />, { wrapper });
    expect(screen.getByText(/who's working/i)).toBeInTheDocument();
  });
});

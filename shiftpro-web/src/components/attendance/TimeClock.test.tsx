import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Set up mocks before importing the component
vi.mock('@/hooks/useClockEvents', () => ({
  useClockState: vi.fn(() => ({ data: { status: 'clocked_out', sinceTimestamp: null }, isSuccess: true })),
  useClockAction: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

vi.mock('@/hooks/useGeolocation', () => ({
  useGeolocation: vi.fn(() => ({ latitude: null, longitude: null, error: null, loading: false, request: vi.fn() })),
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (sel: (s: { organization: { timezone: string } | null }) => unknown) =>
    sel({ organization: { timezone: 'America/Los_Angeles' } }),
}));

import { TimeClock } from './TimeClock';

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      {children}
    </QueryClientProvider>
  );
}

describe('TimeClock', () => {
  it('shows Clock In button when clocked out', () => {
    render(<TimeClock />, { wrapper });
    expect(screen.getByRole('button', { name: /clock in/i })).toBeInTheDocument();
  });

  it('shows Clock Out and Start Break when clocked in', async () => {
    const { useClockState } = await import('@/hooks/useClockEvents');
    (useClockState as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      data: { status: 'clocked_in', sinceTimestamp: new Date().toISOString() },
      isSuccess: true,
    });
    render(<TimeClock />, { wrapper });
    expect(screen.getByRole('button', { name: /clock out/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start break/i })).toBeInTheDocument();
  });

  it('shows End Break button when on break', async () => {
    const { useClockState } = await import('@/hooks/useClockEvents');
    (useClockState as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      data: { status: 'on_break', sinceTimestamp: new Date().toISOString() },
      isSuccess: true,
    });
    render(<TimeClock />, { wrapper });
    expect(screen.getByRole('button', { name: /end break/i })).toBeInTheDocument();
  });
});

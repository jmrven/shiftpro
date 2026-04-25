import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RequestsPage } from './RequestsPage';

vi.mock('@/hooks/useShiftRequests', () => ({
  useShiftRequests: () => ({ data: [], isLoading: false }),
  useRespondToRequest: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (sel: (s: any) => any) =>
    sel({ user: { id: 'u1' }, organizationId: 'org1', role: 'manager', organization: { timezone: 'America/Los_Angeles' } }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe('RequestsPage', () => {
  it('renders Shift Requests heading', () => {
    render(<RequestsPage />, { wrapper });
    expect(screen.getByText('Shift Requests')).toBeTruthy();
  });

  it('renders tab for each request type', () => {
    render(<RequestsPage />, { wrapper });
    expect(screen.getByText('Swaps')).toBeTruthy();
    expect(screen.getByText('Drops')).toBeTruthy();
    expect(screen.getByText('Open Shifts')).toBeTruthy();
  });

  it('shows empty state when no requests', () => {
    render(<RequestsPage />, { wrapper });
    expect(screen.getByText(/no pending/i)).toBeTruthy();
  });
});

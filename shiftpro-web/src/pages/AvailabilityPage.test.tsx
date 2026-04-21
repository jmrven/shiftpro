import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AvailabilityPage } from './AvailabilityPage';

vi.mock('@/hooks/useAvailability', () => ({
  useAvailability: () => ({ data: [], isLoading: false }),
  useUpsertAvailability: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (sel: (s: any) => any) => sel({
    user: { id: 'p1' },
    organizationId: 'org1',
    organization: { timezone: 'America/Los_Angeles' },
  }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe('AvailabilityPage', () => {
  it('renders page heading', () => {
    render(<AvailabilityPage />, { wrapper });
    expect(screen.getByText('My Availability')).toBeTruthy();
  });

  it('renders all 7 days of the week', () => {
    render(<AvailabilityPage />, { wrapper });
    ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].forEach((day) => {
      expect(screen.getByText(day)).toBeTruthy();
    });
  });
});

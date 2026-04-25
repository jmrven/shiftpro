import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useShiftRequests } from './useShiftRequests';
import type { Organization } from '@/stores/authStore';
import type { UserRole } from '@/types/ui';

// A chainable mock that is also awaitable (thenable)
type MockChain = {
  eq: (...args: unknown[]) => MockChain;
  order: (...args: unknown[]) => MockChain;
  then: (resolve: (v: { data: never[]; error: null }) => unknown) => Promise<unknown>;
};

const mockChain: MockChain = {
  eq: () => mockChain,
  order: () => mockChain,
  then: (resolve) => Promise.resolve(resolve({ data: [], error: null })),
};

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => mockChain,
    }),
  },
}));

type MockAuthState = {
  user: { id: string } | null;
  organizationId: string | null;
  role: UserRole | null;
  organization: Organization | null;
};

const mockAuthState: MockAuthState = {
  user: { id: 'u1' },
  organizationId: 'org1',
  role: 'manager' as UserRole,
  organization: null,
};

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (sel: (s: MockAuthState) => unknown) => sel(mockAuthState),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe('useShiftRequests', () => {
  it('returns empty array when no requests exist', async () => {
    const { result } = renderHook(() => useShiftRequests('pending'), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual([]);
  });
});

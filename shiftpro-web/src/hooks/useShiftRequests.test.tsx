import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useShiftRequests } from './useShiftRequests';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  },
}));
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (sel: (s: any) => any) =>
    sel({ user: { id: 'u1' }, organizationId: 'org1', role: 'manager', organization: null }),
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

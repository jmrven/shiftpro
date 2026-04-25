import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Use vi.hoisted to lift these variables before vi.mock
const { mockUnsubscribe, mockChannel } = vi.hoisted(() => {
  const mockUnsubscribe = vi.fn();
  const mockSubscribe = vi.fn().mockReturnValue({ unsubscribe: mockUnsubscribe });
  const mockOn = vi.fn().mockReturnValue({ subscribe: mockSubscribe });
  const mockChannel = vi.fn().mockReturnValue({ on: mockOn });
  return { mockUnsubscribe, mockChannel };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    channel: mockChannel,
  },
}));

import { useRealtimeShifts } from './useRealtimeShifts';

afterEach(() => vi.clearAllMocks());

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe('useRealtimeShifts', () => {
  it('subscribes to the shifts channel for the given scheduleId', () => {
    renderHook(() => useRealtimeShifts('sched-1'), { wrapper });
    expect(mockChannel).toHaveBeenCalledWith('shifts:sched-1');
  });

  it('does not subscribe when scheduleId is null', () => {
    renderHook(() => useRealtimeShifts(null), { wrapper });
    expect(mockChannel).not.toHaveBeenCalled();
  });

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useRealtimeShifts('sched-1'), { wrapper });
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});

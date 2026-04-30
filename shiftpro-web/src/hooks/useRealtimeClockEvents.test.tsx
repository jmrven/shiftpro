import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useRealtimeClockEvents } from './useRealtimeClockEvents';

const { mockUnsubscribe, mockChannel } = vi.hoisted(() => {
  const mockUnsubscribe = vi.fn();
  const mockSubscribe = vi.fn().mockReturnValue({ unsubscribe: mockUnsubscribe });
  const mockOn = vi.fn().mockReturnThis();
  const mockChannel = vi.fn().mockReturnValue({ on: mockOn, subscribe: mockSubscribe });
  return { mockUnsubscribe, mockChannel };
});

vi.mock('@/lib/supabase', () => ({
  supabase: { channel: mockChannel },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

describe('useRealtimeClockEvents', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('subscribes to the correct channel', () => {
    renderHook(() => useRealtimeClockEvents('org-1'), { wrapper });
    expect(mockChannel).toHaveBeenCalledWith('clock_events:org-1');
  });

  it('does not subscribe when orgId is null', () => {
    renderHook(() => useRealtimeClockEvents(null), { wrapper });
    expect(mockChannel).not.toHaveBeenCalled();
  });

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useRealtimeClockEvents('org-1'), { wrapper });
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});

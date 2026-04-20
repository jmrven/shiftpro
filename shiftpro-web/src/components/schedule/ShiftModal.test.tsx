import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ShiftModal } from './ShiftModal';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

describe('ShiftModal', () => {
  it('renders form fields when open', () => {
    render(
      <ShiftModal
        open={true}
        scheduleId="sched-1"
        defaultDate={new Date('2026-04-22')}
        timezone="America/Los_Angeles"
        onClose={vi.fn()}
      />,
      { wrapper }
    );
    expect(screen.getByLabelText(/start time/i)).toBeTruthy();
    expect(screen.getByLabelText(/end time/i)).toBeTruthy();
  });

  it('does not render when closed', () => {
    const { container } = render(
      <ShiftModal
        open={false}
        scheduleId="sched-1"
        defaultDate={new Date('2026-04-22')}
        timezone="America/Los_Angeles"
        onClose={vi.fn()}
      />,
      { wrapper }
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows validation error when start >= end', async () => {
    render(
      <ShiftModal
        open={true}
        scheduleId="sched-1"
        defaultDate={new Date('2026-04-22')}
        timezone="America/Los_Angeles"
        onClose={vi.fn()}
      />,
      { wrapper }
    );
    const startInput = screen.getByLabelText(/start time/i) as HTMLInputElement;
    const endInput   = screen.getByLabelText(/end time/i) as HTMLInputElement;
    fireEvent.change(startInput, { target: { value: '09:00' } });
    fireEvent.change(endInput,   { target: { value: '09:00' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() =>
      expect(screen.getByText(/end time must be after/i)).toBeTruthy()
    );
  });
});

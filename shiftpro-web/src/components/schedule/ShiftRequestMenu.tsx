import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useCreateShiftRequest } from '@/hooks/useShiftRequests';
import type { ShiftRow } from '@/hooks/useShifts';
import { cn } from '@/lib/cn';

interface Props {
  shift: ShiftRow;
}

type Mode = 'menu' | 'drop' | 'offer' | 'claim';

// Inner component — holds the mutation hook so it's only mounted when the panel is open.
// This prevents tests that don't wrap with QueryClientProvider from failing.
function ShiftRequestPanel({
  shift,
  mode,
  onClose,
  onBack,
}: {
  shift: ShiftRow;
  mode: Exclude<Mode, 'menu'>;
  onClose: () => void;
  onBack: () => void;
}) {
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const createRequest = useCreateShiftRequest();

  const stopProp = (e: React.MouseEvent) => e.stopPropagation();

  const handleSubmit = async (e: React.MouseEvent, type: 'drop' | 'offer' | 'open_shift') => {
    e.stopPropagation();
    await createRequest.mutateAsync({
      shift_id: shift.id,
      type,
      requester_note: note.trim() || undefined,
    });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="text-center space-y-3">
        <p className="font-semibold text-green-600">Request submitted!</p>
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="px-4 py-1.5 rounded bg-gray-100 hover:bg-gray-200 text-xs font-medium"
        >
          Close
        </button>
      </div>
    );
  }

  const configs = {
    drop: {
      title: 'Request to drop shift',
      subtitle: 'Your manager will review this request.',
      buttonLabel: 'Submit request',
      buttonClass: 'bg-red-500 hover:bg-red-600',
      type: 'drop' as const,
    },
    offer: {
      title: 'Offer shift to others',
      subtitle: 'This shift will be visible for colleagues to pick up, pending manager approval.',
      buttonLabel: 'Offer shift',
      buttonClass: 'bg-amber-500 hover:bg-amber-600',
      type: 'offer' as const,
    },
    claim: {
      title: 'Claim this open shift',
      subtitle: 'Your request will be reviewed by a manager.',
      buttonLabel: 'Claim shift',
      buttonClass: 'bg-blue-500 hover:bg-blue-600',
      type: 'open_shift' as const,
    },
  };

  const cfg = configs[mode];

  return (
    <div className="space-y-3" onClick={stopProp}>
      <p className="font-semibold text-gray-800">{cfg.title}</p>
      <p className="text-xs text-gray-500">{cfg.subtitle}</p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note…"
        rows={3}
        className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <div className="flex gap-2 justify-end">
        <button
          onClick={(e) => { e.stopPropagation(); onBack(); }}
          className="px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200 text-xs font-medium"
        >
          Back
        </button>
        <button
          onClick={(e) => handleSubmit(e, cfg.type)}
          disabled={createRequest.isPending}
          className={cn('px-3 py-1.5 rounded text-white text-xs font-medium disabled:opacity-50', cfg.buttonClass)}
        >
          {createRequest.isPending ? 'Submitting…' : cfg.buttonLabel}
        </button>
      </div>
    </div>
  );
}

export function ShiftRequestMenu({ shift }: Props) {
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const [mode, setMode] = useState<Mode | null>(null);

  const isOwnShift = shift.profile_id === user?.id;
  const isOpenShift = !!shift.is_open_shift;

  // Only show for own shifts or open shifts
  if (!isOwnShift && !isOpenShift) return null;
  // Admins don't need to claim open shifts via this menu — they manage via modal
  if (isOpenShift && !isOwnShift && role === 'admin') return null;

  const handleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMode('menu');
  };

  const handleClose = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setMode(null);
  };

  const stopProp = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <>
      {/* Trigger button — visible on group-hover */}
      <button
        onClick={handleButtonClick}
        aria-label="Shift request options"
        className={cn(
          'absolute top-0.5 right-0.5 z-10',
          'w-5 h-5 rounded flex items-center justify-center',
          'text-white/70 hover:text-white hover:bg-black/20',
          'opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold leading-none',
        )}
      >
        •••
      </button>

      {/* Overlay panel — only mounted when mode is active, so hooks inside are safe */}
      {mode !== null && (
        <div
          onClick={stopProp}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
        >
          <div
            className="bg-white rounded-lg shadow-xl p-4 w-72 text-sm"
            onClick={stopProp}
          >
            {mode === 'menu' ? (
              <div className="space-y-2">
                <p className="font-semibold text-gray-800 mb-3">
                  {isOpenShift && !isOwnShift ? 'Claim open shift?' : 'Shift options'}
                </p>

                {isOpenShift && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setMode('claim'); }}
                    className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 font-medium text-blue-600"
                  >
                    Claim this shift
                  </button>
                )}

                {isOwnShift && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); setMode('drop'); }}
                      className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 font-medium text-red-600"
                    >
                      Request to drop
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setMode('offer'); }}
                      className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 font-medium text-amber-600"
                    >
                      Offer to someone
                    </button>
                  </>
                )}

                <button
                  onClick={(e) => { e.stopPropagation(); handleClose(e); }}
                  className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-gray-500 mt-1"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <ShiftRequestPanel
                shift={shift}
                mode={mode}
                onClose={() => setMode(null)}
                onBack={() => setMode('menu')}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

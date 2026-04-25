import { useState } from 'react';
import { format } from 'date-fns';
import { useAuthStore } from '@/stores/authStore';
import {
  useShiftRequests,
  useRespondToRequest,
  type ShiftRequestRow,
  type RequestType,
} from '@/hooks/useShiftRequests';
import { formatShiftTime } from '@/lib/scheduleUtils';
import { cn } from '@/lib/cn';

type TabType = RequestType;

const TABS: { type: TabType; label: string }[] = [
  { type: 'swap',       label: 'Swaps' },
  { type: 'drop',       label: 'Drops' },
  { type: 'offer',      label: 'Offers' },
  { type: 'open_shift', label: 'Open Shifts' },
];

function RequestCard({
  request,
  timezone,
  onApprove,
  onDeny,
  isPending,
}: {
  request: ShiftRequestRow;
  timezone: string;
  onApprove: (note: string) => void;
  onDeny: (note: string) => void;
  isPending: boolean;
}) {
  const [note, setNote] = useState('');

  const requesterName = request.requester
    ? `${request.requester.first_name} ${request.requester.last_name}`
    : 'Unknown';

  const shiftStart = request.shift?.start_time
    ? formatShiftTime(new Date(request.shift.start_time), timezone)
    : '—';
  const shiftEnd = request.shift?.end_time
    ? formatShiftTime(new Date(request.shift.end_time), timezone)
    : '—';
  const shiftDate = request.shift?.start_time
    ? format(new Date(request.shift.start_time), 'EEE, MMM d')
    : '—';

  const positionName  = request.shift?.position?.name;
  const positionColor = request.shift?.position?.color ?? '#6366f1';

  const targetName = request.target_shift?.profile
    ? `${request.target_shift.profile.first_name} ${request.target_shift.profile.last_name}`
    : null;

  const createdAt = format(new Date(request.created_at), 'MMM d, yyyy');

  return (
    <div className="border border-border rounded-lg p-4 bg-card space-y-3">
      {/* Top row: requester + date */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium text-sm">{requesterName}</p>
          <p className="text-xs text-muted-foreground">
            {shiftDate} · {shiftStart} – {shiftEnd}
          </p>
        </div>
        <p className="text-xs text-muted-foreground whitespace-nowrap">Submitted {createdAt}</p>
      </div>

      {/* Position badge */}
      {positionName && (
        <span
          className="inline-block text-white text-xs font-medium px-2 py-0.5 rounded"
          style={{ backgroundColor: positionColor }}
        >
          {positionName}
        </span>
      )}

      {/* Swap target */}
      {request.type === 'swap' && targetName && (
        <p className="text-xs text-muted-foreground">
          Swap with: <span className="font-medium text-foreground">{targetName}</span>
        </p>
      )}

      {/* Requester note */}
      {request.requester_note && (
        <p className="text-sm italic text-muted-foreground">"{request.requester_note}"</p>
      )}

      {/* Manager note input */}
      <div>
        <input
          type="text"
          placeholder="Optional note to employee…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={isPending}
          className="w-full text-sm border border-input rounded px-3 py-1.5 bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onApprove(note)}
          disabled={isPending}
          className="px-3 py-1.5 text-sm font-medium rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Approve
        </button>
        <button
          onClick={() => onDeny(note)}
          disabled={isPending}
          className="px-3 py-1.5 text-sm font-medium rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Deny
        </button>
      </div>
    </div>
  );
}

export function RequestsPage() {
  const organization = useAuthStore((s) => s.organization);
  const timezone = organization?.timezone ?? 'America/Los_Angeles';

  const [activeTab, setActiveTab] = useState<TabType>('swap');

  const { data: allRequests = [], isLoading } = useShiftRequests('pending');
  const { mutateAsync: respond, isPending } = useRespondToRequest();

  const filteredRequests = allRequests.filter((r) => r.type === activeTab);

  const countByType = (type: TabType) => allRequests.filter((r) => r.type === type).length;

  const tabLabel = TABS.find((t) => t.type === activeTab)?.label ?? activeTab;

  async function handleRespond(requestId: string, action: 'approve' | 'deny', note: string) {
    await respond({ requestId, action, managerNote: note || undefined });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border">
        <h1 className="text-xl font-semibold">Shift Requests</h1>
        <p className="text-sm text-muted-foreground">Review and respond to pending shift requests.</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border px-6">
        {TABS.map(({ type, label }) => {
          const count = countByType(type);
          const isActive = activeTab === type;
          return (
            <button
              key={type}
              onClick={() => setActiveTab(type)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
              {count > 0 && (
                <span
                  className={cn(
                    'text-xs font-semibold rounded-full px-1.5 py-0.5',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            Loading…
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            No pending {tabLabel.toLowerCase()} requests.
          </div>
        ) : (
          <div className="space-y-4 max-w-2xl">
            {filteredRequests.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                timezone={timezone}
                isPending={isPending}
                onApprove={(note) => handleRespond(request.id, 'approve', note)}
                onDeny={(note) => handleRespond(request.id, 'deny', note)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

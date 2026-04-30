import { TimeClock } from '@/components/attendance/TimeClock';
import { WhosWorking } from '@/components/attendance/WhosWorking';
import { NoShowWidget } from '@/components/attendance/NoShowWidget';
import { useAuthStore } from '@/stores/authStore';

export function AttendancePage() {
  const role = useAuthStore((s) => s.role);
  const isManager = role === 'admin' || role === 'manager';

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border">
        <h1 className="text-lg font-semibold">Attendance</h1>
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
              Time Clock
            </h2>
            <TimeClock />
          </div>

          {isManager && (
            <div>
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
                Who's Working
              </h2>
              <WhosWorking />
            </div>
          )}
        </div>

        {isManager && (
          <div>
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
              No Shows
            </h2>
            <NoShowWidget />
          </div>
        )}
      </div>
    </div>
  );
}

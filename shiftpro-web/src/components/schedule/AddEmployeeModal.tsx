import { useState } from 'react';
import { useEmployees } from '@/hooks/useEmployees';
import { useAddEmployeeToSchedule, useRemoveEmployeeFromSchedule } from '@/hooks/useShifts';

interface Props {
  open: boolean;
  scheduleId: string;
  assignedProfileIds: string[];
  onClose: () => void;
}

export function AddEmployeeModal({ open, scheduleId, assignedProfileIds, onClose }: Props) {
  const { data: allEmployees = [] } = useEmployees();
  const addEmployee = useAddEmployeeToSchedule();
  const removeEmployee = useRemoveEmployeeFromSchedule();
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const assigned = allEmployees.filter((e) => assignedProfileIds.includes(e.id));
  const unassigned = allEmployees.filter((e) => !assignedProfileIds.includes(e.id));

  async function handleAdd(profileId: string) {
    setError(null);
    try {
      await addEmployee.mutateAsync({
        scheduleId,
        profileId,
        sortOrder: assignedProfileIds.length + 1,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add employee');
    }
  }

  async function handleRemove(profileId: string) {
    setError(null);
    try {
      await removeEmployee.mutateAsync({ scheduleId, profileId });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove employee');
    }
  }

  const isPending = addEmployee.isPending || removeEmployee.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold">Manage Employees</h2>

        {error && <p className="text-xs text-destructive">{error}</p>}

        {assigned.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">On this schedule</p>
            <ul className="space-y-1">
              {assigned.map((emp) => (
                <li key={emp.id} className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/50">
                  <span className="text-sm">{emp.first_name} {emp.last_name}</span>
                  <button
                    onClick={() => handleRemove(emp.id)}
                    disabled={isPending}
                    className="text-xs text-destructive hover:underline disabled:opacity-50"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {unassigned.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Add to schedule</p>
            <ul className="space-y-1">
              {unassigned.map((emp) => (
                <li key={emp.id} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50">
                  <span className="text-sm">{emp.first_name} {emp.last_name}</span>
                  <button
                    onClick={() => handleAdd(emp.id)}
                    disabled={isPending}
                    className="text-xs text-primary hover:underline disabled:opacity-50"
                  >
                    + Add
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {unassigned.length === 0 && assigned.length === 0 && (
          <p className="text-sm text-muted-foreground">No employees in your organization yet.</p>
        )}

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

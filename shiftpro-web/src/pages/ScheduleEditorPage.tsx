import { useState, useCallback, useMemo } from 'react';
import { startOfWeek, endOfWeek } from 'date-fns';
import { fromZonedTime, format as formatTz } from 'date-fns-tz';
import { callFunction } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useSchedules } from '@/hooks/useSchedules';
import { useShifts, useEmployeesForSchedule, useUpdateShift } from '@/hooks/useShifts';
import { getWeekDays } from '@/lib/scheduleUtils';
import { useQueryClient } from '@tanstack/react-query';
import { ScheduleToolbar } from '@/components/schedule/ScheduleToolbar';
import { ScheduleGrid } from '@/components/schedule/ScheduleGrid';
import { ScheduleFooter } from '@/components/schedule/ScheduleFooter';
import { ShiftModal } from '@/components/schedule/ShiftModal';
import type { ShiftRow } from '@/hooks/useShifts';

export function ScheduleEditorPage() {
  const organization = useAuthStore((s) => s.organization);
  const timezone = organization?.timezone ?? 'America/Los_Angeles';
  const qc = useQueryClient();

  const [currentWeek, setCurrentWeek] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDefaultDate, setModalDefaultDate] = useState<Date>(new Date());
  const [modalDefaultProfileId, setModalDefaultProfileId] = useState<string | undefined>(undefined);
  const [editShift, setEditShift] = useState<ShiftRow | undefined>(undefined);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekDays = getWeekDays(currentWeek, 0);

  const schedulesQuery = useSchedules();
  const schedules = schedulesQuery.data ?? [];

  // Auto-select first schedule when schedules load
  const activeScheduleId = selectedScheduleId ?? (schedules.length > 0 ? schedules[0].id : null);

  const shiftsQuery = useShifts(activeScheduleId, weekStart, weekEnd);
  const shifts = shiftsQuery.data ?? [];

  const employeesQuery = useEmployeesForSchedule(activeScheduleId);
  const employees = employeesQuery.data ?? [];

  const updateShift = useUpdateShift();

  // Build employee rates map
  const employeeRates = useMemo(
    () => Object.fromEntries(employees.map(({ profile }) => [profile.id, profile.hourly_rate])),
    [employees],
  );

  const handleWeekChange = useCallback((date: Date) => {
    setCurrentWeek(startOfWeek(date, { weekStartsOn: 0 }));
  }, []);

  const handleScheduleChange = useCallback((id: string) => {
    setSelectedScheduleId(id);
  }, []);

  const handlePublish = useCallback(async () => {
    if (!activeScheduleId) return;
    setIsPublishing(true);
    setPublishError(null);
    try {
      await callFunction('publish-schedule', { schedule_id: activeScheduleId });
      qc.invalidateQueries({ queryKey: ['shifts'] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message
        : (err as { message?: string }).message ?? 'Failed to publish schedule.';
      setPublishError(msg);
    } finally {
      setIsPublishing(false);
    }
  }, [activeScheduleId, qc]);

  const handleCellClick = useCallback((profileId: string | null, date: Date) => {
    setModalDefaultDate(date);
    setModalDefaultProfileId(profileId ?? undefined);
    setEditShift(undefined);
    setModalOpen(true);
  }, []);

  const handleShiftClick = useCallback((shift: ShiftRow) => {
    setEditShift(shift);
    setModalDefaultDate(new Date(shift.start_time));
    setModalDefaultProfileId(shift.profile_id ?? undefined);
    setModalOpen(true);
  }, []);

  const handleShiftDrop = useCallback(
    async (shiftId: string, newProfileId: string | null, newDate: Date) => {
      const shift = shifts.find((s) => s.id === shiftId);
      if (!shift) return;

      // Compute duration of the original shift in minutes
      const origStart = new Date(shift.start_time);
      const origEnd = new Date(shift.end_time);
      const durationMs = origEnd.getTime() - origStart.getTime();

      // Build the new start in the org timezone using the target date's calendar date
      const targetDateStr = `${newDate.getUTCFullYear()}-${String(newDate.getUTCMonth() + 1).padStart(2, '0')}-${String(newDate.getUTCDate()).padStart(2, '0')}`;
      const origStartLocal = formatTz(origStart, 'HH:mm:ss', { timeZone: timezone });
      const newStartUtc = fromZonedTime(`${targetDateStr}T${origStartLocal}`, timezone);
      const newEndUtc = new Date(newStartUtc.getTime() + durationMs);

      try {
        await updateShift.mutateAsync({
          id: shiftId,
          profile_id: newProfileId,
          start_time: newStartUtc.toISOString(),
          end_time: newEndUtc.toISOString(),
        });
      } catch (_err) {
        // error handling could be added here
      }
    },
    [shifts, timezone, updateShift]
  );

  const isLoading = schedulesQuery.isLoading || shiftsQuery.isLoading || employeesQuery.isLoading;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border">
        <h1 className="text-lg font-semibold">Schedule Editor</h1>
      </div>

      <ScheduleToolbar
        schedules={schedules}
        selectedScheduleId={activeScheduleId}
        currentWeek={currentWeek}
        onScheduleChange={handleScheduleChange}
        onWeekChange={handleWeekChange}
        onPublish={handlePublish}
        isPublishing={isPublishing}
      />

      {publishError && (
        <div className="px-4 py-2 text-sm text-destructive bg-destructive/10 border-b border-destructive/20">
          {publishError}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-6 text-muted-foreground">Loading…</div>
        ) : schedules.length === 0 ? (
          <div className="p-6 text-muted-foreground">
            No schedules found. Create a schedule to get started.
          </div>
        ) : (
          <>
            <ScheduleGrid
              weekDays={weekDays}
              employees={employees}
              shifts={shifts}
              timezone={timezone}
              onCellClick={handleCellClick}
              onShiftClick={handleShiftClick}
              onShiftDrop={handleShiftDrop}
            />
            <ScheduleFooter
              weekDays={weekDays}
              shifts={shifts}
              timezone={timezone}
              employeeRates={employeeRates}
              defaultRate={null}
            />
          </>
        )}
      </div>

      {activeScheduleId && (
        <ShiftModal
          open={modalOpen}
          scheduleId={activeScheduleId}
          timezone={timezone}
          defaultDate={modalDefaultDate}
          defaultProfileId={modalDefaultProfileId}
          editShift={editShift}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

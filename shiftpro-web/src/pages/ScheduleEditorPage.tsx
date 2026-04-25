import { useState, useCallback, useMemo } from 'react';
import { startOfWeek, endOfWeek, format } from 'date-fns';
import { fromZonedTime, format as formatTz } from 'date-fns-tz';
import { callFunction } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useSchedules } from '@/hooks/useSchedules';
import { useShifts, useEmployeesForSchedule, useUpdateShift } from '@/hooks/useShifts';
import { useAllAvailability } from '@/hooks/useAvailability';
import { getWeekDays, employeeSortComparator, shiftDurationHours, type EmployeeSortMode } from '@/lib/scheduleUtils';
import { useQueryClient } from '@tanstack/react-query';
import { ScheduleToolbar } from '@/components/schedule/ScheduleToolbar';
import { ScheduleGrid } from '@/components/schedule/ScheduleGrid';
import { ScheduleFooter } from '@/components/schedule/ScheduleFooter';
import { ShiftModal } from '@/components/schedule/ShiftModal';
import { TemplateModal } from '@/components/schedule/TemplateModal';
import { AddEmployeeModal } from '@/components/schedule/AddEmployeeModal';
import { useCopyPreviousWeek } from '@/hooks/useScheduleTemplates';
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
  const [sortMode, setSortMode] = useState<EmployeeSortMode>('custom');
  const [showAvailability, setShowAvailability] = useState(false);
  const [showTimeOff, setShowTimeOff] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDefaultDate, setModalDefaultDate] = useState<Date>(new Date());
  const [modalDefaultProfileId, setModalDefaultProfileId] = useState<string | undefined>(undefined);
  const [editShift, setEditShift] = useState<ShiftRow | undefined>(undefined);

  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [addEmployeeModalOpen, setAddEmployeeModalOpen] = useState(false);
  const copyPreviousWeek = useCopyPreviousWeek();

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

  const { data: allAvailability = [] } = useAllAvailability();

  const sortedEmployees = useMemo(
    () => [...employees].sort(employeeSortComparator(sortMode)),
    [employees, sortMode],
  );

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

  async function handleCopyPreviousWeek() {
    if (!activeScheduleId) return;
    await copyPreviousWeek.mutateAsync({
      schedule_id: activeScheduleId,
      target_week_start: format(currentWeek, 'yyyy-MM-dd'),
    });
  }

  function handleExportCSV() {
    if (shifts.length === 0) return;
    const headers = ['Employee', 'Position', 'Date', 'Start', 'End', 'Hours'];
    const rows = shifts.map((s) => [
      s.profile ? `${s.profile.first_name} ${s.profile.last_name}` : 'Open Shift',
      s.position?.name ?? '',
      format(new Date(s.start_time), 'yyyy-MM-dd'),
      format(new Date(s.start_time), 'HH:mm'),
      format(new Date(s.end_time), 'HH:mm'),
      shiftDurationHours(new Date(s.start_time), new Date(s.end_time), s.break_minutes).toFixed(2),
    ]);
    const csv  = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `schedule-${format(currentWeek, 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleClearShifts() {
    if (!activeScheduleId) return;
    if (!window.confirm('Delete all DRAFT shifts this week? This cannot be undone.')) return;
    supabase
      .from('shifts')
      .delete()
      .eq('schedule_id', activeScheduleId)
      .eq('status', 'draft')
      .gte('start_time', weekStart.toISOString())
      .lt('start_time', weekEnd.toISOString())
      .then(() => qc.invalidateQueries({ queryKey: ['shifts'] }));
  }

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
        sortMode={sortMode}
        onSortChange={setSortMode}
        showAvailability={showAvailability}
        onToggleAvailability={() => setShowAvailability((v) => !v)}
        showTimeOff={showTimeOff}
        onToggleTimeOff={() => setShowTimeOff((v) => !v)}
        onOpenTemplates={() => setTemplateModalOpen(true)}
        onCopyPreviousWeek={handleCopyPreviousWeek}
        onExportCSV={handleExportCSV}
        onClearShifts={handleClearShifts}
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
              employees={sortedEmployees}
              shifts={shifts}
              timezone={timezone}
              onCellClick={handleCellClick}
              onShiftClick={handleShiftClick}
              onShiftDrop={handleShiftDrop}
              availability={allAvailability}
              showAvailability={showAvailability}
              onManageEmployees={() => setAddEmployeeModalOpen(true)}
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

      {activeScheduleId && (
        <AddEmployeeModal
          open={addEmployeeModalOpen}
          scheduleId={activeScheduleId}
          assignedProfileIds={employees.map((e) => e.profile.id)}
          onClose={() => setAddEmployeeModalOpen(false)}
        />
      )}

      {activeScheduleId && (
        <TemplateModal
          open={templateModalOpen}
          onClose={() => setTemplateModalOpen(false)}
          scheduleId={activeScheduleId}
          currentWeek={currentWeek}
        />
      )}
    </div>
  );
}

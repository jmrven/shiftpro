import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addDays, parseISO } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { useCreateShift, useUpdateShift, useDeleteShift } from '@/hooks/useShifts';
import type { ShiftRow } from '@/hooks/useShifts';

const schema = z.object({
  date:          z.string().min(1, 'Date is required'),
  start_time:    z.string().min(1, 'Start time is required'),
  end_time:      z.string().min(1, 'End time is required'),
  break_minutes: z.number().min(0).max(480),
  notes:         z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  scheduleId: string;
  timezone: string;
  defaultDate: Date;
  defaultProfileId?: string;
  editShift?: ShiftRow;
  onClose: () => void;
}

const inputCls = 'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring';

export function ShiftModal({
  open, scheduleId, timezone, defaultDate, defaultProfileId, editShift, onClose,
}: Props) {
  const createShift = useCreateShift();
  const updateShift = useUpdateShift();
  const deleteShift = useDeleteShift();

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const {
    register, handleSubmit, reset, formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: format(toZonedTime(defaultDate, timezone), 'yyyy-MM-dd'),
      start_time: '09:00',
      end_time: '17:00',
      break_minutes: 30,
      notes: '',
    },
  });

  useEffect(() => {
    if (!open) { setConfirmDelete(false); return; }
    if (editShift) {
      const startLocal = toZonedTime(new Date(editShift.start_time), timezone);
      const endLocal   = toZonedTime(new Date(editShift.end_time), timezone);
      reset({
        date:          format(startLocal, 'yyyy-MM-dd'),
        start_time:    format(startLocal, 'HH:mm'),
        end_time:      format(endLocal,   'HH:mm'),
        break_minutes: editShift.break_minutes,
        notes:         editShift.notes ?? '',
      });
    } else {
      reset({
        date: format(toZonedTime(defaultDate, timezone), 'yyyy-MM-dd'),
        start_time: '09:00',
        end_time: '17:00',
        break_minutes: 30,
        notes: '',
      });
    }
  }, [open, editShift, defaultDate, timezone, reset]);

  async function onSubmit(values: FormValues) {
    setSubmitError(null);
    try {
      const startUtc = fromZonedTime(`${values.date}T${values.start_time}`, timezone).toISOString();
      // If end time is strictly before start time, it's an overnight shift (next day)
      const isOvernight = values.end_time < values.start_time;
      const endDateStr = isOvernight
        ? format(addDays(parseISO(values.date), 1), 'yyyy-MM-dd')
        : values.date;
      const endUtc = fromZonedTime(`${endDateStr}T${values.end_time}`, timezone).toISOString();

      if (new Date(endUtc) <= new Date(startUtc)) {
        setSubmitError('End time must be after start time');
        return;
      }

      if (editShift) {
        await updateShift.mutateAsync({
          id: editShift.id,
          start_time: startUtc,
          end_time: endUtc,
          break_minutes: values.break_minutes,
          notes: values.notes ?? null,
        });
      } else {
        await createShift.mutateAsync({
          schedule_id: scheduleId,
          profile_id: defaultProfileId ?? null,
          position_id: null,
          job_site_id: null,
          start_time: startUtc,
          end_time: endUtc,
          break_minutes: values.break_minutes,
          notes: values.notes || undefined,
        });
      }
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message
        : (err as { message?: string }).message ?? 'An unexpected error occurred.';
      setSubmitError(msg);
    }
  }

  async function handleDelete() {
    if (!editShift) return;
    setSubmitError(null);
    try {
      await deleteShift.mutateAsync(editShift.id);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message
        : (err as { message?: string }).message ?? 'An unexpected error occurred.';
      setSubmitError(msg);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold">
          {editShift ? 'Edit Shift' : 'Create Shift'}
        </h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="date" className="text-sm font-medium">Date</label>
            <input id="date" type="date" {...register('date')} className={inputCls} />
            {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="start_time" className="text-sm font-medium">Start Time</label>
              <input id="start_time" type="time" {...register('start_time')} className={inputCls} />
              {errors.start_time && (
                <p className="text-xs text-destructive">{errors.start_time.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <label htmlFor="end_time" className="text-sm font-medium">End Time</label>
              <input id="end_time" type="time" {...register('end_time')} className={inputCls} />
              {errors.end_time && (
                <p className="text-xs text-destructive">{errors.end_time.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="break_minutes" className="text-sm font-medium">Break (minutes)</label>
            <input
              id="break_minutes" type="number" min={0} max={480} step={5}
              {...register('break_minutes', { valueAsNumber: true })}
              className={inputCls}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="notes" className="text-sm font-medium">Notes (optional)</label>
            <input id="notes" type="text" {...register('notes')} className={inputCls} />
          </div>

          {submitError && (
            <p className="text-xs text-destructive">{submitError}</p>
          )}

          <div className="flex items-center justify-between gap-2 pt-2">
            {editShift && (
              confirmDelete ? (
                <div className="flex gap-2 items-center">
                  <span className="text-xs text-destructive">Confirm delete?</span>
                  <button type="button" onClick={handleDelete} disabled={deleteShift.isPending || isSubmitting}
                    className="text-xs px-2 py-1 rounded bg-destructive text-destructive-foreground">
                    Yes, delete
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(false)}
                    className="text-xs px-2 py-1 rounded border">
                    Cancel
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(true)}
                  className="text-xs px-2 py-1 rounded border border-destructive text-destructive">
                  Delete
                </button>
              )
            )}
            <div className="flex gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {isSubmitting ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

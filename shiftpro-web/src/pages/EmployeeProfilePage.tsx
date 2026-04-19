import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useUpdateEmployee } from '@/hooks/useEmployees';
import { useAuthStore } from '@/stores/authStore';
import type { Database } from '@/types/database';

type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export const profileSchema = z.object({
  first_name: z.string().min(1, 'Required'),
  last_name: z.string().min(1, 'Required'),
  phone: z.string().optional().or(z.literal('')),
  hire_date: z.string().optional().or(z.literal('')),
  hourly_rate: z.coerce.number().min(0).optional().or(z.literal('')),
  employee_number: z.string().optional().or(z.literal('')),
  role: z.enum(['admin', 'manager', 'employee']).optional(),
  status: z.enum(['active', 'inactive', 'invited']).optional(),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

export function EmployeeProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { role: viewerRole, user } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const updateEmployee = useUpdateEmployee();

  useEffect(() => {
    setSaveSuccess(false);
    setSaveError(null);
    setIsEditing(false);
  }, [id]);

  const { data: employee, isLoading } = useQuery({
    queryKey: ['employee', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, profile_positions(position_id, positions(id, name, color))')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    values: employee
      ? {
          first_name: employee.first_name,
          last_name: employee.last_name,
          phone: employee.phone ?? '',
          hire_date: employee.hire_date ?? '',
          hourly_rate: employee.hourly_rate ?? '',
          employee_number: employee.employee_number ?? '',
          role: employee.role,
          status: employee.status,
        }
      : undefined,
  });

  const isAdmin = viewerRole === 'admin';
  const isAdminOrManager = viewerRole === 'admin' || viewerRole === 'manager';
  const isSelf = user?.id === id;
  const canEdit = isAdminOrManager || isSelf;

  async function onSubmit(values: ProfileFormValues) {
    if (!id) return;
    setSaveError(null);
    setSaveSuccess(false);

    const base: ProfileUpdate = { phone: values.phone || null };
    const adminManagerUpdates: ProfileUpdate = isAdminOrManager ? {
      first_name: values.first_name,
      last_name: values.last_name,
      hire_date: values.hire_date || null,
      employee_number: values.employee_number || null,
    } : {};
    const adminUpdates: ProfileUpdate = isAdmin ? {
      hourly_rate: values.hourly_rate === '' || values.hourly_rate === undefined ? null : Number(values.hourly_rate),
      ...(values.role ? { role: values.role } : {}),
      ...(values.status ? { status: values.status } : {}),
    } : {};
    const updates: ProfileUpdate = { ...base, ...adminManagerUpdates, ...adminUpdates };

    try {
      await updateEmployee.mutateAsync({ id, updates });
      setSaveSuccess(true);
      setIsEditing(false);
    } catch (err: unknown) {
      setSaveError((err as { message?: string }).message ?? 'Save failed.');
    }
  }

  function handleCancel() {
    reset();
    setSaveError(null);
    setIsEditing(false);
  }

  if (isLoading) return <p className="text-muted-foreground text-sm">Loading…</p>;
  if (!employee) return <p className="text-destructive text-sm">Employee not found.</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/employees" className="text-sm text-muted-foreground hover:text-foreground">
          ← Employees
        </Link>
      </div>

      {saveSuccess && (
        <div className="rounded-md bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-800">
          Profile saved.
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
              {employee.first_name[0]}
              {employee.last_name[0]}
            </div>
            <div>
              <h1 className="text-xl font-bold">
                {employee.first_name} {employee.last_name}
              </h1>
              <p className="text-sm text-muted-foreground capitalize">
                {employee.role} · {employee.status}
              </p>
            </div>
          </div>
          {canEdit && !isEditing && (
            <button
              onClick={() => { setSaveSuccess(false); setIsEditing(true); }}
              className="text-sm font-medium text-primary hover:underline"
            >
              Edit
            </button>
          )}
        </div>

        {/* View mode */}
        {!isEditing && (
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
            {[
              ['Email', employee.email],
              ['Phone', employee.phone ?? '—'],
              ['Employee #', employee.employee_number ?? '—'],
              [
                'Hire date',
                employee.hire_date
                  ? format(parseISO(employee.hire_date), 'MMM d, yyyy')
                  : '—',
              ],
              ['Hourly rate', employee.hourly_rate ? `$${employee.hourly_rate}/hr` : '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-medium mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Edit form */}
        {isEditing && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2 border-t border-border">
            <div className="grid grid-cols-2 gap-4">
              {/* first_name — admin/manager only */}
              {isAdminOrManager && (
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">
                    First name <span className="text-destructive">*</span>
                  </label>
                  <input
                    {...register('first_name')}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  {errors.first_name && (
                    <p className="text-xs text-destructive mt-0.5">{errors.first_name.message}</p>
                  )}
                </div>
              )}

              {/* last_name — admin/manager only */}
              {isAdminOrManager && (
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">
                    Last name <span className="text-destructive">*</span>
                  </label>
                  <input
                    {...register('last_name')}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  {errors.last_name && (
                    <p className="text-xs text-destructive mt-0.5">{errors.last_name.message}</p>
                  )}
                </div>
              )}

              {/* phone — all users who can edit */}
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Phone</label>
                <input
                  {...register('phone')}
                  type="tel"
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* employee_number — admin/manager only */}
              {isAdminOrManager && (
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Employee #</label>
                  <input
                    {...register('employee_number')}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              )}

              {/* hire_date — admin/manager only */}
              {isAdminOrManager && (
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Hire date</label>
                  <input
                    {...register('hire_date')}
                    type="date"
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              )}

              {/* admin-only fields */}
              {isAdmin && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      Hourly rate ($)
                    </label>
                    <input
                      {...register('hourly_rate')}
                      type="number"
                      step="0.01"
                      min="0"
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    {errors.hourly_rate && (
                      <p className="text-xs text-destructive mt-0.5">
                        {errors.hourly_rate.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Role</label>
                    <select
                      {...register('role')}
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="employee">Employee</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Status</label>
                    <select
                      {...register('status')}
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="invited">Invited</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            {saveError && (
              <p className="text-sm text-destructive">{saveError}</p>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-md border border-border px-4 py-1.5 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useInviteEmployee } from '@/hooks/useEmployees';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

const schema = z.object({
  first_name: z.string().min(1, 'Required'),
  last_name: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
  role: z.enum(['manager', 'employee']),
  position_ids: z.array(z.string()).optional(),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
}

export function InviteModal({ open, onClose }: Props) {
  const { organizationId } = useAuthStore();
  const invite = useInviteEmployee();
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: positions } = useQuery({
    queryKey: ['positions', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('positions')
        .select('id, name, color')
        .eq('organization_id', organizationId!)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId && open,
  });

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'employee', position_ids: [] },
  });

  const selectedPositions = watch('position_ids') ?? [];

  function togglePosition(id: string) {
    const next = selectedPositions.includes(id)
      ? selectedPositions.filter((p) => p !== id)
      : [...selectedPositions, id];
    setValue('position_ids', next);
  }

  async function onSubmit(values: FormValues) {
    setServerError(null);
    try {
      await invite.mutateAsync(values);
      reset();
      onClose();
    } catch (err: unknown) {
      let msg = (err as { message?: string }).message ?? 'Something went wrong';
      try {
        const body = await (err as { context?: Response }).context?.json();
        if (body?.error?.message) msg = body.error.message;
      } catch { /* not JSON */ }
      setServerError(msg);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold">Invite employee</h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {(['first_name', 'last_name'] as const).map((field) => (
              <div key={field} className="space-y-1">
                <label className="text-sm font-medium">{field === 'first_name' ? 'First name' : 'Last name'}</label>
                <input
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  {...register(field)}
                />
                {errors[field] && <p className="text-xs text-destructive">{errors[field]?.message}</p>}
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              {...register('email')}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Role</label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              {...register('role')}
            >
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
            </select>
          </div>

          {positions && positions.length > 0 && (
            <div className="space-y-1">
              <label className="text-sm font-medium">Positions (optional)</label>
              <div className="flex flex-wrap gap-2">
                {positions.map((pos) => (
                  <button
                    key={pos.id}
                    type="button"
                    onClick={() => togglePosition(pos.id)}
                    className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                      selectedPositions.includes(pos.id)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border hover:bg-accent'
                    }`}
                  >
                    {pos.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {serverError && <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{serverError}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={invite.isPending}
              className="flex-1 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity">
              {invite.isPending ? 'Sending…' : 'Send invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

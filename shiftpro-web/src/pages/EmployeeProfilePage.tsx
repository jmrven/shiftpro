import { z } from 'zod';

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

import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';

export function EmployeeProfilePage() {
  const { id } = useParams<{ id: string }>();

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

  if (isLoading) return <p className="text-muted-foreground text-sm">Loading…</p>;
  if (!employee) return <p className="text-destructive text-sm">Employee not found.</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/employees" className="text-sm text-muted-foreground hover:text-foreground">← Employees</Link>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
            {employee.first_name[0]}{employee.last_name[0]}
          </div>
          <div>
            <h1 className="text-xl font-bold">{employee.first_name} {employee.last_name}</h1>
            <p className="text-sm text-muted-foreground capitalize">{employee.role} · {employee.status}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
          {[
            ['Email', employee.email],
            ['Phone', employee.phone ?? '—'],
            ['Employee #', employee.employee_number ?? '—'],
            ['Hire date', employee.hire_date ? format(new Date(employee.hire_date), 'MMM d, yyyy') : '—'],
            ['Hourly rate', employee.hourly_rate ? `$${employee.hourly_rate}/hr` : '—'],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-sm font-medium mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

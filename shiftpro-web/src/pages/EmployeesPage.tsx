import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useEmployees } from '@/hooks/useEmployees';
import { InviteModal } from '@/components/employees/InviteModal';
import { cn } from '@/lib/cn';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  invited: 'bg-yellow-100 text-yellow-800',
  inactive: 'bg-gray-100 text-gray-600',
};

export function EmployeesPage() {
  const { data: employees, isLoading } = useEmployees();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = employees?.filter((e) =>
    `${e.first_name} ${e.last_name} ${e.email}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Employees</h1>
        <button
          onClick={() => setInviteOpen(true)}
          className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          + Invite employee
        </button>
      </div>

      <input
        type="search"
        placeholder="Search by name or email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />

      {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}

      {!isLoading && (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {['Name', 'Email', 'Role', 'Status', 'Positions', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered?.map((emp) => (
                <tr key={emp.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{emp.first_name} {emp.last_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{emp.email}</td>
                  <td className="px-4 py-3 capitalize">{emp.role}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[emp.status])}>
                      {emp.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {(emp.profile_positions as { positions: { name: string } }[])
                      ?.map((pp) => pp.positions?.name).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/employees/${emp.id}`} className="text-primary hover:underline text-xs">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    {search ? 'No employees match your search' : 'No employees yet — invite your first one'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}

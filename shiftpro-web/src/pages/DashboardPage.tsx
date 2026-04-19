export function DashboardPage() {

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-muted-foreground">
        Welcome back. Scheduling, attendance, and time-off widgets will appear here.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {['Who\'s Working', 'Pending Approvals', 'Upcoming Shifts'].map((title) => (
          <div key={title} className="rounded-lg border border-border bg-card p-4">
            <h3 className="font-medium text-sm text-muted-foreground">{title}</h3>
            <p className="mt-2 text-2xl font-bold">—</p>
          </div>
        ))}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Calendar, ChevronDown } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/cn';
import type { UserRole } from '@/types/ui';

interface NavItem {
  label: string;
  href: string;
  icon: string;
  roles: UserRole[];
}

const NAV: NavItem[] = [
  { label: 'Dashboard',  href: '/',           icon: '⊞', roles: ['admin','manager','employee'] },
  { label: 'Attendance', href: '/attendance',  icon: '⏱',  roles: ['admin','manager','employee'] },
  { label: 'Time Off',   href: '/time-off',    icon: '🏖',  roles: ['admin','manager','employee'] },
  { label: 'Employees',  href: '/employees',   icon: '👥', roles: ['admin','manager'] },
  { label: 'Messages',   href: '/messages',    icon: '💬', roles: ['admin','manager','employee'] },
  { label: 'Reports',    href: '/reports',     icon: '📊', roles: ['admin','manager'] },
  { label: 'Settings',   href: '/settings',    icon: '⚙️',  roles: ['admin'] },
];

export function Sidebar() {
  const { role } = useAuthStore();
  const location = useLocation();
  const [scheduleOpen, setScheduleOpen] = useState(location.pathname.startsWith('/schedule'));

  const visible = NAV.filter((item) => role && item.roles.includes(role));

  return (
    <aside className="w-56 flex-shrink-0 border-r border-border bg-card flex flex-col">
      <div className="px-4 py-5 border-b border-border">
        <span className="font-bold text-lg tracking-tight">ShiftPro</span>
      </div>

      <nav className="flex-1 py-3 space-y-0.5 px-2 overflow-y-auto">
        {/* Dashboard always first */}
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )
          }
        >
          <span aria-hidden="true">⊞</span>
          Dashboard
        </NavLink>

        {/* Expandable Schedule section — visible to all roles */}
        <div>
          <button
            onClick={() => setScheduleOpen((o) => !o)}
            className={cn(
              'w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors',
              location.pathname.startsWith('/schedule')
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Schedule
            </span>
            <ChevronDown className={cn('h-4 w-4 transition-transform', scheduleOpen && 'rotate-180')} />
          </button>
          {scheduleOpen && (
            <div className="ml-6 mt-1 space-y-1">
              {[
                { to: '/schedule',              label: 'Schedule Editor' },
                { to: '/schedule/team',         label: 'Team Schedule' },
                { to: '/schedule/my',           label: 'My Schedule' },
                { to: '/schedule/availability', label: 'Availability' },
                { to: '/schedule/requests',     label: 'Requests' },
              ].map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end
                  className={({ isActive }) =>
                    cn(
                      'block px-3 py-1.5 rounded-md text-sm transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )
                  }
                >
                  {label}
                </NavLink>
              ))}
            </div>
          )}
        </div>

        {/* Remaining nav items filtered by role */}
        {visible.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.href === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )
            }
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

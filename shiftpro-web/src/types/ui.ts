export type UserRole = 'admin' | 'manager' | 'employee';

export type EmployeeStatus = 'active' | 'inactive' | 'invited';

export type ShiftStatus = 'draft' | 'published' | 'cancelled';

export type TimesheetStatus = 'pending' | 'approved' | 'rejected';

export type TimeOffStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export type ClockAction = 'clock_in' | 'clock_out' | 'break_start' | 'break_end';

export type ReportType =
  | 'labor_cost'
  | 'schedule_vs_actual'
  | 'attendance'
  | 'timeoff_usage'
  | 'overtime'
  | 'task_completion'
  | 'policy_acknowledgment'
  | 'employee_hours'
  | 'location_summary'
  | 'position_coverage';

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  roles: UserRole[];
}

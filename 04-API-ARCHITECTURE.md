# ShiftPro — API Architecture

## 1. API Strategy

ShiftPro uses a hybrid API approach:

1. **Supabase Auto-generated REST API (PostgREST)** — For standard CRUD operations. The frontend calls Supabase directly using the `@supabase/supabase-js` client. Row-Level Security (RLS) enforces authorization at the database level. This covers ~70% of API needs with zero backend code.

2. **Supabase Edge Functions (Deno/TypeScript)** — For business logic that goes beyond simple CRUD: multi-step transactions, complex validations, notification dispatch, scheduled jobs, and external integrations. These are serverless functions deployed alongside Supabase.

3. **Supabase Realtime** — For WebSocket-based live updates: messaging, presence, schedule change notifications, and dashboard widgets.

## 2. Authentication Flow

### 2.1 Sign Up (Admin creates organization)

```
POST /auth/v1/signup
Body: { email, password, data: { first_name, last_name } }

→ Edge Function: create-organization
  1. Creates organization row
  2. Updates profile with organization_id, role='admin'
  3. Creates default settings (business hours, break rules, etc.)
  4. Returns organization details
```

### 2.2 Employee Invite

```
Edge Function: invite-employee
Auth: Admin only

Input: { email, first_name, last_name, role, schedule_ids, position_ids, pay_rates }

1. Creates auth.users entry via Supabase Admin API (with temp password or magic link)
2. Profile trigger creates profile row
3. Creates employee_schedules, employee_positions entries
4. Sends invite email with login link
```

### 2.3 Login

```
POST /auth/v1/token?grant_type=password
Body: { email, password }

→ Returns: { access_token, refresh_token, user }
```

### 2.4 Session Management

- Access tokens are JWTs valid for 1 hour
- Refresh tokens auto-rotate
- The Supabase JS client handles token refresh automatically
- User's `organization_id` and `role` are embedded in the JWT via a custom claim (set via database function on login)

### 2.5 Custom JWT Claims

```sql
CREATE OR REPLACE FUNCTION custom_access_token_hook(event JSONB)
RETURNS JSONB AS $$
DECLARE
    claims JSONB;
    user_org_id UUID;
    user_role TEXT;
BEGIN
    SELECT organization_id, role INTO user_org_id, user_role
    FROM profiles WHERE id = (event->>'user_id')::UUID;

    claims := event->'claims';
    claims := jsonb_set(claims, '{organization_id}', to_jsonb(user_org_id));
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));

    event := jsonb_set(event, '{claims}', claims);
    RETURN event;
END;
$$ LANGUAGE plpgsql;
```

## 3. Direct Supabase Client Operations (PostgREST)

These operations are handled entirely by the frontend calling Supabase directly, with RLS enforcing permissions.

### 3.1 Employee Management

| Operation | Method | Table | Notes |
|-----------|--------|-------|-------|
| List employees | SELECT | `profiles` | Filter by org, status, schedule, position. Paginated. |
| Get employee | SELECT | `profiles` | Join with employee_schedules, employee_positions, employee_skills |
| Update own profile | UPDATE | `profiles` | RLS: only own row |
| List schedules | SELECT | `schedules` | Filter by org |
| List positions | SELECT | `positions` | Filter by org |
| List skills | SELECT | `skills` | Filter by org |

### 3.2 Schedule Viewing

| Operation | Method | Table | Notes |
|-----------|--------|-------|-------|
| Get shifts for date range | SELECT | `shifts` | Filter by schedule_id, date range. Join position, profile. |
| Get my shifts | SELECT | `shifts` | Filter by profile_id = auth.uid() |
| Get open shifts | SELECT | `shifts` | Filter by is_open_shift = true, schedule_id |
| Get availability | SELECT | `employee_availability` | Filter by schedule (via employee_schedules join) |
| Get shift requests | SELECT | `shift_requests` | Filter by org, status, type |

### 3.3 Time Off Viewing

| Operation | Method | Table | Notes |
|-----------|--------|-------|-------|
| List time-off requests | SELECT | `timeoff_requests` | Filter by org, status, date range, employee |
| Get my balances | SELECT | `timeoff_balances` | Filter by profile_id = auth.uid() |
| Get all balances | SELECT | `timeoff_balances` | Manager/Admin only via RLS |

### 3.4 Timesheets Viewing

| Operation | Method | Table | Notes |
|-----------|--------|-------|-------|
| List timesheets | SELECT | `timesheets` | Filter by org, date range, status, employee |
| Get my timesheets | SELECT | `timesheets` | Filter by profile_id = auth.uid() |

### 3.5 Messaging

| Operation | Method | Table | Notes |
|-----------|--------|-------|-------|
| List my conversations | SELECT | `conversation_members` + `conversations` | Filter by profile_id. Order by last message time. |
| Get messages | SELECT | `messages` | Filter by conversation_id. Paginated, DESC by created_at. |
| Send message | INSERT | `messages` | RLS: must be member of conversation |
| Update last_read_at | UPDATE | `conversation_members` | Own row only |

### 3.6 Tasks

| Operation | Method | Table | Notes |
|-----------|--------|-------|-------|
| Get my tasks for today | SELECT | `task_instances` + `task_instance_items` | Filter by assigned_to or position match |
| Complete task item | UPDATE | `task_instance_items` | Set status, completed_at, completed_by |

### 3.7 Notifications

| Operation | Method | Table | Notes |
|-----------|--------|-------|-------|
| Get my notifications | SELECT | `notifications` | Filter by recipient_id = auth.uid(). Paginated. |
| Mark as read | UPDATE | `notifications` | Set is_read, read_at |
| Mark all as read | UPDATE | `notifications` | Batch update |

### 3.8 Settings (Admin only, via RLS)

All settings tables (organizations, schedules, positions, job_sites, skills, break_rules, pay_rules, timeoff_types, timeoff_policies, blocked_days, public_holidays, business_hours) support direct CRUD via PostgREST with admin-only RLS policies.

## 4. Edge Functions (Business Logic)

These functions handle operations that require multi-step logic, validations, or side effects.

### 4.1 Organization & Auth

#### `POST /functions/v1/create-organization`
Creates a new organization and configures the creator as admin.

```typescript
// Input
{ name: string, timezone: string }

// Logic
1. Create organization row
2. Update caller's profile: set organization_id, role = 'admin'
3. Create default business_hours (7 days)
4. Create default timeoff_types (Vacation, Sick, Unpaid)
5. Create default break_rules
6. Return organization object

// Output
{ organization: Organization }
```

#### `POST /functions/v1/invite-employee`
Invites a new employee to the organization.

```typescript
// Input
{
  email: string,
  first_name: string,
  last_name: string,
  role: 'manager' | 'employee',
  phone?: string,
  hire_date?: string,
  schedule_ids: string[],
  position_ids: string[],
  pay_rates?: { position_id: string, rate: number }[],
  skill_ids?: string[]
}

// Logic
1. Validate caller is admin
2. Check email uniqueness within org
3. Create auth.users via admin API (generates invite link)
4. Profile auto-created via trigger
5. Create employee_schedules entries
6. Create employee_positions entries (with pay rates)
7. Create employee_skills entries
8. Send invite email
9. Create audit log entry

// Output
{ profile: Profile, invite_url: string }
```

#### `POST /functions/v1/bulk-import-employees`
CSV import of multiple employees.

```typescript
// Input
{ csv_data: string }  // Or file upload

// Logic
1. Parse CSV
2. Validate all rows (email uniqueness, required fields)
3. Return validation errors if any
4. If valid: batch-create users and profiles
5. Create audit log

// Output
{ imported: number, errors: { row: number, message: string }[] }
```

### 4.2 Scheduling

#### `POST /functions/v1/publish-schedule`
Publishes draft shifts, notifying affected employees.

```typescript
// Input
{ schedule_id: string, start_date: string, end_date: string }

// Logic
1. Validate caller is manager of this schedule or admin
2. Find all draft shifts in the date range for this schedule
3. Update shifts: status = 'published', published_at = NOW()
4. Identify affected employees
5. Create notification for each affected employee
6. Broadcast via Realtime
7. Create audit log

// Output
{ published_count: number, notified_employees: number }
```

#### `POST /functions/v1/create-shift`
Creates a new shift with conflict detection.

```typescript
// Input
{
  schedule_id: string,
  profile_id?: string,  // null for open shift
  position_id: string,
  job_site_id?: string,
  start_time: string,  // ISO datetime
  end_time: string,
  break_minutes?: number,
  notes?: string,
  is_open_shift?: boolean
}

// Logic
1. Validate caller permissions
2. If profile_id set: check for overlapping shifts (warn, don't block)
3. Validate position exists and employee has that position
4. Create shift
5. Return shift with conflict warnings if any

// Output
{ shift: Shift, conflicts: Conflict[] }
```

#### `POST /functions/v1/copy-previous-week`
Copies all shifts from the previous week to the target week.

```typescript
// Input
{ schedule_id: string, target_week_start: string }

// Logic
1. Calculate previous week dates
2. Fetch all shifts from previous week for this schedule
3. Create new draft shifts offset by +7 days
4. Skip shifts for inactive employees
5. Return count

// Output
{ copied_count: number, skipped: string[] }
```

#### `POST /functions/v1/apply-template`
Applies a saved schedule template to a target week.

```typescript
// Input
{ template_id: string, target_week_start: string }

// Logic
1. Fetch template and template_shifts
2. For each template shift: create shift on the correct day of target week
3. Leave profile_id null (shifts are unassigned, by position only)

// Output
{ created_count: number }
```

#### `POST /functions/v1/auto-schedule` (v2)
Automatically assigns employees to open shifts based on availability, position, and rules.

```typescript
// Input
{ schedule_id: string, week_start: string, rules?: AutoScheduleRules }

// Logic
1. Get all open/unassigned shifts for the week
2. Get available employees (availability + no time off + no conflicts)
3. Score employees by: position match, hours balance, preferences
4. Assign employees to shifts greedily
5. Return proposed assignments (not saved until confirmed)

// Output
{ proposed_assignments: { shift_id: string, profile_id: string, score: number }[] }
```

### 4.3 Shift Requests

#### `POST /functions/v1/handle-shift-request`
Processes shift request actions (submit, approve, deny, cancel).

```typescript
// Input
{
  action: 'submit' | 'approve' | 'deny' | 'cancel',
  request_id?: string,  // For approve/deny/cancel
  // For submit:
  type?: 'swap' | 'offer' | 'drop' | 'open_shift',
  shift_id?: string,
  target_shift_id?: string,
  target_profile_id?: string,
  note?: string
}

// Logic (approve example for swap):
1. Validate approver is manager/admin of the schedule
2. Update request status = 'approved'
3. Swap the profile_ids on the two shifts
4. Notify both employees
5. Create audit log

// Logic (approve for drop):
1. Remove employee from shift (set profile_id = null, is_open_shift = true)
2. Notify employee

// Output
{ request: ShiftRequest }
```

### 4.4 Attendance

#### `POST /functions/v1/clock-action`
Handles clock-in, clock-out, break-start, break-end.

```typescript
// Input
{
  action: 'clock_in' | 'clock_out' | 'break_start' | 'break_end',
  latitude?: number,
  longitude?: number
}

// Logic (clock_in):
1. Check employee doesn't already have an active clock-in
2. Create clock_event
3. If GPS provided: check geofence against assigned job sites
4. If outside geofence: flag event, notify manager
5. Create/update timesheet entry for today
6. Broadcast "who's working" update via Realtime

// Logic (clock_out):
1. Find active clock-in event
2. Create clock_out event
3. Calculate total minutes (including breaks)
4. Update timesheet: clock_out time, total_minutes, break_minutes
5. Apply pay rules (regular vs overtime)
6. Broadcast update

// Output
{ event: ClockEvent, timesheet: Timesheet, geofence_warning?: string }
```

#### `POST /functions/v1/approve-timesheets`
Batch approve/reject timesheets.

```typescript
// Input
{ timesheet_ids: string[], action: 'approve' | 'reject', note?: string }

// Logic
1. Validate caller is manager/admin
2. Update status on all timesheets
3. Lock approved timesheets from further edits
4. Notify employees
5. Audit log

// Output
{ updated_count: number }
```

### 4.5 Time Off

#### `POST /functions/v1/request-timeoff`
Submits a time-off request with balance validation.

```typescript
// Input
{
  timeoff_type_id: string,
  start_date: string,
  start_time?: string,
  end_date: string,
  end_time?: string,
  note?: string
}

// Logic
1. Calculate total hours requested
2. Check balance (available >= requested + pending)
3. Check blocked days
4. Check minimum notice period
5. Check max consecutive days
6. Create timeoff_request
7. Update timeoff_balances.pending_hours
8. Notify manager(s) of the employee's schedule(s)
9. Audit log

// Output
{ request: TimeoffRequest } or { error: string, details: ValidationError[] }
```

#### `POST /functions/v1/handle-timeoff-request`
Approve, deny, or cancel a time-off request.

```typescript
// Input
{ request_id: string, action: 'approve' | 'deny' | 'cancel', note?: string }

// Logic (approve):
1. Update request status
2. Deduct from balance: used_hours += total_hours, pending_hours -= total_hours
3. Check for shift conflicts in the approved period
4. Flag conflicting shifts for manager attention
5. Notify employee
6. Audit log

// Logic (deny):
1. Update request status
2. Release pending hours back to available
3. Notify employee

// Output
{ request: TimeoffRequest, shift_conflicts?: Shift[] }
```

#### `POST /functions/v1/run-timeoff-accruals` (Scheduled / Cron)
Runs periodically to accrue time-off balances.

```typescript
// Logic
1. For each active employee_timeoff_policy:
2. Check if accrual is due (based on frequency and last_accrual_date)
3. If due: add accrual_amount to balance_hours (capped at max_balance)
4. Update last_accrual_date
5. Log accrual adjustments
```

### 4.6 Tasks & Policies

#### `POST /functions/v1/generate-task-instances` (Scheduled / Cron)
Generates daily task instances from recurring checklist templates.

```typescript
// Logic
1. For each active checklist_template with recurrence != 'none':
2. Check if instance already exists for today
3. If not: check recurrence schedule matches today
4. Create task_instance with items copied from template
5. Resolve assignment: specific person, or position-based (find who's on shift)
6. Notify assigned employees
```

#### `POST /functions/v1/create-ad-hoc-task`
Creates a one-time task assignment.

```typescript
// Input
{
  title: string,
  items: { title: string, description?: string }[],
  assigned_to?: string,  // profile_id
  assigned_to_position_id?: string,
  assigned_to_shift_id?: string,
  due_date: string
}

// Logic
1. Validate caller is manager/admin
2. Create task_instance and task_instance_items
3. Notify assignee
4. Audit log

// Output
{ task_instance: TaskInstance }
```

#### `POST /functions/v1/upload-policy-version`
Uploads a new version of a policy document.

```typescript
// Input (multipart)
{ policy_id?: string, title?: string, description?: string, file: File, changelog?: string }

// Logic
1. If no policy_id: create new policy
2. Upload file to Supabase Storage (policies bucket)
3. Determine version_number (max existing + 1, or 1 for new)
4. Create policy_versions row
5. Notify all active employees about new/updated policy
6. Audit log

// Output
{ policy: Policy, version: PolicyVersion }
```

### 4.7 Reports

#### `POST /functions/v1/generate-report`
Generates report data with complex aggregations.

```typescript
// Input
{
  report_type: 'scheduled_hours' | 'worked_hours' | 'scheduled_vs_actual' | 'attendance' | 'timeoff' | 'availability' | 'skill_expiry',
  schedule_ids?: string[],
  start_date: string,
  end_date: string,
  format?: 'json' | 'csv'
}

// Logic
- Runs report-specific SQL aggregation query
- For CSV: streams formatted output
- For JSON: returns structured data for frontend rendering

// Output
{ data: ReportRow[], summary: ReportSummary } or CSV file
```

### 4.8 Notifications

#### `POST /functions/v1/send-notification` (Internal helper, called by other functions)

```typescript
// Input
{
  recipient_ids: string[],
  title: string,
  body?: string,
  type: string,
  reference_type?: string,
  reference_id?: string
}

// Logic
1. Check each recipient's notification_preferences
2. Insert notification rows (for in-app)
3. Supabase Realtime broadcasts automatically via INSERT trigger
4. (Future: send email/SMS based on preferences)
```

## 5. Realtime Subscriptions

The frontend subscribes to these Supabase Realtime channels:

| Channel | Purpose | Filter |
|---------|---------|--------|
| `notifications:{user_id}` | New notifications for current user | `recipient_id = auth.uid()` |
| `messages:{conversation_id}` | New messages in open conversation | `conversation_id = X` |
| `shifts:{schedule_id}` | Shift changes (publish, edit, delete) | `schedule_id = X` |
| `clock_events:{org_id}` | Who's working updates | `organization_id = X` |
| `task_instances:{user_id}` | Task assignment/completion updates | `assigned_to = auth.uid()` |
| Presence: `org:{org_id}` | Online/offline/idle status for messaging | Supabase Presence API |

## 6. Scheduled Functions (Cron Jobs)

Deployed via Supabase's `pg_cron` extension or Railway cron:

| Job | Schedule | Function |
|-----|----------|----------|
| Time-off accruals | Daily at midnight (org timezone) | `run-timeoff-accruals` |
| Task instance generation | Daily at 6:00 AM (org timezone) | `generate-task-instances` |
| Auto clock-out | Every 30 minutes | Check for clock-ins > 16 hours old, auto clock-out |
| Skill expiry reminders | Weekly on Monday | Notify admins of skills expiring within 30 days |
| Stale notification cleanup | Weekly | Delete read notifications older than 90 days |

## 7. File Storage Buckets (Supabase Storage)

| Bucket | Access | Content |
|--------|--------|---------|
| `avatars` | Public (read), authenticated (write own) | Employee profile photos |
| `policies` | Authenticated (read), manager/admin (write) | Policy PDF/DOCX files |
| `exports` | Authenticated (read own), auto-delete after 24h | Generated CSV/PDF reports |
| `org-assets` | Public (read), admin (write) | Organization logos, branding |

## 8. Error Response Format

All Edge Functions return consistent error responses:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable error message",
    "details": [
      { "field": "email", "message": "Email already exists in this organization" }
    ]
  }
}
```

Error codes: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INTERNAL_ERROR`

HTTP status codes: 400, 401, 403, 404, 409, 500

## 9. Rate Limiting

- Supabase provides built-in rate limiting for Auth endpoints
- Edge Functions: implement per-user rate limiting via a Redis sidecar or simple in-memory counter (start simple)
- Clock actions: max 1 per 30 seconds per user (prevents accidental double-taps)
- Message sending: max 60 per minute per user
- Report generation: max 5 concurrent per organization

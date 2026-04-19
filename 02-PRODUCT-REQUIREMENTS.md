# ShiftPro — Product Requirements Document (PRD)

## 1. User Roles & Permissions

### 1.1 Role Definitions

| Role | Description | Scope |
|------|-------------|-------|
| **Admin** | Organization owner or operations lead. Full access to all features, settings, and data across all locations. Can create/deactivate users, manage billing, configure org settings. | Organization-wide |
| **Manager** | Location or schedule-level lead. Can create/edit schedules, approve requests, manage timesheets, assign tasks, and view reports for their assigned schedules/locations. | Assigned schedules/locations |
| **Employee** | Frontline staff. Can view their schedule, clock in/out, request time off, swap/offer/drop shifts, complete tasks, read policies, and use messaging. | Own data + assigned schedule |

### 1.2 Permission Matrix

| Action | Admin | Manager | Employee |
|--------|-------|---------|----------|
| Create/edit employees | ✅ | ❌ | ❌ |
| Deactivate employees | ✅ | ❌ | ❌ |
| Edit own profile | ✅ | ✅ | ✅ |
| Create/edit schedules | ✅ | ✅ (assigned) | ❌ |
| Publish schedules | ✅ | ✅ (assigned) | ❌ |
| View team schedule | ✅ | ✅ (assigned) | ❌ |
| View own schedule | ✅ | ✅ | ✅ |
| Create shifts | ✅ | ✅ (assigned) | ❌ |
| Create open shifts | ✅ | ✅ (assigned) | ❌ |
| Request swap/offer/drop | ✅ | ✅ | ✅ |
| Approve swap/offer/drop | ✅ | ✅ (assigned) | ❌ |
| Clock in/out | ✅ | ✅ | ✅ |
| Edit timesheets (others) | ✅ | ✅ (assigned) | ❌ |
| View own timesheets | ✅ | ✅ | ✅ |
| Approve timesheets | ✅ | ✅ (assigned) | ❌ |
| Request time off | ✅ | ✅ | ✅ |
| Approve time off | ✅ | ✅ (assigned) | ❌ |
| View time-off balances (all) | ✅ | ✅ (assigned) | ❌ |
| View own time-off balance | ✅ | ✅ | ✅ |
| View reports | ✅ | ✅ (assigned) | ❌ |
| Send messages | ✅ | ✅ | ✅ |
| Create channels | ✅ | ✅ | ❌ |
| Create task checklists | ✅ | ✅ | ❌ |
| Complete tasks | ✅ | ✅ | ✅ |
| Upload policies | ✅ | ✅ | ❌ |
| Acknowledge policies | ✅ | ✅ | ✅ |
| Manage settings | ✅ | ❌ | ❌ |
| Manage positions/job sites | ✅ | ❌ | ❌ |
| Manage pay rules | ✅ | ❌ | ❌ |

---

## 2. Module 1 — Employee Management

### 2.1 Feature Description
Admins can create employee profiles, assign them to schedules and positions, manage their employment status, and set pay rates. Employees can edit parts of their own profile (contact info, avatar, availability preferences).

### 2.2 User Stories

- **As an Admin**, I want to add a new employee with their name, email, phone, position(s), schedule(s), skills, pay rate, and start date so that they appear on the schedule and can log in.
- **As an Admin**, I want to deactivate an employee so they no longer appear on active schedules but their historical data is preserved.
- **As an Admin**, I want to bulk-import employees from a CSV file to speed up onboarding.
- **As an Admin**, I want to filter the employee list by schedule, position, status (active/inactive), and skills.
- **As an Admin**, I want to search employees by name or email.
- **As an Employee**, I want to edit my contact information, avatar, and notification preferences.
- **As an Employee**, I want to set my availability preferences (days/times I can or cannot work).
- **As a Manager**, I want to view employee profiles for staff in my assigned schedules.

### 2.3 Data Requirements

**Employee Profile Fields:**
- First name (required)
- Last name (required)
- Email (required, unique per org, used for login)
- Phone number (optional)
- Avatar/photo (optional, stored in Supabase Storage)
- Employee ID / external ID (optional, for payroll integration)
- Hire date
- Hourly pay rate (can have multiple rates per position)
- Status: active, inactive
- Assigned schedules (many-to-many)
- Assigned positions (many-to-many)
- Skills (many-to-many, with optional expiry date)
- Notification preferences (in-app toggle per event type)
- Availability preferences (recurring weekly pattern)

### 2.4 Acceptance Criteria

1. Employee creation sends an invite email with a link to set password and complete profile.
2. Deactivated employees are hidden from active views but remain in historical data, reports, and timesheets.
3. CSV import validates email uniqueness and required fields, and reports errors per row.
4. Employee list supports pagination (50 per page), sorting (first name, last name, custom), and filtering.
5. Profile photo uploads are resized to max 512x512 and stored in Supabase Storage.

---

## 3. Module 2 — Staff Scheduling

### 3.1 Feature Description
The scheduling module is the heart of the application. It provides a visual calendar interface where managers create and manage shifts for employees across multiple locations/schedules. It supports multiple views, templates, auto-scheduling, and various request workflows.

### 3.2 Schedule Structure

- **Organization** has many **Schedules** (e.g., "Central", "SoDo", "Ballard").
- Each **Schedule** represents a location or team.
- Each Schedule has **Shifts** assigned to employees or left as **Open Shifts**.
- Shifts have: start time, end time, position, job site (optional), break duration, notes.

### 3.3 User Stories — Schedule Editor

- **As a Manager**, I want to view the schedule in Employee View (rows = employees, columns = days) so I can see everyone's weekly assignments at a glance.
- **As a Manager**, I want to switch between Day, Week, 2-Week, and Month views.
- **As a Manager**, I want to filter the schedule by position and job site.
- **As a Manager**, I want to create a shift by clicking on an empty cell, selecting the position, start/end time, and break duration.
- **As a Manager**, I want to drag-and-drop shifts between employees and between days.
- **As a Manager**, I want to copy a shift to create duplicates across multiple days.
- **As a Manager**, I want to see the total scheduled hours and estimated labor cost per employee per week and per day (footer row).
- **As a Manager**, I want to create Open Shifts (unassigned) that employees can claim.
- **As a Manager**, I want to publish the schedule so employees are notified and can see their shifts.
- **As a Manager**, I want to unpublish shifts to make changes before re-publishing.
- **As a Manager**, I want to overlay time-off requests on the schedule to avoid conflicts.
- **As a Manager**, I want to overlay employee availability preferences on the schedule.
- **As a Manager**, I want to sort employees by first name, last name, or a custom drag order.

### 3.4 User Stories — Templates & Tools

- **As a Manager**, I want to save the current week as a template so I can reapply it to future weeks.
- **As a Manager**, I want to apply a saved template to a week.
- **As a Manager**, I want to copy the previous week's schedule to the current week.
- **As a Manager**, I want to clear all shifts for a week to start fresh.
- **As a Manager**, I want to auto-schedule shifts based on employee availability, positions, and configured rules (beta/v2 feature).
- **As a Manager**, I want to export the schedule to PDF or CSV.
- **As a Manager**, I want to print the schedule with configurable print settings.
- **As an Employee**, I want to sync my shifts to my personal calendar via iCal feed URL.

### 3.5 User Stories — Views

- **As an Employee**, I want to see "My Schedule" with only my assigned shifts for the upcoming weeks.
- **As a Manager**, I want to see "Team Schedule" — a read-only overview of who's working when across my schedules.
- **As a Manager**, I want to see "Availability" — a grid showing when each employee is available/unavailable.
- **As an Employee**, I want to set and update my recurring availability (days and time windows I can work each week).

### 3.6 User Stories — Shift Requests

- **As an Employee**, I want to request a **Swap** — propose trading my shift with another employee's shift. Both parties and a manager must approve.
- **As an Employee**, I want to **Offer** my shift — make it available for another qualified employee to pick up. Manager must approve the pickup.
- **As an Employee**, I want to request to **Drop** a shift — request removal from a shift. Manager must approve.
- **As an Employee**, I want to claim an **Open Shift** — request assignment to an unassigned shift. Manager may need to approve depending on settings.
- **As a Manager**, I want to see all pending requests (swaps, offers, drops, open shifts) in one place and approve/deny them.

### 3.7 Acceptance Criteria

1. Shift conflicts (overlapping times for same employee) are detected and shown as warnings.
2. Publishing a schedule sends in-app notifications to all affected employees.
3. Schedule changes after publication trigger change notifications.
4. Labor cost calculations use employee pay rates × scheduled hours.
5. The schedule editor is performant with 50+ employees rendered simultaneously.
6. Open shifts are only visible to employees with the matching position/skills.
7. iCal feed URLs are unique per employee and do not require authentication (security via obscurity + token).

---

## 4. Module 3 — Attendance / Timesheets

### 4.1 Feature Description
Employees clock in and out to record their actual work hours. Clock events are geo-tagged with GPS coordinates and validated against geofences. Managers review and approve timesheets. The system tracks breaks and calculates totals.

### 4.2 User Stories

- **As an Employee**, I want to clock in from the dashboard or a dedicated time-clock screen by tapping a button. My GPS location is captured automatically.
- **As an Employee**, I want to clock out, with GPS captured again.
- **As an Employee**, I want to start and end breaks during my shift.
- **As an Employee**, I want to see my current clock status (clocked in since X, on break since Y).
- **As an Employee**, I want to view "My Timesheets" — a list/summary of my time entries for a selected period.
- **As a Manager**, I want to see "All Timesheets" — time entries for all employees in my schedule(s), filterable by date range, status (pending/approved/rejected), and employee.
- **As a Manager**, I want to switch between List view (individual entries) and Summary view (totals per employee per period).
- **As a Manager**, I want to manually add a time entry for an employee who forgot to clock in/out.
- **As a Manager**, I want to edit a time entry to correct mistakes (with an audit trail).
- **As a Manager**, I want to approve or reject timesheets.
- **As an Admin**, I want to see who is currently clocked in ("Who's Working" dashboard widget).
- **As an Admin**, I want to see who was scheduled but hasn't clocked in ("No Show" widget).

### 4.3 Geofence Rules

- Each **Job Site** or **Schedule** can have a geofence defined as a center point (lat/lng) plus a radius in meters.
- When an employee clocks in, their GPS position is compared against the geofence.
- If outside the geofence: the clock-in is flagged but still recorded. Manager is notified.
- GPS coordinates are stored with every clock event for audit purposes.
- If GPS is unavailable (permission denied), the clock-in is allowed but flagged as "no location."

### 4.4 Acceptance Criteria

1. Clock-in/out captures GPS coordinates using the Browser Geolocation API with high accuracy mode.
2. Geofence check uses PostGIS `ST_DWithin` to compare point against configured radius.
3. All timesheet edits create an audit log entry with before/after values and the editor's identity.
4. Break time is subtracted from total hours automatically.
5. Timesheet approval locks the entry from further edits (unless unlocked by admin).
6. The "Who's Working" widget updates in real-time via Supabase Realtime subscriptions.

---

## 5. Module 4 — Time Off

### 5.1 Feature Description
Employees request time off based on configured policies. Managers approve or deny requests. The system tracks balances, supports multiple leave types, and respects blocked days and public holidays.

### 5.2 Time Off Types (Configurable)

Default types: Vacation, Sick, Unpaid. Admins can create custom types with configurable properties:
- Name and color
- Accrual rules: annual allotment, accrual frequency (per pay period, monthly, annually), carryover rules
- Requires approval: yes/no
- Counts as paid: yes/no
- Minimum notice period (days before start)
- Maximum consecutive days

### 5.3 User Stories

- **As an Employee**, I want to request time off by selecting the type, start date/time, end date/time, and adding an optional note.
- **As an Employee**, I want to see my current balances for each time-off type.
- **As an Employee**, I want to cancel a pending or approved future time-off request.
- **As a Manager**, I want to see all time-off requests in a list view (filterable by schedule, status, employee, date range) and a calendar view.
- **As a Manager**, I want to approve or deny a request with an optional note.
- **As a Manager**, I want to see the time-off calendar overlaid on the schedule editor to know who's off.
- **As an Admin**, I want to configure time-off policies: accrual rates, balance caps, carryover rules, blackout dates.
- **As an Admin**, I want to set "Blocked Days" where no time off can be requested (e.g., major holidays where all hands are needed).
- **As an Admin**, I want to manage Public Holidays that automatically apply as days off.
- **As an Admin**, I want to manually adjust an employee's time-off balance (with a note explaining why).

### 5.4 Request Statuses

`Pending` → `Approved` | `Denied` | `Canceled`

### 5.5 Acceptance Criteria

1. Requesting time off checks the employee's remaining balance and rejects if insufficient.
2. Requests for blocked days are rejected automatically with a message explaining why.
3. Approved time-off automatically removes the employee from any published shifts in that period (or flags conflicts for manager review).
4. Balance calculations account for accruals, usage, adjustments, and carryover.
5. The time-off list supports sorting by time-off date or submitted date.
6. Export to CSV is available.

---

## 6. Module 5 — Reports

### 6.1 Feature Description
Reports provide management with data-driven views into scheduling, attendance, time off, and system activity. All reports are filterable by date range and schedule, and exportable.

### 6.2 Report Types

| Report | Description |
|--------|-------------|
| **Scheduled Hours** | Hours scheduled per employee for a given period. Breakdown by day. Shows total hours and estimated labor cost. |
| **Worked Hours** | Actual clocked hours per employee. Breakdown by day. Shows regular, overtime, break, and total hours. |
| **Scheduled vs. Actual** | Compares scheduled hours against actual worked hours. Highlights variances (early/late clock-in, overtime, no-shows). |
| **Attendance** | Daily attendance summary: scheduled employees, who clocked in, who didn't (no-shows), late arrivals, early departures. |
| **Time Off** | Summary of time-off requests: by type, by employee, by status. Useful for PTO trend analysis. |
| **Employee Availability** | Grid showing each employee's weekly availability preferences. Helps with scheduling decisions. |
| **Skill Expiry** | Lists employees whose skills/certifications are expiring or have expired. Useful for compliance-heavy industries. |
| **Audit Logs** | System-wide log of who did what and when: logins, schedule changes, timesheet edits, setting changes. |
| **Schedule Audit** | History of changes to published schedules: who edited, what changed, when. |
| **Timesheet Audit** | History of timesheet modifications: original vs. edited values, editor identity. |

### 6.3 Acceptance Criteria

1. All reports are filterable by date range (presets: today, yesterday, this week, last week, this month, last month, custom range).
2. All reports are filterable by schedule(s).
3. Reports load within 3 seconds for up to 6 months of data.
4. Export to CSV is available for all reports.
5. Print-friendly layouts for all reports.
6. Scheduled Hours report shows labor cost using employee pay rates.

---

## 7. Module 6 — Messaging

### 7.1 Feature Description
A built-in real-time messaging system for team communication. Supports direct messages (1-to-1) and group chats. Presence indicators show who's online.

### 7.2 User Stories

- **As an Employee**, I want to send a direct message to any other employee in my organization.
- **As an Employee**, I want to participate in group chats.
- **As a Manager**, I want to create group chats and add/remove members.
- **As a User**, I want to see a list of recent chats sorted by last message time.
- **As a User**, I want to search contacts by name or email.
- **As a User**, I want to see presence status for contacts: Available, Idle, Offline.
- **As a User**, I want to see unread message counts per conversation.
- **As a User**, I want to receive in-app notifications for new messages.
- **As a User**, I want to search message history within a conversation.

### 7.3 Data Model Notes

- Messages are stored in Supabase with Realtime subscriptions for instant delivery.
- Presence is tracked via Supabase Realtime Presence (built-in feature).
- Group chats have a name (e.g., "#SoDo", "#Whole Team") and a member list.
- Messages support text content. File/image attachments can be added in v2.

### 7.4 Acceptance Criteria

1. Messages are delivered in real-time (under 1 second for online recipients).
2. Unread counts update in real-time.
3. Presence updates within 30 seconds of status change.
4. Chat history is paginated (load more on scroll up).
5. The messaging panel is accessible from any page (slide-out panel, similar to Zoho Shifts' chat widget).
6. Group chats support up to 200 members.

---

## 8. Module 7 — Tasks & Policies

> Full specification in `07-TASKS-POLICIES-SPEC.md`. Summary below.

### 8.1 Tasks / Checklists

Managers create checklist templates — named groups of tasks (e.g., "Opening Checklist", "Closing Checklist", "Deep Clean Protocol"). These templates can be:
- Assigned to specific employees
- Assigned to a position on a shift (so whoever is working that role sees the checklist)
- Set to recur daily, weekly, or on a custom schedule
- Created as one-time ad-hoc assignments

Employees see their assigned checklists for the day, check items off as completed, and managers can monitor completion in real-time.

### 8.2 Policies

Managers upload policy documents (PDF, DOCX) with a title and description. The system tracks:
- Version history (each upload creates a new version)
- Employee acknowledgment (each employee must read and acknowledge each policy version)
- Acknowledgment status across the team (who has/hasn't acknowledged)
- Notification on new policy or updated version

---

## 9. Module 8 — Settings

### 9.1 Settings Sections

| Section | Description |
|---------|-------------|
| **General** | Organization name, timezone, date/time format, business hours per day of week, account owner |
| **Schedules** | Create/edit schedule entities (locations/teams). Name, color, assigned managers. |
| **Positions** | Create/edit positions (roles). Name, color. Employees are assigned to positions. |
| **Job Sites** | Physical locations with address, lat/lng for geofencing, radius. |
| **Access Levels** | Configure what each role can see/do (for future custom role expansion). |
| **Skills** | Create skill/certification types. Assign to employees with optional expiry dates. |
| **Breaks** | Configure break rules: auto-deduct, paid/unpaid, duration, after X hours. |
| **Shift Templates** | Saved shift configurations (position + time range) for quick shift creation. |
| **Schedule Preferences** | Default view, week start day, overtime thresholds, scheduling rules. |
| **Time Off Preferences** | Approval requirements, notification settings, display options. |
| **Time Off Policies** | Accrual rules, balance caps, carryover, policy assignment to employees/positions. |
| **Blocked Days** | Dates when time off cannot be requested. |
| **Public Holidays** | Holiday calendar. Holidays can affect pay rules (e.g., holiday premium). |
| **Time Clock** | Geofence enforcement settings, GPS requirement, early clock-in buffer, auto clock-out rules. |
| **Pay Rules** | Overtime rules (daily/weekly thresholds), holiday pay multipliers, night differential. |
| **Messaging** | Channel defaults, notification preferences. |
| **Branding** | Organization logo, primary color, custom domain (v2). |
| **Data Backup** | Manual data export / backup download. |

### 9.2 Acceptance Criteria

1. All settings changes take effect immediately (no restart/redeploy needed).
2. Settings changes are logged in the audit trail.
3. Only Admin role can access Settings.
4. Timezone setting affects all date/time displays across the application.

---

## 10. Dashboard

### 10.1 Feature Description
The dashboard is the landing page after login. It provides a quick overview of today's status and pending actions.

### 10.2 Widgets

| Widget | Role | Description |
|--------|------|-------------|
| **Time Clock** | All | Shows current clock status. Clock In/Out button. Shows "No shift scheduled" or current shift info. |
| **Pending Approvals** | Manager, Admin | Tabs for: Time Off, Swap, Offer, Drop, Open Shift requests needing action. Count badges. |
| **My Upcoming Shifts** | All | List of next 7 days of shifts. Link to "My Schedule". |
| **My Recent Time Entries** | All | Last 7 days of clock-in/out records. |
| **Who's Working** | Manager, Admin | Real-time list of employees currently clocked in, with clock-in time and Clock Out button. |
| **No Show** | Manager, Admin | Employees who were scheduled but haven't clocked in. |
| **My Tasks** | All | Today's assigned checklists with completion progress. |

---

## 11. Notifications

### 11.1 Notification Events

| Event | Recipients | Channel |
|-------|-----------|---------|
| Schedule published | Affected employees | In-app |
| Shift assigned/changed | Affected employee | In-app |
| Shift request submitted (swap/offer/drop) | Manager | In-app |
| Shift request approved/denied | Requesting employee | In-app |
| Time-off request submitted | Manager | In-app |
| Time-off request approved/denied | Requesting employee | In-app |
| Open shift available | Eligible employees | In-app |
| New message | Recipient | In-app |
| Task assigned | Assigned employee | In-app |
| New/updated policy | All employees | In-app |
| Geofence violation on clock-in | Manager | In-app |
| Skill expiring soon | Admin, Employee | In-app |

### 11.2 Implementation

- Notifications are stored in a `notifications` table.
- Delivered in real-time via Supabase Realtime.
- Displayed as a notification bell with unread count in the top nav.
- Notification center: list of all notifications with read/unread state, clickable to navigate to relevant page.
- Users can configure notification preferences (per event type: on/off).

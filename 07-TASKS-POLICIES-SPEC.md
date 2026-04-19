# ShiftPro — Tasks & Policies Module Specification

> This is the novel feature that differentiates ShiftPro from Zoho Shifts. This document provides the deep-dive specification needed to build it from scratch.

## 1. Module Overview

The Tasks & Policies module solves two operational problems:

1. **Tasks / Checklists**: "What am I supposed to do during my shift?" — Managers define repeatable checklists of tasks (opening duties, closing duties, cleaning protocols) and assign them to shifts, positions, or individuals. Employees see their tasks for the day and mark them complete. Managers monitor completion.

2. **Policies**: "Where do I find the company handbook?" — Managers upload policy documents that employees must read and acknowledge. The system tracks which version each employee has acknowledged and notifies everyone when policies are updated.

---

## 2. Tasks / Checklists

### 2.1 Concepts

| Concept | Description |
|---------|-------------|
| **Checklist Template** | A reusable definition of a task group. Created by managers. Contains ordered items. Has recurrence settings and assignment rules. |
| **Template Item** | A single task within a template. Has a title, optional description, and sort order. |
| **Task Instance** | A concrete, dated occurrence of a checklist template (or an ad-hoc task). Created automatically by the recurrence engine or manually by a manager. |
| **Task Instance Item** | A concrete item within a task instance. Can be individually checked off by an employee. |

### 2.2 Checklist Template Management

#### Creating a Template

**Who**: Admin, Manager

**Fields**:
- **Name** (required): e.g., "Opening Checklist", "Deep Clean Protocol"
- **Description** (optional): Explains the purpose and any special instructions
- **Items** (at least 1 required):
  - Title (required): e.g., "Unlock front and back doors"
  - Description (optional): Additional detail or instructions
  - Drag to reorder (sort_order)
- **Assignment Rule** (one of):
  - **Specific Person**: Always assigned to a named employee
  - **Position**: Assigned to whoever is working this position on the day (resolved at instance generation time)
  - **Schedule + Position**: Further scoped to a specific schedule/location
  - **Unassigned**: Available for any team member to claim
- **Schedule Scope** (optional): Which schedule this template belongs to. If set, only generates instances for that schedule's employees.
- **Recurrence**:
  - **None**: Template exists but no auto-generation. Used for ad-hoc assignment only.
  - **Daily**: Generates an instance every day
  - **Weekly**: Generates on specific days of the week (e.g., Monday, Wednesday, Friday)
  - **Biweekly**: Every two weeks on specific days
  - **Monthly**: On specific dates of the month (e.g., 1st and 15th)
  - **Custom**: CRON-like configuration stored as JSON

#### Editing a Template

Changes to a template affect future generated instances only. Already-generated instances are not retroactively modified.

#### Deactivating a Template

Setting `is_active = false` stops future instance generation but does not delete existing instances.

### 2.3 Task Instance Generation

A scheduled Edge Function (`generate-task-instances`) runs daily at 6:00 AM (configurable per org) and:

1. Queries all active checklist templates with `recurrence != 'none'`
2. For each template, checks if today matches the recurrence schedule
3. If it matches and no instance exists for today + this template:
   a. Creates a `task_instance` row
   b. Copies all `checklist_template_items` into `task_instance_items`
   c. Resolves assignment:
      - If assigned to a specific person → set `assigned_to`
      - If assigned to a position → find who's scheduled for that position today in the template's schedule → set `assigned_to`
      - If multiple people share the position → create one instance per person, or one shared instance (configurable)
      - If no one is scheduled → create instance with `assigned_to = NULL`, flag for manager attention
   d. Creates notification for assignee(s)

**Edge case handling**:
- If the scheduled person calls in sick / is on time off: still generates the instance but flags it as "unassigned — original assignee unavailable"
- If a shift is added after the daily generation: a catch-up check runs when shifts are published (or managers can manually generate)

### 2.4 Ad-Hoc Task Creation

**Who**: Admin, Manager

Managers can create one-time task instances at any time, without a template:

- Title (required)
- Items (at least 1)
- Assigned to: specific person, position, or shift
- Due date (required)
- Due time (optional)

This creates a `task_instance` with `template_id = NULL`.

### 2.5 Employee Task Experience

#### "My Tasks" View

Available from: Dashboard widget, Tasks page, Mobile tab

Shows all task instances assigned to the current employee for today (and optionally upcoming days).

```
TODAY - March 27, 2026

📋 Opening Checklist                    3/8 items done
   Assigned at 6:00 AM · Due by 8:00 AM
   ☑ Unlock doors
   ☑ Turn on lights & HVAC
   ☑ Check overnight cameras
   ☐ Restock supplies
   ☐ Check feeding schedules
   ☐ Inspect play areas
   ☐ Update whiteboard
   ☐ Brief arriving staff

📋 Deep Clean - Kennels                 0/5 items done
   Assigned at 6:00 AM · Due by end of shift
   ☐ Pressure wash floors
   ☐ Sanitize water bowls
   ☐ Replace bedding
   ☐ Clean drain grates
   ☐ Disinfect door handles
```

#### Completing Items

- Tap/click checkbox to mark item complete
- Records `completed_at` timestamp and `completed_by` profile
- Item cannot be unchecked once completed (prevents gaming; manager can reset if needed)
- When all items complete → task instance status changes to `completed`, `completed_at` is set
- Completion triggers a Realtime update visible to managers

#### Task Notifications

- When a task is assigned → employee receives in-app notification
- If a task is past due and incomplete → manager receives notification (configurable: at due time, 1 hour after, etc.)

### 2.6 Manager Task Monitoring

#### "All Tasks" View

Shows all task instances across the team for a selected date range.

Filters: date range, schedule, assignee, status (pending/in-progress/completed), template

```
ALL TASKS - March 27, 2026

                                        Status    Assignee    Progress
📋 Opening Checklist - Central         ✅ Done    Alex P.      8/8
📋 Opening Checklist - SoDo            🟡 In Prog Sophia B.    5/8
📋 Deep Clean - Kennels                ⬜ Pending  Jesse K.     0/5
📋 Closing Checklist - Central         ⬜ Pending  (unassigned) 0/6
```

Managers can:
- Click into any task to see item-by-item completion status
- Reassign a task to a different employee
- Reset completed items (audit-logged)
- Mark entire task as complete on behalf of employee

### 2.7 Reporting Integration

The Tasks module feeds into the reports system:

- **Task Completion Report**: Completion rates by employee, by template, by schedule. Over time trends.
- Included in the employee profile: "Task completion rate: 94% (last 30 days)"
- Dashboard widget: "Today's tasks: X of Y completed across all schedules"

---

## 3. Policies

### 3.1 Concepts

| Concept | Description |
|---------|-------------|
| **Policy** | A named document container (e.g., "Employee Handbook", "Safety Protocol"). Has multiple versions over time. |
| **Policy Version** | A specific uploaded file (PDF/DOCX) with a version number, changelog, and publication date. |
| **Acknowledgment** | A record that a specific employee has read and acknowledged a specific policy version. |

### 3.2 Policy Management

#### Creating a Policy

**Who**: Admin, Manager

**Fields**:
- **Title** (required): e.g., "Employee Handbook"
- **Description** (optional): Brief summary of what the policy covers
- **File** (required): Upload PDF or DOCX. Max 10MB.
- **Changelog** (optional for v1): "Initial version"

This creates a `policy` row and a `policy_versions` row (version_number = 1).

#### Uploading a New Version

**Who**: Admin, Manager

When a policy is updated:
1. Manager uploads a new file
2. Provides a changelog describing what changed (required for v2+)
3. System creates a new `policy_versions` row with incremented version_number
4. All existing acknowledgments remain valid for their version but employees now need to acknowledge the new version
5. Notification sent to all active employees: "Policy updated: [title] — please review and acknowledge"

#### Deactivating a Policy

Setting `is_active = false` hides the policy from the employee-facing list but preserves all version history and acknowledgments.

### 3.3 Employee Policy Experience

#### Policy List View

Employees see all active policies with their acknowledgment status:

```
POLICIES

📄 Employee Handbook                    v3 · Updated Mar 1, 2026
   🟡 New version — please review and acknowledge
   [Read & Acknowledge]

📄 Safety Protocol                      v2 · Updated Feb 15, 2026
   ✅ Acknowledged on Feb 16, 2026
   [View]

📄 Dress Code                           v1 · Created Jan 10, 2026
   ✅ Acknowledged on Jan 12, 2026
   [View]
```

#### Reading & Acknowledging

1. Employee clicks "Read & Acknowledge"
2. Document opens in an embedded viewer (PDF viewer for PDFs, rendered for DOCX) or download link
3. After viewing, employee clicks "I have read and understood this policy"
4. Confirmation dialog: "By acknowledging, you confirm that you have read and understood the [Policy Title] (Version X). This action is recorded."
5. Creates `policy_acknowledgments` row with timestamp
6. The acknowledgment is permanent and timestamped

#### Version History

Employees can view all versions of a policy:
```
Employee Handbook — Version History

v3 · Mar 1, 2026 · Published by Jose R.
   Changes: Updated PTO policy section, added remote work guidelines
   🟡 Not yet acknowledged
   [Read & Acknowledge]

v2 · Nov 15, 2025 · Published by Jose R.
   Changes: Updated harassment policy, added social media guidelines
   ✅ Acknowledged on Nov 17, 2025

v1 · Jun 1, 2025 · Published by Jose R.
   Initial version
   ✅ Acknowledged on Jun 3, 2025
```

### 3.4 Manager Policy Monitoring

#### Acknowledgment Tracker

For each policy (latest version), managers see:

```
Employee Handbook v3 — Acknowledgment Status

22 of 25 employees acknowledged (88%)

✅ Acknowledged (22):
   Alex P. · Mar 2    Maria A. · Mar 2    Jesse K. · Mar 3 ...

🟡 Not Yet Acknowledged (3):
   Ashley P.    Barry D.    Isabel M.
   [Send Reminder]  [Send Reminder]  [Send Reminder]
   [Send Reminder to All]
```

**Send Reminder**: Creates a new notification for the employee: "Reminder: Please review and acknowledge [Policy Title] v[X]"

### 3.5 Policy File Storage

- Files uploaded to Supabase Storage bucket `policies`
- Path: `{organization_id}/{policy_id}/{version_number}/{filename}`
- Access controlled via RLS: only authenticated users in the same org can access
- Supported formats: PDF, DOCX, DOC
- Max file size: 10MB
- File integrity: SHA-256 hash stored in metadata (future feature for tamper detection)

---

## 4. Data Model Summary

See `03-DATABASE-SCHEMA.md` for full SQL. Key tables:

**Tasks**:
- `checklist_templates` — Template definitions
- `checklist_template_items` — Items within templates
- `task_instances` — Concrete daily assignments
- `task_instance_items` — Items within instances (checkable)

**Policies**:
- `policies` — Policy containers
- `policy_versions` — Versioned file uploads
- `policy_acknowledgments` — Employee acknowledgment records

---

## 5. API Endpoints Summary

See `04-API-ARCHITECTURE.md` for full contracts.

**Tasks**:
- `generate-task-instances` — Cron job, creates daily instances
- `create-ad-hoc-task` — Manager creates one-time task
- Direct Supabase: get my tasks, complete items, get all tasks

**Policies**:
- `upload-policy-version` — Upload new policy or version
- Direct Supabase: list policies, get versions, record acknowledgment, get acknowledgment status

---

## 6. Permissions Summary

| Action | Admin | Manager | Employee |
|--------|-------|---------|----------|
| Create checklist template | ✅ | ✅ | ❌ |
| Edit checklist template | ✅ | ✅ | ❌ |
| Deactivate template | ✅ | ✅ | ❌ |
| Create ad-hoc task | ✅ | ✅ | ❌ |
| View my tasks | ✅ | ✅ | ✅ |
| Complete task items | ✅ | ✅ | ✅ |
| View all tasks | ✅ | ✅ (assigned schedules) | ❌ |
| Reassign task | ✅ | ✅ | ❌ |
| Reset completed items | ✅ | ✅ | ❌ |
| Upload policy | ✅ | ✅ | ❌ |
| Upload new version | ✅ | ✅ | ❌ |
| View policies | ✅ | ✅ | ✅ |
| Acknowledge policy | ✅ | ✅ | ✅ |
| View acknowledgment status | ✅ | ✅ (assigned schedules) | ❌ |
| Send acknowledgment reminders | ✅ | ✅ | ❌ |

---

## 7. Edge Cases & Business Rules

### Tasks
1. **Employee calls in sick**: Task instance is created but flagged as unassigned. Manager gets notification to reassign.
2. **Shift swap after task generation**: Task follows the original assignee (not the new shift holder). Manager can manually reassign.
3. **Multiple employees in same position**: Configurable — either one shared instance or individual copies. Default: individual copies.
4. **Task overdue**: If `due_date` passes and status != completed, manager is notified. Task remains completable (no auto-close).
5. **Template item changes**: Only affect future instances. Existing instances retain their original items.
6. **Deleted employee**: Their task instances remain for audit but are marked as "(former employee)" in views.

### Policies
1. **Employee joins after policy published**: They see the latest version and need to acknowledge it. No retroactive requirement for old versions.
2. **Policy version uploaded mid-day**: All employees who acknowledged the previous version are now shown as "needs re-acknowledgment" for the new version.
3. **Employee deactivated**: Their acknowledgment records are preserved for compliance/audit purposes.
4. **Large file upload**: Files over 10MB are rejected with a clear error message. Consider compression guidance.
5. **Concurrent acknowledgments**: Use `ON CONFLICT DO NOTHING` — if somehow submitted twice, only the first is recorded.

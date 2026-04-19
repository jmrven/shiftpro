# ShiftPro — Implementation Roadmap

## 1. Phasing Strategy

The build is organized into 5 phases, each producing a functional increment. Each phase builds on the previous one. The order is designed so that foundational infrastructure (auth, database, core UI shell) comes first, followed by the highest-value features (scheduling, attendance), and then layering on supporting features.

---

## 2. Phase 1 — Foundation (Weeks 1–2)

**Goal**: Project scaffolding, database, auth, and basic employee management. At the end of this phase, admins can sign up, create an org, invite employees, and employees can log in and see their profile.

### Tasks

| # | Task | Details | Depends On |
|---|------|---------|------------|
| 1.1 | Initialize Supabase project | Create project, enable extensions (PostGIS, pg_trgm, pg_cron), configure auth settings | — |
| 1.2 | Create database migrations | All migration files from `03-DATABASE-SCHEMA.md`. Run in order 001–014. Seed with test data. | 1.1 |
| 1.3 | Configure RLS policies | Implement all RLS policies per schema doc. Test with different role JWTs. | 1.2 |
| 1.4 | Set up custom JWT claims | Implement `custom_access_token_hook` function. Test that org_id and role appear in JWT. | 1.2 |
| 1.5 | Create Supabase Storage buckets | avatars, policies, exports, org-assets. Configure access policies. | 1.1 |
| 1.6 | Initialize frontend project | Vite + React + TypeScript + Tailwind + shadcn/ui. Configure ESLint, Prettier, Vitest. | — |
| 1.7 | Set up Supabase client | Initialize `@supabase/supabase-js`, create auth hooks, create TanStack Query provider. | 1.6 |
| 1.8 | Build auth pages | Login page, signup page (org creation flow). Password reset flow. | 1.7 |
| 1.9 | Build app shell | Sidebar navigation, top bar, responsive layout, route guards per role. | 1.8 |
| 1.10 | Build `create-organization` Edge Function | Creates org + default settings on admin signup. | 1.2, 1.4 |
| 1.11 | Build `invite-employee` Edge Function | Creates user + profile + assignments. Sends invite email. | 1.2 |
| 1.12 | Build Employee Management UI | Employee list (with filters, search, pagination), employee profile view, invite modal, profile edit form. | 1.9, 1.11 |
| 1.13 | Generate TypeScript types | Run `supabase gen types` and set up auto-regeneration on migration changes. | 1.2, 1.6 |
| 1.14 | PWA configuration | Vite PWA plugin, manifest, service worker, icons. | 1.6 |
| 1.15 | Deploy to Railway + Supabase | Dockerfile, Caddyfile, environment variables, DNS configuration. CI/CD pipeline. | 1.6, 1.1 |

### Deliverables
- Deployed app at staging URL
- Admin can sign up and create organization
- Admin can invite employees
- Employees can log in and view/edit their profile
- Employee list with filtering and search
- PWA installable on mobile

---

## 3. Phase 2 — Scheduling (Weeks 3–5)

**Goal**: Full scheduling module. Managers can create and publish schedules. Employees can view their schedule, set availability, and make shift requests.

### Tasks

| # | Task | Details | Depends On |
|---|------|---------|------------|
| 2.1 | Build Schedule Editor grid | The core component: employee rows × day columns. Week view first. Shift blocks rendered as colored cards. | Phase 1 |
| 2.2 | Shift CRUD | Create shift modal, edit shift, delete shift. Position/job site selection. Break duration. | 2.1 |
| 2.3 | Build `create-shift` Edge Function | Conflict detection, validation, creation. | 1.2 |
| 2.4 | Drag-and-drop shifts | react-dnd for moving shifts between employees and days. Copy on Ctrl+drag. | 2.1 |
| 2.5 | Schedule toolbar | Filter by schedule, position, job site. View mode toggle (Employee View). Date navigation. Day/Week/2Wk/Month toggle. | 2.1 |
| 2.6 | Open Shifts row | Display and create unassigned shifts. | 2.1 |
| 2.7 | Schedule footer | Totals row: scheduled hours and labor cost per day, per employee, grand total. | 2.1 |
| 2.8 | Sort employees | First name, last name, custom drag order (stored per schedule). | 2.1 |
| 2.9 | Publish / Unpublish | `publish-schedule` Edge Function. UI button. Notification dispatch. | 2.1, 3.8 (notifications) |
| 2.10 | Time-off overlay | Toggle to show approved time-off on schedule grid as colored blocks. | 2.1, Phase 3 (time off) |
| 2.11 | Availability overlay | Toggle to show employee availability preferences on grid. | 2.1, 2.14 |
| 2.12 | Schedule templates | Save as template, apply template, copy previous week. Edge Functions. | 2.1 |
| 2.13 | Schedule tools | Clear shifts, export PDF/CSV, print, print settings. | 2.1 |
| 2.14 | Availability management | Employee sets weekly recurring availability. Availability grid view for managers. | Phase 1 |
| 2.15 | My Schedule view | Employee's personal schedule page. Day/week view. | Phase 1 |
| 2.16 | Team Schedule view | Read-only overview for managers. | Phase 1 |
| 2.17 | Shift requests — Swap | Submit, approve, deny flow. `handle-shift-request` Edge Function. | 2.1 |
| 2.18 | Shift requests — Offer | Submit, claim, approve flow. | 2.17 |
| 2.19 | Shift requests — Drop | Submit, approve flow. | 2.17 |
| 2.20 | Shift requests — Open Shift claim | Employee claims, manager approves. | 2.6, 2.17 |
| 2.21 | Requests page | Unified view of all pending requests with tabs (Swaps, Offers, Drops). | 2.17 |
| 2.22 | iCal feed | `ical-feed` Edge Function. Per-employee unique URL. | 2.1 |
| 2.23 | Realtime schedule updates | Supabase Realtime subscription on shifts table. Live grid updates. | 2.1 |

### Deliverables
- Fully functional schedule editor with all view modes
- Shift CRUD with conflict detection
- Drag-and-drop shift management
- Schedule publish with employee notifications
- Templates (save, apply, copy previous week)
- Employee availability management
- My Schedule and Team Schedule views
- Shift request workflows (swap, offer, drop, open shift)
- iCal calendar sync
- Realtime schedule updates

---

## 4. Phase 3 — Attendance + Time Off (Weeks 6–8)

**Goal**: Employees can clock in/out with GPS. Managers approve timesheets. Time-off request and balance system is functional.

### Tasks

| # | Task | Details | Depends On |
|---|------|---------|------------|
| 3.1 | Build Time Clock widget | Dashboard widget + dedicated mobile screen. Clock In/Out/Break buttons. GPS status indicator. | Phase 1 |
| 3.2 | GPS capture hook | `useGeolocation` hook with high-accuracy mode. Error handling for denied permissions. | 3.1 |
| 3.3 | Build `clock-action` Edge Function | Clock in/out/break with geofence check (PostGIS). Creates clock events and updates timesheets. | 1.2 |
| 3.4 | Geofence configuration | Job site settings: lat/lng picker (map), radius slider. Store as PostGIS GEOGRAPHY. | Phase 1 (settings) |
| 3.5 | Who's Working widget | Dashboard real-time list. Supabase Realtime on clock_events. Clock Out button for managers. | 3.3 |
| 3.6 | No Show widget | Compare scheduled shifts vs. clock events. Highlight missing clock-ins. | 3.3, Phase 2 |
| 3.7 | Timesheets — List view | Table of time entries. Filters: schedule, employee, date range, status. | 3.3 |
| 3.8 | Timesheets — Summary view | Aggregated totals per employee per period. Regular/overtime/break breakdown. | 3.7 |
| 3.9 | My Timesheets view | Employee sees own time entries. | 3.7 |
| 3.10 | Manual time entry | Manager adds time for employees who forgot to clock. `Add Time` modal. | 3.7 |
| 3.11 | Timesheet edit | Edit clock times with before/after audit trail. | 3.7 |
| 3.12 | Timesheet approval | `approve-timesheets` Edge Function. Approve/reject individual or batch. Lock on approval. | 3.7 |
| 3.13 | Time Off types configuration | Settings page: CRUD for time-off types (Vacation, Sick, Unpaid, custom). | Phase 1 (settings) |
| 3.14 | Time Off policies configuration | Accrual rules, balance caps, carryover. Assign policies to employees. | 3.13 |
| 3.15 | Time Off request flow | `request-timeoff` Edge Function with balance/blocked-day validation. UI form. | 3.14 |
| 3.16 | Time Off approve/deny | `handle-timeoff-request` Edge Function. Manager action UI. | 3.15 |
| 3.17 | Time Off balances view | Per-employee balance display. Manual adjustment form for admins. | 3.14 |
| 3.18 | Time Off request list | Manager view with filters. List + calendar views. | 3.15 |
| 3.19 | Blocked days & holidays | Settings pages. Blocked days reject requests. Holidays display on calendar. | Phase 1 (settings) |
| 3.20 | Time-off accruals cron | `run-timeoff-accruals` scheduled function. Daily run with frequency-aware logic. | 3.14 |
| 3.21 | Notification system | `notifications` table, Realtime subscription, NotificationBell component, NotificationCenter. | Phase 1 |

### Deliverables
- GPS-enabled clock in/out with geofence validation
- Break tracking
- Real-time "Who's Working" and "No Show" dashboards
- Full timesheet management (list, summary, manual entry, edit, approve)
- Complete time-off system: types, policies, accruals, balances, requests, approvals
- Blocked days and public holidays
- In-app notification system

---

## 5. Phase 4 — Messaging + Tasks & Policies (Weeks 9–11)

**Goal**: Real-time messaging, task management, and policy document management are fully functional.

### Tasks

| # | Task | Details | Depends On |
|---|------|---------|------------|
| 4.1 | Chat widget (slide-out panel) | Floating button, slide-out panel with conversation list. Available on every page. | Phase 1 |
| 4.2 | Conversation list | Recent chats sorted by last message. Unread counts. Search. | 4.1 |
| 4.3 | Direct messaging | Start DM with any org member. Message input, send, real-time delivery. | 4.2 |
| 4.4 | Group chats | Create group, name it, add/remove members. | 4.3 |
| 4.5 | Presence system | Supabase Realtime Presence. Available/Idle/Offline status. | 4.1 |
| 4.6 | Contact list | All org members with presence status. Click to start DM. | 4.5 |
| 4.7 | Full-page messaging | `/messages` route for full messaging experience. | 4.1–4.6 |
| 4.8 | Message search | Search within conversation. Highlight results. | 4.7 |
| 4.9 | Checklist template editor | Create/edit/deactivate templates. Item management with drag reorder. Recurrence config. Assignment rules. | Phase 1 |
| 4.10 | `generate-task-instances` cron | Daily instance generation with assignment resolution. | 4.9 |
| 4.11 | `create-ad-hoc-task` Edge Function | One-time task creation by managers. | 4.9 |
| 4.12 | My Tasks view | Employee's daily task list. Checkbox completion. Progress indicator. | 4.10 |
| 4.13 | All Tasks view (manager) | Team-wide task monitoring. Filters. Reassign and reset actions. | 4.10 |
| 4.14 | Tasks dashboard widget | "My Tasks" widget on dashboard. Today's checklist summary. | 4.12 |
| 4.15 | Policy CRUD | Create policy, upload file, set title/description. | Phase 1 |
| 4.16 | `upload-policy-version` Edge Function | Upload new version, increment version number, notify employees. | 4.15 |
| 4.17 | Policy list (employee view) | Active policies with acknowledgment status. | 4.15 |
| 4.18 | Policy viewer | Embedded PDF viewer / download link. "Acknowledge" button. | 4.17 |
| 4.19 | Acknowledgment tracker (manager) | Per-policy status: who has/hasn't acknowledged. Send reminders. | 4.16 |
| 4.20 | Policy version history | View all versions with changelog. Acknowledge specific versions. | 4.16 |

### Deliverables
- Real-time messaging (DMs + group chats) with presence
- Chat widget accessible from every page
- Checklist template management
- Automatic daily task generation
- Employee task completion workflow
- Manager task monitoring and reassignment
- Policy document management with versioning
- Employee acknowledgment with tracking
- Manager acknowledgment dashboard with reminders

---

## 6. Phase 5 — Reports, Settings, Polish (Weeks 12–14)

**Goal**: All reports functional. Settings complete. Performance optimization. Bug fixes. Production readiness.

### Tasks

| # | Task | Details | Depends On |
|---|------|---------|------------|
| 5.1 | Scheduled Hours report | Per-employee hours by date range. Labor cost calculation. | Phase 2 |
| 5.2 | Worked Hours report | Actual hours from timesheets. Regular/OT/break breakdown. | Phase 3 |
| 5.3 | Scheduled vs. Actual report | Compare scheduled vs. worked. Highlight variances. | 5.1, 5.2 |
| 5.4 | Attendance report | Daily attendance: scheduled, clocked in, no-shows, late. | Phase 3 |
| 5.5 | Time Off report | Summary by type, employee, period. Trend visualization. | Phase 3 |
| 5.6 | Employee Availability report | Grid view of all employees' weekly availability. | Phase 2 |
| 5.7 | Skill Expiry report | Employees with expiring skills. 30/60/90 day warnings. | Phase 1 |
| 5.8 | Audit Log report | Searchable log of all system actions. | All phases |
| 5.9 | Schedule Audit report | History of schedule changes. | Phase 2 |
| 5.10 | Timesheet Audit report | History of timesheet edits. | Phase 3 |
| 5.11 | CSV export for all reports | `generate-report` Edge Function with CSV format. | 5.1–5.10 |
| 5.12 | Print layouts for all reports | Print-friendly CSS. Print settings. | 5.1–5.10 |
| 5.13 | Complete Settings pages | All settings sections from the Settings spec. | All phases |
| 5.14 | Branding settings | Logo upload, primary color picker, preview. | 5.13 |
| 5.15 | Data backup / export | Full org data export download. | 5.13 |
| 5.16 | Payroll page | Summary view for payroll processing. Export to common formats. | Phase 3 |
| 5.17 | Pay rules engine | OT calculation (daily/weekly), holiday multipliers, night differential. | 5.16 |
| 5.18 | Bulk import employees | CSV upload with validation and error reporting. | Phase 1 |
| 5.19 | Performance optimization | Virtualized lists for large datasets. Query optimization. Bundle splitting. Lighthouse audit. | All phases |
| 5.20 | Offline PWA enhancement | Cache current week schedule, recent messages. Offline indicator banner. | All phases |
| 5.21 | Error handling & loading states | Consistent error boundaries, skeleton loaders, toast notifications. | All phases |
| 5.22 | Accessibility audit | WCAG 2.1 AA compliance check. Fix issues. | All phases |
| 5.23 | Security audit | Review RLS policies, test permission boundaries, pen test Edge Functions. | All phases |
| 5.24 | End-to-end testing | Critical user flows: signup → schedule → clock → approve. | All phases |
| 5.25 | Production deployment | Production Supabase project, production Railway service, DNS, monitoring, Sentry. | All phases |

### Deliverables
- All 10 report types functional with export and print
- Complete settings management
- Payroll summary with pay rules
- Bulk employee import
- Performance optimized (Lighthouse > 90)
- Offline PWA support
- Accessibility compliant
- Security audited
- Production deployed

---

## 7. Effort Estimates

| Phase | Duration | Key Risk |
|-------|----------|----------|
| Phase 1: Foundation | 2 weeks | Auth/RLS complexity. Supabase custom claims setup. |
| Phase 2: Scheduling | 3 weeks | Schedule editor is the most complex UI component. Drag-and-drop + real-time. |
| Phase 3: Attendance + Time Off | 3 weeks | Geofence accuracy. Time-off accrual logic edge cases. |
| Phase 4: Messaging + Tasks | 3 weeks | Real-time messaging performance. Task assignment resolution logic. |
| Phase 5: Reports + Polish | 3 weeks | Report query performance. Cross-browser testing. Accessibility fixes. |
| **Total** | **14 weeks** | |

---

## 8. Tech Debt & Future Enhancements (Post-Launch)

| Feature | Description | Phase |
|---------|-------------|-------|
| Auto-scheduling | AI/algorithm-based shift auto-assignment | v2 |
| Email notifications | Email delivery for critical events | v2 |
| SMS notifications | SMS delivery via Twilio/similar | v2 |
| File attachments in messages | Image/file sharing in chat | v2 |
| Custom roles & permissions | Granular permission system beyond 3 roles | v2 |
| Mobile native apps | React Native or Capacitor wrappers | v3 |
| Integrations | Payroll providers (Gusto, ADP), POS systems, HR tools | v3 |
| Multi-language | i18n support (Spanish as priority) | v2 |
| Custom domain | Per-organization custom domains | v3 |
| API for third parties | Public API with API keys | v3 |
| Advanced analytics | Dashboards with trends, predictions, labor optimization | v3 |

---

## 9. Definition of Done (Per Feature)

A feature is "done" when:
1. Code is written and passes TypeScript type check
2. RLS policies are in place and tested
3. UI is responsive (desktop + mobile)
4. Loading and error states are handled
5. Realtime updates work (where applicable)
6. Notifications fire (where applicable)
7. Audit log entries are created (where applicable)
8. The feature works with the seed data
9. No console errors or warnings
10. Accessibility: keyboard navigable, screen reader compatible

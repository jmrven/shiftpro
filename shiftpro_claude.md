# ShiftPro — CLAUDE.md

## What is this project?

ShiftPro is a workforce management PWA (scheduling, attendance, time-off, messaging, tasks, policies) built as a Zoho Shifts alternative. It targets service businesses with 50–500 employees across 3–20 locations.

**Read the spec docs before writing any code.** The `docs/` folder contains 8 numbered markdown files that are the source of truth for every architectural decision. When implementing a feature, read the relevant doc first:

| Doc | Use when... |
|-----|-------------|
| `01-PROJECT-OVERVIEW.md` | You need overall context, stack rationale, or module summary |
| `02-PRODUCT-REQUIREMENTS.md` | You need user stories, acceptance criteria, or the permission matrix |
| `03-DATABASE-SCHEMA.md` | You're writing migrations, RLS policies, queries, or touching any table |
| `04-API-ARCHITECTURE.md` | You're writing Edge Functions, Realtime subscriptions, or API calls |
| `05-TECHNICAL-ARCHITECTURE.md` | You need folder structure, deployment, CI/CD, or environment config |
| `06-UI-UX-SPECIFICATION.md` | You're building pages, layouts, components, or responsive behavior |
| `07-TASKS-POLICIES-SPEC.md` | You're touching anything in the Tasks or Policies module |
| `08-IMPLEMENTATION-ROADMAP.md` | You need to understand build order, dependencies, or what's in scope |

## Tech stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS 3 + shadcn/ui (Radix)
- **Database**: Supabase (PostgreSQL 15+ with PostGIS, pg_trgm, pg_cron)
- **Backend**: Supabase Edge Functions (Deno/TypeScript) — no Express, no Node server
- **Auth**: Supabase Auth with custom JWT claims (`organization_id`, `user_role`)
- **Realtime**: Supabase Realtime (WebSocket) for messages, notifications, live schedule updates
- **Storage**: Supabase Storage (avatars, policies, exports, org-assets buckets)
- **Hosting**: Railway.com (static Vite build served by Caddy)
- **State**: Zustand (auth/UI) + TanStack Query v5 (server cache) + React Hook Form + Zod
- **Dates**: date-fns + date-fns-tz (all storage in UTC, display in org timezone)
- **DnD**: react-dnd + react-dnd-html5-backend (schedule editor)
- **Charts**: Recharts (reports)
- **PWA**: vite-plugin-pwa

## Project structure

```
shiftpro-web/
├── src/
│   ├── main.tsx
│   ├── App.tsx                     # Root component, React Router setup
│   ├── lib/                        # Utilities — supabase client, auth helpers, api wrappers
│   ├── hooks/                      # useAuth, useRealtime, useGeolocation, useNotifications
│   ├── stores/                     # Zustand stores (authStore, scheduleStore, notificationStore)
│   ├── components/
│   │   ├── ui/                     # shadcn/ui primitives — DO NOT edit directly
│   │   ├── layout/                 # AppShell, Sidebar, TopBar, ChatWidget
│   │   ├── schedule/               # ScheduleEditor, ShiftCell, ShiftModal, ScheduleToolbar
│   │   ├── attendance/             # TimeClock, TimesheetList, TimesheetSummary
│   │   ├── timeoff/                # TimeOffRequestList, BalancesView, TimeOffRequestForm
│   │   ├── employees/              # EmployeeList, EmployeeProfile, InviteModal
│   │   ├── messaging/              # ConversationList, ChatWindow, MessageBubble
│   │   ├── tasks/                  # MyTasks, ChecklistView, ChecklistTemplateEditor
│   │   ├── policies/               # PolicyList, PolicyViewer, AcknowledgmentTracker
│   │   ├── reports/                # ReportShell + [Type]Report.tsx per report
│   │   ├── dashboard/              # Dashboard, WhosWorking, PendingApprovals
│   │   ├── settings/               # SettingsLayout + [Section]Settings.tsx per section
│   │   └── notifications/          # NotificationBell, NotificationCenter
│   ├── pages/                      # Route-level wrappers (one per route)
│   └── types/
│       ├── database.ts             # AUTO-GENERATED — run `supabase gen types typescript`
│       ├── api.ts                  # Edge Function request/response types
│       └── ui.ts
├── supabase/
│   ├── config.toml
│   ├── migrations/                 # Numbered 001–014. Run in order.
│   │   ├── 001_extensions.sql
│   │   ├── ...
│   │   └── 014_seed.sql
│   └── functions/                  # Edge Functions — each in its own directory
│       ├── create-organization/index.ts
│       ├── invite-employee/index.ts
│       ├── clock-action/index.ts
│       ├── ...
│       └── _shared/                # Shared utilities (cors, auth, notifications, audit, validation)
├── public/                         # PWA manifest, icons, service worker
├── Dockerfile                      # Multi-stage: Node build → Caddy serve
├── Caddyfile                       # SPA routing, CSP headers, gzip
└── .env.example                    # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_APP_URL
```

## Critical rules

### Database

- **Every table** with user data has an `organization_id` column and RLS enabled.
- **RLS is the authorization layer.** The frontend calls Supabase directly for CRUD. Edge Functions handle multi-step business logic. Never bypass RLS — if you need admin access in an Edge Function, use the service role client explicitly and document why.
- **UUID primary keys** everywhere. Use `gen_random_uuid()`.
- **Timestamps**: `created_at` and `updated_at` on every table. Auto-updated via the `update_updated_at()` trigger.
- **Soft deletes** for employees (`status = 'inactive'`), never hard delete. Historical data must be preserved.
- **All times stored in UTC.** Display in org timezone using `date-fns-tz`. The org timezone comes from `organizations.timezone`.
- **PostGIS** for geolocation: `GEOGRAPHY(POINT, 4326)` for GPS points, `ST_DWithin()` for geofence checks.
- After any migration change, regenerate types: `supabase gen types typescript --project-id $PROJECT_ID > src/types/database.ts`

### API pattern

**70% direct Supabase, 30% Edge Functions.** Use this decision tree:

- Simple CRUD (list, read, create, update, delete) → **Direct Supabase client call** (RLS handles auth)
- Multi-step transaction, side effects (notifications, audit logs), or complex validation → **Edge Function**

Edge Functions live in `supabase/functions/[name]/index.ts`. They use Deno runtime. Shared utilities go in `supabase/functions/_shared/`.

**Error format** (all Edge Functions must follow):
```typescript
// Success: return { data: ... } with status 200
// Error: return { error: { code, message, details? } } with appropriate HTTP status
// Codes: VALIDATION_ERROR (400), UNAUTHORIZED (401), FORBIDDEN (403), NOT_FOUND (404), CONFLICT (409), INTERNAL_ERROR (500)
```

### Frontend

- **Components**: PascalCase filenames. One component per file. Co-locate types if component-specific.
- **Hooks**: `use` prefix, camelCase. Keep in `/hooks/`.
- **Stores**: Zustand for auth/UI state. TanStack Query for all server data. Never store server data in Zustand.
- **Forms**: Always React Hook Form + Zod schema. Define Zod schema in the same file as the form component.
- **Styling**: Tailwind utility classes only. Use shadcn/ui components as base. Never write raw CSS files. For custom theme colors, use CSS variables defined in `tailwind.config.ts`.
- **Routing**: React Router v6. Routes defined in `App.tsx`. Role-based route guards wrap protected routes.
- **Responsive**: Desktop-first. Breakpoints: mobile < 768px, tablet 768–1024px, desktop > 1024px.
- **Accessibility**: All interactive elements need focus indicators, aria-labels, keyboard support. Color is never the only status indicator.

### Realtime

Subscribe to these channels where needed:
- `notifications:{user_id}` — notification bell updates
- `messages:{conversation_id}` — live chat
- `shifts:{schedule_id}` — schedule editor live sync
- `clock_events:{org_id}` — "Who's Working" dashboard widget
- Presence: `org:{org_id}` — online/idle/offline status for messaging

Clean up subscriptions on component unmount. Use the `useRealtime` hook pattern.

### Auth & roles

Three roles: `admin`, `manager`, `employee`. Stored in `profiles.role` and embedded in JWT via custom claims hook.

- **Admin**: Full org access. Only role that can access Settings.
- **Manager**: Scoped to assigned schedules (via `manager_schedules` junction table). Can approve requests, edit timesheets, manage tasks/policies for their schedules.
- **Employee**: Sees own data only. Can clock in/out, view schedule, request time off, complete tasks, send messages.

Check the permission matrix in `02-PRODUCT-REQUIREMENTS.md` section 1.2 before implementing any feature.

### Audit logging

Every write operation that changes business data must create an `audit_logs` entry:
```typescript
{ actor_id, action, entity_type, entity_id, changes: { field: { old, new } }, ip_address }
```
Use the shared `_shared/audit.ts` helper in Edge Functions. For direct Supabase writes, use database triggers.

## Commands

```bash
# Development
npm run dev              # Vite dev server
npm run typecheck        # TypeScript check (no emit)
npm run lint             # ESLint
npm run test             # Vitest

# Supabase
supabase start           # Local dev instance
supabase db push         # Apply migrations (dev)
supabase db migrate      # Apply migrations (CI)
supabase gen types typescript --project-id $PROJECT_ID > src/types/database.ts
supabase functions serve  # Local Edge Function dev
supabase functions deploy # Deploy all Edge Functions

# Build & Deploy
npm run build            # Vite production build → dist/
# Railway auto-deploys from GitHub push to main
```

## Environment variables

```
# Frontend (.env)
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_APP_URL=https://app.shiftpro.com

# Edge Functions (Supabase secrets)
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # Only used in Edge Functions, never exposed to frontend
SUPABASE_ANON_KEY=eyJ...
```

**Never commit `.env` files. Never expose the service role key to the frontend.**

## Implementation order

Follow the phased roadmap in `08-IMPLEMENTATION-ROADMAP.md`:

1. **Phase 1 (Foundation)**: Supabase setup, migrations, RLS, auth, app shell, employee CRUD
2. **Phase 2 (Scheduling)**: Schedule editor grid, shift CRUD, drag-and-drop, publish, templates, requests
3. **Phase 3 (Attendance + Time Off)**: Clock in/out with GPS/geofence, timesheets, time-off system
4. **Phase 4 (Messaging + Tasks)**: Real-time chat, checklist templates, task instances, policies
5. **Phase 5 (Reports + Polish)**: All 10 report types, remaining settings, performance, accessibility

Each phase builds on the previous. Don't skip ahead — the dependency chain matters.

## Common patterns

### Supabase query with filters
```typescript
const { data, error } = await supabase
  .from('shifts')
  .select('*, position:positions(*), profile:profiles(*)')
  .eq('schedule_id', scheduleId)
  .gte('start_time', weekStart.toISOString())
  .lte('start_time', weekEnd.toISOString())
  .order('start_time');
```

### Edge Function boilerplate
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    // Verify JWT from Authorization header
    const authHeader = req.headers.get('Authorization')!;
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) throw { code: 'UNAUTHORIZED', message: 'Invalid token' };

    // Business logic here...

    return new Response(JSON.stringify({ data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const status = err.code === 'UNAUTHORIZED' ? 401 : err.code === 'FORBIDDEN' ? 403 : 400;
    return new Response(JSON.stringify({ error: err }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

### RLS policy template
```sql
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- All authenticated users see their org's data
CREATE POLICY "org_isolation" ON table_name FOR ALL
USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Admin-only write (example for settings tables)
CREATE POLICY "admin_write" ON table_name FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  AND organization_id = table_name.organization_id
));
```

### TanStack Query pattern
```typescript
// In a custom hook
export function useShifts(scheduleId: string, weekStart: Date) {
  return useQuery({
    queryKey: ['shifts', scheduleId, weekStart.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase.from('shifts')
        .select('*, position:positions(*), profile:profiles(*)')
        .eq('schedule_id', scheduleId)
        .gte('start_time', weekStart.toISOString())
        .lte('start_time', addDays(weekStart, 7).toISOString());
      if (error) throw error;
      return data;
    },
  });
}
```

## What NOT to do

- Don't install Express, Fastify, or any Node HTTP framework — the backend is Supabase Edge Functions (Deno)
- Don't create a separate auth system — use Supabase Auth exclusively
- Don't store state in localStorage for the PWA — use Zustand + service worker cache
- Don't write raw SQL in the frontend — use the Supabase JS client
- Don't hard-delete employee records — soft delete via `status = 'inactive'`
- Don't put business logic in the frontend that should be in an Edge Function (anything with side effects: notifications, audit logs, multi-table transactions)
- Don't skip RLS policies on new tables — every table with org data needs org_isolation at minimum
- Don't use `any` in TypeScript — use the generated `database.ts` types
- Don't add CSS files — use Tailwind utility classes
- Don't store secrets in `.env` files that get committed

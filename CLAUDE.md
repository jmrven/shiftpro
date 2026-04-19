# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is this project?

ShiftPro is a workforce management PWA (scheduling, attendance, time-off, messaging, tasks, policies) — a modern Zoho Shifts alternative for service businesses with 50–500 employees across 3–20 locations. This repository is currently **specification only** — all source code is yet to be implemented inside `shiftpro-web/`.

**Read the spec docs before writing any code.** Every architectural decision is captured in the numbered docs at the repo root:

| Doc | Use when... |
|-----|-------------|
| `01-PROJECT-OVERVIEW.md` | Overall context, stack rationale, module summary |
| `02-PRODUCT-REQUIREMENTS.md` | User stories, acceptance criteria, permission matrix |
| `03-DATABASE-SCHEMA.md` | Writing migrations, RLS policies, queries, or touching any table |
| `04-API-ARCHITECTURE.md` | Writing Edge Functions, Realtime subscriptions, API calls |
| `05-TECHNICAL-ARCHITECTURE.md` | Folder structure, deployment, CI/CD, environment config |
| `06-UI-UX-SPECIFICATION.md` | Pages, layouts, components, responsive behavior |
| `07-TASKS-POLICIES-SPEC.md` | Tasks or Policies module |
| `08-IMPLEMENTATION-ROADMAP.md` | Build order, dependencies, phase scope |

## Tech stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS 3 + shadcn/ui (Radix primitives)
- **Backend**: Supabase Edge Functions (Deno/TypeScript) — no Express, no Node server
- **Database**: Supabase (PostgreSQL 15+ with PostGIS, pg_trgm, pg_cron)
- **Auth**: Supabase Auth with custom JWT claims (`organization_id`, `user_role`)
- **Realtime**: Supabase Realtime (WebSocket)
- **Storage**: Supabase Storage (avatars, policies, exports, org-assets buckets)
- **Hosting**: Railway.com (static Vite build served by Caddy 2)
- **State**: Zustand (auth/UI) + TanStack Query v5 (server cache) + React Hook Form + Zod
- **Dates**: date-fns + date-fns-tz (all storage in UTC, display in org timezone)

## Commands

```bash
# Development
npm run dev              # Vite dev server
npm run typecheck        # TypeScript check (no emit)
npm run lint             # ESLint
npm run test             # Vitest

# Supabase
supabase start                          # Local dev instance
supabase db push                        # Apply migrations (dev)
supabase db migrate                     # Apply migrations (CI)
supabase gen types typescript --project-id $PROJECT_ID > src/types/database.ts
supabase functions serve                # Local Edge Function dev
supabase functions deploy               # Deploy all Edge Functions

# Build
npm run build            # Vite production build → dist/
# Railway auto-deploys from GitHub push to main
```

## Architecture

### System topology

```
Browser (Desktop/Mobile PWA)
    │ HTTPS / WSS
    ▼
Railway.com — Vite static build + Caddy (SPA routing, CSP, gzip)
    │
    ▼
Supabase
  ├── Auth (JWT, bcrypt, auto refresh)
  ├── PostgREST ← ~70% of API calls (simple CRUD via RLS)
  ├── Edge Functions (Deno) ← ~30% (business logic, notifications, cron jobs)
  ├── Realtime (WebSocket) ← live chat, schedule updates, who's-working
  ├── Storage (S3-compatible)
  └── PostgreSQL 15+ (PostGIS, pg_trgm, pg_cron)
```

### API decision rule

- **Simple CRUD** → frontend calls Supabase JS client directly; RLS enforces authorization
- **Multi-step / side effects** (notifications, audit logs, multi-table transactions) → Edge Function

### Realtime channels

| Channel | Purpose |
|---------|---------|
| `notifications:{user_id}` | In-app notification bell |
| `messages:{conversation_id}` | Live chat |
| `shifts:{schedule_id}` | Schedule editor live sync |
| `clock_events:{org_id}` | "Who's Working" widget |
| Presence `org:{org_id}` | Online/idle/offline for messaging |

### Auth & roles

Three roles: `admin`, `manager`, `employee`. Stored in `profiles.role`, embedded in JWT via `custom_access_token_hook`. Check the permission matrix in `02-PRODUCT-REQUIREMENTS.md` §1.2 before implementing any feature.

### Cron jobs (pg_cron / Supabase scheduled functions)

| Job | Schedule |
|-----|---------|
| Time-off accruals | Daily midnight (org timezone) |
| Task instance generation | Daily 6:00 AM (org timezone) |
| Auto clock-out (stale) | Every 30 minutes |
| Skill expiry reminders | Weekly Monday |

### Implementation order

Follow `08-IMPLEMENTATION-ROADMAP.md`. Phases in sequence:
1. **Foundation**: Supabase setup, migrations, RLS, auth, app shell, employee CRUD
2. **Scheduling**: Schedule editor grid, DnD, shift CRUD, publish, templates
3. **Attendance + Time Off**: Clock in/out (GPS/geofence), timesheets, time-off system
4. **Messaging + Tasks**: Real-time chat, checklist templates, task instances, policies
5. **Reports + Polish**: 10 report types, remaining settings, performance, accessibility

## Critical rules

### Database

- Every table with user data has `organization_id` + RLS enabled. No exceptions.
- **RLS is the authorization layer** — never bypass it. If an Edge Function needs admin access, use the service role client explicitly and document why.
- UUID primary keys everywhere (`gen_random_uuid()`).
- `created_at` + `updated_at` on every table, auto-updated via `update_updated_at()` trigger.
- **Soft deletes** for employees (`status = 'inactive'`). Never hard-delete. Historical data must be preserved.
- All times stored in UTC. Display in org timezone via `date-fns-tz` using `organizations.timezone`.
- PostGIS for geolocation: `GEOGRAPHY(POINT, 4326)`, `ST_DWithin()` for geofence checks.
- Regenerate types after any migration: `supabase gen types typescript --project-id $PROJECT_ID > src/types/database.ts`

### Edge Functions

All functions must follow this error format:
```typescript
// Success: { data: ... }  HTTP 200
// Error:   { error: { code, message, details? } }  appropriate HTTP status
// Codes: VALIDATION_ERROR(400) UNAUTHORIZED(401) FORBIDDEN(403) NOT_FOUND(404) CONFLICT(409) INTERNAL_ERROR(500)
```

Edge Function boilerplate:
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      req.headers.get('Authorization')!.replace('Bearer ', '')
    );
    if (authError || !user) throw { code: 'UNAUTHORIZED', message: 'Invalid token' };
    // business logic...
    return new Response(JSON.stringify({ data: result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const status = { UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404 }[err.code] ?? 400;
    return new Response(JSON.stringify({ error: err }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
```

### Audit logging

Every write that changes business data must create an `audit_logs` entry:
```typescript
{ actor_id, action, entity_type, entity_id, changes: { field: { old, new } }, ip_address }
```
Use `_shared/audit.ts` in Edge Functions. For direct Supabase writes, use database triggers.

### Frontend

- **Styling**: Tailwind utility classes only. shadcn/ui as base. No raw CSS files. Custom theme colors via CSS variables in `tailwind.config.ts`. Don't edit `src/components/ui/` (shadcn primitives) directly.
- **Forms**: React Hook Form + Zod schema, defined in the same file as the form component.
- **State**: Zustand for auth/UI state only. TanStack Query for all server data. Never store server data in Zustand.
- **Routes**: React Router v6, defined in `App.tsx`. Role-based route guards wrap protected routes.
- **Realtime**: Clean up subscriptions on component unmount. Use the `useRealtime` hook pattern.
- Never use `any` in TypeScript — use the generated `database.ts` types.

### RLS policy template

```sql
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON table_name FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "admin_write" ON table_name FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    AND organization_id = table_name.organization_id
  ));
```

## Environment variables

```bash
# Frontend (.env)
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_APP_URL=https://app.shiftpro.com

# Edge Functions (Supabase secrets — never in .env, never in frontend)
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...
```

## What NOT to do

- Don't install Express, Fastify, or any Node HTTP framework — backend is Supabase Edge Functions (Deno)
- Don't create a separate auth system — use Supabase Auth exclusively
- Don't store PWA state in localStorage — use Zustand + service worker cache
- Don't write raw SQL in the frontend — use the Supabase JS client
- Don't hard-delete employee records — soft delete via `status = 'inactive'`
- Don't put side-effect logic (notifications, audit logs, multi-table transactions) in the frontend
- Don't skip RLS policies on new tables
- Don't add CSS files — use Tailwind only

# ShiftPro Development Status

**Last updated:** 2026-04-19 (Phase 1 functionally complete)  
**Supabase project ID:** `yeecbnjbtaflxxixvlfq`  
**Working directory:** `shiftpro-web/`

---

## Phase 1 — Foundation: Status

### Completed

| Task | Notes |
|------|-------|
| 1.1 Supabase project | Linked. Project ID: `yeecbnjbtaflxxixvlfq` |
| 1.2 Database migrations | 001–014 applied to production. See migrations section below. |
| 1.3 RLS policies | Applied. **Recursion bug fixed** — see known issues. |
| 1.6 Frontend scaffold | Vite + React 18 + TypeScript + Tailwind + shadcn/ui |
| 1.7 Supabase client | `src/lib/supabase.ts`. Auth auto-refresh enabled. |
| 1.8 Auth pages | Login, Onboarding (org creation), AcceptInvite (invite flow) |
| 1.9 App shell | Sidebar, TopBar, RequireAuth guards (session + role + profileLoaded) |
| 1.10 create-organization | Deployed with `--no-verify-jwt` |
| 1.11 invite-employee | Deployed with `--no-verify-jwt` |
| 1.12 Employee Management UI | EmployeesPage (list, search), InviteModal, EmployeeProfilePage |
| 1.13 TypeScript types | Generated from live schema: `src/types/database.ts` |
| 1.5 Storage buckets | ✅ | avatars, policies, exports, org-assets with RLS via my_organization_id()/my_role() helpers. Migration 017 + 018 (security fix). |
| 1.12 Profile edit form | ✅ | Inline edit. Role-gated fields (admin/manager: name+hire_date+employee_number, admin only: hourly_rate+role+status, self: phone). |
| 1.14 PWA config | ✅ | vite-plugin-pwa configured + all icon files generated via sharp (mask-icon.svg, favicon.ico, apple-touch-icon.png, pwa-192x192.png, pwa-512x512.png). |
| Test infra | ✅ | Vitest + @testing-library/react + jsdom configured. vitest.config.ts + src/test/setup.ts. |
| 018 storage RLS fix | ✅ | Added exports_update policy + WITH CHECK on all UPDATE policies to prevent path manipulation. |

### Remaining for Phase 1

| Task | Priority | Notes |
|------|----------|-------|
| 1.4 JWT hook | Low | Hook exists but doesn't embed claims — **worked around** (see below). Not blocking. |
| ~~1.5 Storage buckets~~ | ~~Medium~~ | ~~Done — see Completed above.~~ |
| ~~1.12 Profile edit form~~ | ~~Medium~~ | ~~Done — see Completed above.~~ |
| ~~1.14 PWA config~~ | ~~Low~~ | ~~Done — see Completed above.~~ |
| 1.15 Railway deployment | Low | No CI/CD pipeline yet. Dev only. Deferred. |

---

## Critical Architecture Decisions Made This Session

### 1. JWT Hook Workaround (IMPORTANT)

**Problem:** Supabase now uses ES256 (ECDSA) JWTs by default. The `custom_access_token_hook` was registered in the Supabase dashboard but is not reliably embedding `organization_id` and `user_role` into `app_metadata`. Root cause is unknown (likely timing or hook configuration issue in the hosted project).

**Workaround implemented (do not revert):**
- **Frontend:** After every auth state change, `loadProfile(userId)` is called (defined in `src/lib/profile.ts`). It queries `profiles` directly via PostgREST and calls `setProfile(organizationId, role)` on the Zustand store.
- **Edge Functions:** `_shared/auth.ts` `requireAuth()` now queries `profiles` via service role client after verifying the user token, instead of reading from `app_metadata`.
- **`profileLoaded: boolean`** flag in `authStore` prevents `RequireAuth` from redirecting until the DB fetch completes. `setSession` resets `profileLoaded: false` so token refreshes don't trigger a flash to `/onboarding`.

**Files involved:**
- `src/lib/profile.ts` — shared `loadProfile()` function
- `src/stores/authStore.ts` — `profileLoaded`, `setProfile`, `setSession` resets to `false`
- `src/components/layout/RequireAuth.tsx` — renders `null` while `!profileLoaded`
- `src/App.tsx` — calls `loadProfile` in `onAuthStateChange` and `getSession`
- `supabase/functions/_shared/auth.ts` — queries profiles via service role

### 2. RLS Recursion Fix (IMPORTANT)

**Problem:** The original `org_isolation_select` RLS policy on `profiles` caused infinite recursion (PostgREST returned 500). The policy queried `profiles` to decide if you could query `profiles`.

**Fix (migration 016):** Two `SECURITY DEFINER` helper functions bypass RLS when reading the current user's org/role. All recursive policies were dropped and rewritten to use these helpers.

```sql
-- src: supabase/migrations/016_fix_profiles_rls_recursion.sql
public.my_organization_id() → uuid   -- returns current user's org_id
public.my_role() → text              -- returns current user's role
```

**Current profile RLS policies:**
- `self_select` — `id = auth.uid()` (non-recursive, always works)
- `org_isolation_select` — `organization_id = public.my_organization_id()`
- `admin_manager_insert` — uses `my_organization_id()` + `my_role()`
- `admin_update_any` — uses `my_organization_id()` + `my_role()`
- `self_update` — `id = auth.uid()` (original, kept)

### 3. ES256 JWT Verification in Edge Functions

**Problem:** Supabase uses ES256 JWTs. Calling `supabase.auth.getUser(token)` with a service role client attempts local HS256 verification and fails with `UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM`.

**Fix:** Use a user-scoped client (anon key + Authorization header), then call `getUser()` with no arguments — the Auth server handles ES256 verification remotely.

```typescript
// Pattern used in _shared/auth.ts
const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: authHeader } }
});
const { data: { user } } = await userClient.auth.getUser(); // no token arg
```

---

## Migrations Applied to Production

| File | Contents |
|------|----------|
| `001_extensions.sql` | uuid-ossp, postgis, pg_trgm, pg_cron; `update_updated_at()` trigger |
| `002_organizations.sql` | `organizations` table. RLS enabled but no policies (deferred to 003) |
| `003_profiles.sql` | `user_role` + `employee_status` enums, `profiles` table, `custom_access_token_hook`, organizations RLS policies |
| `004_positions_job_sites.sql` | `positions`, `profile_positions`, `job_sites` tables |
| `005_schedules_shifts.sql` | Scheduling tables |
| `006_clock_events_timesheets.sql` | Attendance tables |
| `007_timeoff.sql` | Time-off tables |
| `008_messaging.sql` | Messaging tables |
| `009_tasks_policies.sql` | Tasks and policy tables |
| `010_notifications.sql` | Notifications table |
| `011_audit_logs.sql` | Audit log table |
| `012_rls_policies.sql` | Bulk RLS policies for all non-profiles tables |
| `013_functions_triggers.sql` | DB-level functions and triggers |
| `014_seed.sql` | Seed data |
| `015_fix_profiles_rls.sql` | Added `self_select` policy (id = auth.uid()) — precursor to 016 |
| `016_fix_profiles_rls_recursion.sql` | **Full recursion fix** — security definer helpers + rewrote all profile policies |
| `017_storage_buckets.sql` | Created avatars, policies, exports, org-assets buckets with RLS using my_organization_id()/my_role() helpers |
| `018_storage_rls_fix.sql` | Added exports_update policy + WITH CHECK on all UPDATE policies to prevent path manipulation |

---

## Edge Functions Deployed

All deployed to project `yeecbnjbtaflxxixvlfq` with `--no-verify-jwt`.

| Function | Status | Notes |
|----------|--------|-------|
| `create-organization` | ✅ Working | Creates org + admin profile. Signs user out after so fresh login gets profile via DB. |
| `invite-employee` | ✅ Working | Uses `SITE_URL` secret for redirect. Set to `http://localhost:5173`. |
| `_shared/auth.ts` | ✅ Fixed | User-scoped client for ES256 + DB profile lookup for org/role |
| `_shared/audit.ts` | ✅ Ready | Used by invite-employee |
| `_shared/cors.ts` | ✅ Ready | Standard CORS headers |
| All others | 🔲 Scaffolded | Exists as files, not yet deployed or tested (Phase 2+) |

**Supabase secrets set:**
- `SITE_URL=http://localhost:5173` (used by invite-employee for redirect URL)

---

## Auth Flow (as implemented)

### Admin signup / org creation
1. Admin signs up via Supabase Auth (email confirmation enabled)
2. On first login → `RequireAuth` sees no role → redirects to `/onboarding`
3. Admin fills org creation form → calls `create-organization` Edge Function
4. Function creates `organizations` row + `profiles` row (role: admin, status: active)
5. Frontend signs out → redirects to `/login` with success banner
6. Admin logs in fresh → `loadProfile` fetches profile → role set → redirected to `/`

### Employee invite flow
1. Admin opens `/employees` → clicks "Invite employee" → fills InviteModal
2. `invite-employee` Edge Function: verifies admin auth, creates Supabase Auth user, creates `profiles` row (status: invited), sends invite email to `http://localhost:5173/accept-invite`
3. Employee clicks link → lands on `/accept-invite` → sets password
4. `AcceptInvitePage` calls `supabase.auth.updateUser({ password })` → then `profiles.update({ status: 'active' })` → then `loadProfile` → navigates to `/`

### Redirect URL config (Supabase Dashboard)
- **Site URL:** `http://localhost:5173`
- **Allowed redirect URLs:** must include `http://localhost:5173/accept-invite`
- Update both when deploying to production

---

## Key Frontend Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Route tree, auth listener, calls `loadProfile` on every session change |
| `src/lib/profile.ts` | `loadProfile(userId)` — shared helper, queries profiles, calls `setProfile` |
| `src/stores/authStore.ts` | Zustand: session, user, role, organizationId, profileLoaded |
| `src/components/layout/RequireAuth.tsx` | Guards: no session → /login; !profileLoaded → null; no role → /onboarding |
| `src/lib/api.ts` | `callFunction<T>(name, body)` — wraps `supabase.functions.invoke` |
| `src/hooks/useEmployees.ts` | `useEmployees`, `useInviteEmployee`, `useUpdateEmployee` hooks |
| `src/pages/OnboardingPage.tsx` | Org creation form. On success: signOut → navigate('/login') |
| `src/pages/AcceptInvitePage.tsx` | Invite acceptance. Sets password + status active + loadProfile |

---

## Known Issues / Tech Debt

| Issue | Impact | Suggested Fix |
|-------|--------|---------------|
| JWT hook (`custom_access_token_hook`) not embedding claims | Low — worked around | Debug hook registration in Supabase Dashboard → Auth → Hooks. Should show `pg-functions://postgres/public/custom_access_token_hook` |
| `loadProfile` called on every token refresh | Minor perf | Acceptable for now. Add debounce if it causes issues. |
| `SITE_URL` secret is localhost | Blocks production invites | Update secret to production URL before Railway deploy |
| `invite-employee` allows re-inviting after accept | UX | Check status before sending invite |

---

## Running the Project

```bash
# Start frontend dev server
cd shiftpro-web
npm run dev         # http://localhost:5173

# Type check
npm run typecheck

# Regenerate DB types (after any migration)
supabase gen types typescript --project-id yeecbnjbtaflxxixvlfq > src/types/database.ts

# Deploy an Edge Function
supabase functions deploy <function-name> --no-verify-jwt

# Push a new migration
supabase db push
```

---

## Phase 1 Status: Functionally Complete

Phase 1 is functionally complete. All core features (auth, employee management, storage, profile editing, PWA config, test infrastructure) are implemented and passing. Two items remain deferred and are not blocking Phase 2:

- **JWT hook (1.4):** Worked around via DB profile lookup. Revisit when deploying to production.
- **Railway deployment (1.15):** Deferred until Phase 2 or later. Update `SITE_URL` secret before deploying.

## Next Steps — Phase 2: Scheduling

Full schedule editor grid, shift CRUD, drag-and-drop, publish flow. See `08-IMPLEMENTATION-ROADMAP.md`.

Priority order:
1. Schedule editor grid (week view, location/role rows)
2. Shift CRUD (create, edit, delete, copy)
3. Drag-and-drop (reorder, reassign)
4. Publish flow (draft → published → employee notifications)
5. Shift templates

# Phase 1 Completion — Design Spec

**Date:** 2026-04-19
**Status:** Approved
**Scope:** Completing the 3 remaining Phase 1 tasks deferred from earlier sessions.

---

## Context

Phase 1 (Foundation) is ~87% complete. The following tasks remain:

| Task | Priority | Notes |
|------|----------|-------|
| 1.5 Storage buckets | Medium | avatars, policies, exports, org-assets |
| 1.12 Profile edit form | Medium | EmployeeProfilePage is read-only; needs inline edit |
| 1.14 PWA icons | Low | vite-plugin-pwa installed + vite.config.ts configured; only icon files missing |

**Deferred (out of scope for this plan):**
- 1.4 JWT hook — worked around via `loadProfile()` DB query; intentionally deferred
- 1.15 Railway deployment — deferred to end of Phase 1

---

## Task 1: Storage Buckets (1.5)

### Approach
New migration `017_storage_buckets.sql` inserted into `supabase/migrations/`. Creates all 4 buckets via `storage.buckets` insert and applies RLS policies on `storage.objects`.

### Buckets

| Bucket | Public | Purpose |
|--------|--------|---------|
| `avatars` | false | Employee profile photos |
| `policies` | false | Policy document PDFs/files |
| `exports` | false | Report CSV/PDF exports |
| `org-assets` | true | Logos, branding assets |

### Access Policies

**avatars:**
- SELECT: org members can read avatars belonging to their org (path pattern: `{org_id}/*`)
- INSERT/UPDATE: employees can manage their own avatar (`{org_id}/{user_id}/*`); admin/manager can manage any avatar in their org

**policies:**
- SELECT: all org members can read policy documents in their org
- INSERT/UPDATE/DELETE: admin only

**exports:**
- SELECT: the user who created the export can read it (`{org_id}/{user_id}/*`)
- INSERT: admin and manager can create exports for their org

**org-assets:**
- SELECT: public (no auth required — used for logo display on login page)
- INSERT/UPDATE/DELETE: admin only

---

## Task 2: Profile Edit Form (1.12)

### Approach
Inline edit mode on `EmployeeProfilePage`. Single "Edit" button toggles view → form in place. No new route. Uses existing `useUpdateEmployee` hook (already in `useEmployees.ts`). React Hook Form + Zod for validation (both already installed).

### Editable Fields

| Field | Type | Required | Editable by |
|-------|------|----------|-------------|
| `first_name` | text | yes | Admin, Manager |
| `last_name` | text | yes | Admin, Manager |
| `phone` | text | no | Admin, Manager, self |
| `hire_date` | date | no | Admin, Manager |
| `hourly_rate` | number (2dp) | no | Admin only |
| `employee_number` | text | no | Admin, Manager |
| `role` | select | no | Admin only |
| `status` | select | no | Admin only |

`email` is read-only — changing it requires Supabase Auth and is Phase 2+ scope.
Avatar upload is deferred — depends on storage buckets and will be added in the profile edit journey post-Phase 1.

### Role-based visibility
- The "Edit" button is shown to: admin, manager, or the employee viewing their own profile.
- `hourly_rate`, `role`, `status` fields are rendered only when the viewer is an admin.
- Permissions checked via `useAuthStore` (`role`, `user.id`).

### UX Flow
1. Page loads in view mode (current read-only layout).
2. User clicks "Edit" → form inputs replace static values in the same card.
3. On "Save": `useUpdateEmployee` mutation fires → success toast → view mode restored with fresh data.
4. On "Cancel": form discards changes → view mode restored immediately.
5. On error: toast shows error message; form remains open.

### Zod Schema
```ts
const profileSchema = z.object({
  first_name: z.string().min(1, 'Required'),
  last_name: z.string().min(1, 'Required'),
  phone: z.string().optional(),
  hire_date: z.string().optional(),
  hourly_rate: z.coerce.number().min(0).optional().or(z.literal('')),
  employee_number: z.string().optional(),
  role: z.enum(['admin', 'manager', 'employee']).optional(),
  status: z.enum(['active', 'inactive', 'invited']).optional(),
});
```

---

## Task 3: PWA Icons (1.14)

### Context
`vite-plugin-pwa@0.20.0` is already in `devDependencies`. `vite.config.ts` already has the full `VitePWA()` plugin configuration with manifest, workbox rules, and asset references. **No config changes needed** — only the referenced icon files are missing from `public/`.

### Files to Create

| File | Dimensions | Format | Notes |
|------|-----------|--------|-------|
| `public/favicon.ico` | 32×32 | ICO (embedded PNG) | Browser tab |
| `public/apple-touch-icon.png` | 180×180 | PNG | iOS home screen |
| `public/mask-icon.svg` | scalable | SVG (monochrome) | Safari pinned tab |
| `public/pwa-192x192.png` | 192×192 | PNG | Android launcher |
| `public/pwa-512x512.png` | 512×512 | PNG | Splash / maskable |

### Design
ShiftPro "S" monogram, white on dark navy (`#0f172a`) background. Rounded corners on PNG icons. `mask-icon.svg` is monochrome (single path, no fill color — Safari applies its own tint). Consistent with `theme_color: '#0f172a'` in `vite.config.ts`.

### Generation Method
SVG source rendered to PNG via Node canvas or inline base64 encoding. No external tools or services required.

---

## Implementation Order

1. `017_storage_buckets.sql` migration → push to Supabase
2. Profile edit form — update `EmployeeProfilePage.tsx`
3. PWA icons — generate and place in `public/`
4. `npm run typecheck` — verify no TS errors
5. Manual smoke test: edit a profile, confirm save works; verify PWA installable in browser

---

## Definition of Done

- Storage buckets exist in Supabase and RLS policies allow correct access per role
- Admin/manager can edit employee profile fields; employees can edit their own phone
- Admin-only fields (hourly_rate, role, status) hidden from non-admins
- Edit form validates required fields, shows toast on success/error
- PWA installable from Chrome/Edge (install prompt appears); icons render correctly
- `npm run typecheck` passes with 0 errors

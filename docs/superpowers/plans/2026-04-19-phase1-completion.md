# Phase 1 Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the three remaining Phase 1 tasks — Supabase Storage buckets, employee profile inline edit form, and PWA icon files.

**Architecture:** Three independent deliverables in dependency order: (1) a new SQL migration creates the storage buckets with RLS policies; (2) the existing read-only `EmployeeProfilePage` gains an inline edit mode backed by the existing `useUpdateEmployee` hook; (3) PWA icon files are generated from an SVG source using `sharp` and placed in `public/`.

**Tech Stack:** PostgreSQL/Supabase Storage RLS, React Hook Form + Zod, TanStack Query, Zustand, Vitest + @testing-library/react, sharp (icon generation), vite-plugin-pwa (already configured).

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `shiftpro-web/supabase/migrations/017_storage_buckets.sql` | Create | Bucket creation + RLS policies |
| `shiftpro-web/src/hooks/useEmployees.ts` | Modify | Invalidate `['employee', id]` on update |
| `shiftpro-web/src/pages/EmployeeProfilePage.tsx` | Rewrite | Add inline edit form |
| `shiftpro-web/src/pages/EmployeeProfilePage.test.tsx` | Create | Schema + render tests |
| `shiftpro-web/vitest.config.ts` | Create | jsdom environment for component tests |
| `shiftpro-web/src/test/setup.ts` | Create | @testing-library/jest-dom matchers |
| `shiftpro-web/public/mask-icon.svg` | Create | Safari pinned-tab icon (monochrome SVG) |
| `shiftpro-web/scripts/generate-icons.mjs` | Create | Node script to generate PNG icons via sharp |
| `shiftpro-web/public/favicon.ico` | Generate | 32×32 browser tab icon |
| `shiftpro-web/public/apple-touch-icon.png` | Generate | 180×180 iOS home screen icon |
| `shiftpro-web/public/pwa-192x192.png` | Generate | 192×192 Android launcher icon |
| `shiftpro-web/public/pwa-512x512.png` | Generate | 512×512 splash/maskable icon |

---

## Task 1: Storage Buckets Migration

**Files:**
- Create: `shiftpro-web/supabase/migrations/017_storage_buckets.sql`

- [ ] **Step 1: Create the migration file**

  Create `shiftpro-web/supabase/migrations/017_storage_buckets.sql` with this exact content:

  ```sql
  -- Create the four storage buckets
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES
    ('avatars',    'avatars',    false, 5242880,  ARRAY['image/jpeg','image/png','image/webp','image/gif']),
    ('policies',   'policies',   false, 52428800, ARRAY['application/pdf','image/jpeg','image/png']),
    ('exports',    'exports',    false, 52428800, ARRAY['text/csv','application/pdf']),
    ('org-assets', 'org-assets', true,  5242880,  ARRAY['image/jpeg','image/png','image/webp','image/svg+xml'])
  ON CONFLICT (id) DO NOTHING;

  -- ─────────────────────────────────────────
  -- avatars: org members read; owner or admin/manager write
  -- Path convention: {org_id}/{user_id}/filename
  -- ─────────────────────────────────────────
  CREATE POLICY "avatars_select" ON storage.objects FOR SELECT
    USING (
      bucket_id = 'avatars'
      AND (storage.foldername(name))[1] = public.my_organization_id()::text
    );

  CREATE POLICY "avatars_insert" ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'avatars'
      AND (storage.foldername(name))[1] = public.my_organization_id()::text
      AND (
        (storage.foldername(name))[2] = auth.uid()::text
        OR public.my_role() IN ('admin', 'manager')
      )
    );

  CREATE POLICY "avatars_update" ON storage.objects FOR UPDATE
    USING (
      bucket_id = 'avatars'
      AND (storage.foldername(name))[1] = public.my_organization_id()::text
      AND (
        (storage.foldername(name))[2] = auth.uid()::text
        OR public.my_role() IN ('admin', 'manager')
      )
    );

  CREATE POLICY "avatars_delete" ON storage.objects FOR DELETE
    USING (
      bucket_id = 'avatars'
      AND (storage.foldername(name))[1] = public.my_organization_id()::text
      AND (
        (storage.foldername(name))[2] = auth.uid()::text
        OR public.my_role() IN ('admin', 'manager')
      )
    );

  -- ─────────────────────────────────────────
  -- policies: all org members read; admin only write
  -- Path convention: {org_id}/filename
  -- ─────────────────────────────────────────
  CREATE POLICY "policies_select" ON storage.objects FOR SELECT
    USING (
      bucket_id = 'policies'
      AND (storage.foldername(name))[1] = public.my_organization_id()::text
    );

  CREATE POLICY "policies_insert" ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'policies'
      AND (storage.foldername(name))[1] = public.my_organization_id()::text
      AND public.my_role() = 'admin'
    );

  CREATE POLICY "policies_update" ON storage.objects FOR UPDATE
    USING (
      bucket_id = 'policies'
      AND (storage.foldername(name))[1] = public.my_organization_id()::text
      AND public.my_role() = 'admin'
    );

  CREATE POLICY "policies_delete" ON storage.objects FOR DELETE
    USING (
      bucket_id = 'policies'
      AND (storage.foldername(name))[1] = public.my_organization_id()::text
      AND public.my_role() = 'admin'
    );

  -- ─────────────────────────────────────────
  -- exports: owner reads own exports; admin/manager write
  -- Path convention: {org_id}/{user_id}/filename
  -- ─────────────────────────────────────────
  CREATE POLICY "exports_select" ON storage.objects FOR SELECT
    USING (
      bucket_id = 'exports'
      AND (storage.foldername(name))[1] = public.my_organization_id()::text
      AND (storage.foldername(name))[2] = auth.uid()::text
    );

  CREATE POLICY "exports_insert" ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'exports'
      AND (storage.foldername(name))[1] = public.my_organization_id()::text
      AND public.my_role() IN ('admin', 'manager')
    );

  CREATE POLICY "exports_delete" ON storage.objects FOR DELETE
    USING (
      bucket_id = 'exports'
      AND (storage.foldername(name))[1] = public.my_organization_id()::text
      AND public.my_role() IN ('admin', 'manager')
    );

  -- ─────────────────────────────────────────
  -- org-assets: public read (no auth); admin only write
  -- Path convention: {org_id}/filename
  -- ─────────────────────────────────────────
  CREATE POLICY "org_assets_insert" ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'org-assets'
      AND (storage.foldername(name))[1] = public.my_organization_id()::text
      AND public.my_role() = 'admin'
    );

  CREATE POLICY "org_assets_update" ON storage.objects FOR UPDATE
    USING (
      bucket_id = 'org-assets'
      AND (storage.foldername(name))[1] = public.my_organization_id()::text
      AND public.my_role() = 'admin'
    );

  CREATE POLICY "org_assets_delete" ON storage.objects FOR DELETE
    USING (
      bucket_id = 'org-assets'
      AND (storage.foldername(name))[1] = public.my_organization_id()::text
      AND public.my_role() = 'admin'
    );
  ```

  > `public.my_organization_id()` and `public.my_role()` are the `SECURITY DEFINER` helpers defined in migration `016_fix_profiles_rls_recursion.sql`. They avoid RLS recursion.

- [ ] **Step 2: Push the migration**

  ```bash
  cd shiftpro-web
  supabase db push
  ```

  Expected output ends with something like:
  ```
  Applying migration 017_storage_buckets.sql...done
  ```

- [ ] **Step 3: Verify buckets exist**

  In the Supabase Dashboard → Storage, confirm all four buckets appear: `avatars`, `policies`, `exports`, `org-assets`. The `org-assets` bucket should show a globe icon (public).

- [ ] **Step 4: Commit**

  ```bash
  git add shiftpro-web/supabase/migrations/017_storage_buckets.sql
  git commit -m "feat: add storage buckets with RLS policies (1.5)"
  ```

---

## Task 2: Test Infrastructure Setup

**Files:**
- Create: `shiftpro-web/vitest.config.ts`
- Create: `shiftpro-web/src/test/setup.ts`

- [ ] **Step 1: Install testing dependencies**

  ```bash
  cd shiftpro-web
  npm install --save-dev @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
  ```

  Expected: packages added to `devDependencies` in `package.json`.

- [ ] **Step 2: Create `shiftpro-web/vitest.config.ts`**

  ```ts
  import { defineConfig } from 'vitest/config';
  import react from '@vitejs/plugin-react';
  import path from 'path';

  export default defineConfig({
    plugins: [react()],
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      globals: true,
    },
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
  });
  ```

- [ ] **Step 3: Create `shiftpro-web/src/test/setup.ts`**

  ```ts
  import '@testing-library/jest-dom';
  ```

- [ ] **Step 4: Verify setup works**

  ```bash
  cd shiftpro-web
  npm test -- --run
  ```

  Expected output: `No test files found` (zero tests yet, no errors).

- [ ] **Step 5: Commit**

  ```bash
  git add shiftpro-web/vitest.config.ts shiftpro-web/src/test/setup.ts shiftpro-web/package.json shiftpro-web/package-lock.json
  git commit -m "chore: add component test infrastructure (jsdom + testing-library)"
  ```

---

## Task 3: Profile Edit — Schema + Hook

**Files:**
- Create: `shiftpro-web/src/pages/EmployeeProfilePage.test.tsx`
- Modify: `shiftpro-web/src/hooks/useEmployees.ts`

- [ ] **Step 1: Write failing schema tests**

  Create `shiftpro-web/src/pages/EmployeeProfilePage.test.tsx`:

  ```tsx
  import { describe, it, expect } from 'vitest';
  import { profileSchema } from './EmployeeProfilePage';

  describe('profileSchema', () => {
    it('rejects empty first_name', () => {
      const result = profileSchema.safeParse({ first_name: '', last_name: 'Smith' });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe('Required');
    });

    it('rejects empty last_name', () => {
      const result = profileSchema.safeParse({ first_name: 'Jane', last_name: '' });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe('Required');
    });

    it('accepts valid minimal input', () => {
      const result = profileSchema.safeParse({ first_name: 'Jane', last_name: 'Smith' });
      expect(result.success).toBe(true);
    });

    it('coerces hourly_rate string to number', () => {
      const result = profileSchema.safeParse({
        first_name: 'Jane',
        last_name: 'Smith',
        hourly_rate: '25.50',
      });
      expect(result.success).toBe(true);
      expect(result.data?.hourly_rate).toBe(25.5);
    });

    it('accepts empty string for optional fields', () => {
      const result = profileSchema.safeParse({
        first_name: 'Jane',
        last_name: 'Smith',
        phone: '',
        hire_date: '',
        employee_number: '',
      });
      expect(result.success).toBe(true);
    });
  });
  ```

- [ ] **Step 2: Run tests — expect them to FAIL**

  ```bash
  cd shiftpro-web
  npm test -- --run src/pages/EmployeeProfilePage.test.tsx
  ```

  Expected failure: `SyntaxError: The requested module '…/EmployeeProfilePage' does not provide an export named 'profileSchema'`

- [ ] **Step 3: Export `profileSchema` from `EmployeeProfilePage.tsx`**

  Add this to the TOP of `shiftpro-web/src/pages/EmployeeProfilePage.tsx` (above the component function, keep everything else as-is for now):

  ```tsx
  import { z } from 'zod';

  export const profileSchema = z.object({
    first_name: z.string().min(1, 'Required'),
    last_name: z.string().min(1, 'Required'),
    phone: z.string().optional().or(z.literal('')),
    hire_date: z.string().optional().or(z.literal('')),
    hourly_rate: z.coerce.number().min(0).optional().or(z.literal('')),
    employee_number: z.string().optional().or(z.literal('')),
    role: z.enum(['admin', 'manager', 'employee']).optional(),
    status: z.enum(['active', 'inactive', 'invited']).optional(),
  });

  export type ProfileFormValues = z.infer<typeof profileSchema>;
  ```

- [ ] **Step 4: Run tests — expect them to PASS**

  ```bash
  npm test -- --run src/pages/EmployeeProfilePage.test.tsx
  ```

  Expected: `5 passed`.

- [ ] **Step 5: Update `useUpdateEmployee` to also invalidate the single-employee query**

  In `shiftpro-web/src/hooks/useEmployees.ts`, replace the `useUpdateEmployee` function:

  ```ts
  export function useUpdateEmployee() {
    const qc = useQueryClient();
    const { organizationId } = useAuthStore();

    return useMutation({
      mutationFn: async ({ id, updates }: { id: string; updates: ProfileUpdate }) => {
        const { error } = await supabase.from('profiles').update(updates).eq('id', id);
        if (error) throw error;
        return id;
      },
      onSuccess: (id) => {
        qc.invalidateQueries({ queryKey: ['employees', organizationId] });
        qc.invalidateQueries({ queryKey: ['employee', id] });
      },
    });
  }
  ```

- [ ] **Step 6: Typecheck**

  ```bash
  npm run typecheck
  ```

  Expected: no errors.

- [ ] **Step 7: Commit**

  ```bash
  git add shiftpro-web/src/pages/EmployeeProfilePage.test.tsx shiftpro-web/src/pages/EmployeeProfilePage.tsx shiftpro-web/src/hooks/useEmployees.ts
  git commit -m "feat: profileSchema + useUpdateEmployee invalidates single-employee cache"
  ```

---

## Task 4: Profile Edit — Full UI

**Files:**
- Rewrite: `shiftpro-web/src/pages/EmployeeProfilePage.tsx`

- [ ] **Step 1: Replace `EmployeeProfilePage.tsx` with the full implementation**

  Replace the entire file content (keep the `profileSchema` and `ProfileFormValues` exports at the top):

  ```tsx
  import { useParams, Link } from 'react-router-dom';
  import { useQuery } from '@tanstack/react-query';
  import { useState } from 'react';
  import { useForm } from 'react-hook-form';
  import { zodResolver } from '@hookform/resolvers/zod';
  import { z } from 'zod';
  import { format } from 'date-fns';
  import { supabase } from '@/lib/supabase';
  import { useUpdateEmployee } from '@/hooks/useEmployees';
  import { useAuthStore } from '@/stores/authStore';

  export const profileSchema = z.object({
    first_name: z.string().min(1, 'Required'),
    last_name: z.string().min(1, 'Required'),
    phone: z.string().optional().or(z.literal('')),
    hire_date: z.string().optional().or(z.literal('')),
    hourly_rate: z.coerce.number().min(0).optional().or(z.literal('')),
    employee_number: z.string().optional().or(z.literal('')),
    role: z.enum(['admin', 'manager', 'employee']).optional(),
    status: z.enum(['active', 'inactive', 'invited']).optional(),
  });

  export type ProfileFormValues = z.infer<typeof profileSchema>;

  export function EmployeeProfilePage() {
    const { id } = useParams<{ id: string }>();
    const { role: viewerRole, user } = useAuthStore();
    const [isEditing, setIsEditing] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const updateEmployee = useUpdateEmployee();

    const { data: employee, isLoading } = useQuery({
      queryKey: ['employee', id],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*, profile_positions(position_id, positions(id, name, color))')
          .eq('id', id!)
          .single();
        if (error) throw error;
        return data;
      },
      enabled: !!id,
    });

    const {
      register,
      handleSubmit,
      reset,
      formState: { errors, isSubmitting },
    } = useForm<ProfileFormValues>({
      resolver: zodResolver(profileSchema),
      values: employee
        ? {
            first_name: employee.first_name,
            last_name: employee.last_name,
            phone: employee.phone ?? '',
            hire_date: employee.hire_date ?? '',
            hourly_rate: employee.hourly_rate ?? '',
            employee_number: employee.employee_number ?? '',
            role: employee.role,
            status: employee.status,
          }
        : undefined,
    });

    const isAdmin = viewerRole === 'admin';
    const isAdminOrManager = viewerRole === 'admin' || viewerRole === 'manager';
    const isSelf = user?.id === id;
    const canEdit = isAdminOrManager || isSelf;

    async function onSubmit(values: ProfileFormValues) {
      if (!id) return;
      setSaveError(null);
      setSaveSuccess(false);

      const updates: Record<string, unknown> = {
        phone: values.phone || null,
      };

      if (isAdminOrManager) {
        updates.first_name = values.first_name;
        updates.last_name = values.last_name;
        updates.hire_date = values.hire_date || null;
        updates.employee_number = values.employee_number || null;
      }

      if (isAdmin) {
        updates.hourly_rate =
          values.hourly_rate === '' || values.hourly_rate === undefined
            ? null
            : Number(values.hourly_rate);
        if (values.role) updates.role = values.role;
        if (values.status) updates.status = values.status;
      }

      try {
        await updateEmployee.mutateAsync({ id, updates });
        setSaveSuccess(true);
        setIsEditing(false);
      } catch (err: unknown) {
        setSaveError(err instanceof Error ? err.message : 'Save failed.');
      }
    }

    function handleCancel() {
      reset();
      setSaveError(null);
      setIsEditing(false);
    }

    if (isLoading) return <p className="text-muted-foreground text-sm">Loading…</p>;
    if (!employee) return <p className="text-destructive text-sm">Employee not found.</p>;

    return (
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/employees" className="text-sm text-muted-foreground hover:text-foreground">
            ← Employees
          </Link>
        </div>

        {saveSuccess && (
          <div className="rounded-md bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-800">
            Profile saved.
          </div>
        )}

        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
                {employee.first_name[0]}
                {employee.last_name[0]}
              </div>
              <div>
                <h1 className="text-xl font-bold">
                  {employee.first_name} {employee.last_name}
                </h1>
                <p className="text-sm text-muted-foreground capitalize">
                  {employee.role} · {employee.status}
                </p>
              </div>
            </div>
            {canEdit && !isEditing && (
              <button
                onClick={() => { setSaveSuccess(false); setIsEditing(true); }}
                className="text-sm font-medium text-primary hover:underline"
              >
                Edit
              </button>
            )}
          </div>

          {/* View mode */}
          {!isEditing && (
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
              {[
                ['Email', employee.email],
                ['Phone', employee.phone ?? '—'],
                ['Employee #', employee.employee_number ?? '—'],
                [
                  'Hire date',
                  employee.hire_date
                    ? format(new Date(employee.hire_date), 'MMM d, yyyy')
                    : '—',
                ],
                ['Hourly rate', employee.hourly_rate ? `$${employee.hourly_rate}/hr` : '—'],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-sm font-medium mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Edit form */}
          {isEditing && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2 border-t border-border">
              <div className="grid grid-cols-2 gap-4">
                {/* first_name — admin/manager only */}
                {isAdminOrManager && (
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      First name <span className="text-destructive">*</span>
                    </label>
                    <input
                      {...register('first_name')}
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    {errors.first_name && (
                      <p className="text-xs text-destructive mt-0.5">{errors.first_name.message}</p>
                    )}
                  </div>
                )}

                {/* last_name — admin/manager only */}
                {isAdminOrManager && (
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      Last name <span className="text-destructive">*</span>
                    </label>
                    <input
                      {...register('last_name')}
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    {errors.last_name && (
                      <p className="text-xs text-destructive mt-0.5">{errors.last_name.message}</p>
                    )}
                  </div>
                )}

                {/* phone — all users who can edit */}
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Phone</label>
                  <input
                    {...register('phone')}
                    type="tel"
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {/* employee_number — admin/manager only */}
                {isAdminOrManager && (
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Employee #</label>
                    <input
                      {...register('employee_number')}
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                )}

                {/* hire_date — admin/manager only */}
                {isAdminOrManager && (
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Hire date</label>
                    <input
                      {...register('hire_date')}
                      type="date"
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                )}

                {/* admin-only fields */}
                {isAdmin && (
                  <>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">
                        Hourly rate ($)
                      </label>
                      <input
                        {...register('hourly_rate')}
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      {errors.hourly_rate && (
                        <p className="text-xs text-destructive mt-0.5">
                          {errors.hourly_rate.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Role</label>
                      <select
                        {...register('role')}
                        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="employee">Employee</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Status</label>
                      <select
                        {...register('status')}
                        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="invited">Invited</option>
                      </select>
                    </div>
                  </>
                )}
              </div>

              {saveError && (
                <p className="text-sm text-destructive">{saveError}</p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-md border border-border px-4 py-1.5 text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: Run all tests**

  ```bash
  cd shiftpro-web
  npm test -- --run
  ```

  Expected: `5 passed` (schema tests still passing, no regressions).

- [ ] **Step 3: Typecheck**

  ```bash
  npm run typecheck
  ```

  Expected: 0 errors.

- [ ] **Step 4: Manual smoke test**

  Start the dev server (`npm run dev`), log in as admin, navigate to an employee profile. Verify:
  - "Edit" button appears
  - Clicking Edit shows the form with pre-filled values
  - Clearing first_name and saving shows "Required" error inline
  - Filling valid values and saving shows "Profile saved." banner and returns to view mode
  - Clicking Cancel discards changes and returns to view mode
  - `hourly_rate`, `role`, `status` fields only appear when logged in as admin

- [ ] **Step 5: Commit**

  ```bash
  git add shiftpro-web/src/pages/EmployeeProfilePage.tsx
  git commit -m "feat: inline profile edit form for EmployeeProfilePage (1.12)"
  ```

---

## Task 5: PWA Icons

**Files:**
- Create: `shiftpro-web/public/mask-icon.svg`
- Create: `shiftpro-web/scripts/generate-icons.mjs`
- Generate: `shiftpro-web/public/favicon.ico`, `apple-touch-icon.png`, `pwa-192x192.png`, `pwa-512x512.png`

- [ ] **Step 1: Create `shiftpro-web/public/mask-icon.svg`**

  This file is referenced by name in `vite.config.ts` and doubles as the Safari pinned-tab icon. It must be monochrome (Safari applies its own tint color):

  ```svg
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <text
      x="50%"
      y="62%"
      dominant-baseline="middle"
      text-anchor="middle"
      font-family="system-ui, -apple-system, sans-serif"
      font-weight="700"
      font-size="320"
      fill="#000000"
    >S</text>
  </svg>
  ```

- [ ] **Step 2: Install `sharp`**

  ```bash
  cd shiftpro-web
  npm install --save-dev sharp
  ```

  Expected: `sharp` appears in `devDependencies`.

- [ ] **Step 3: Create `shiftpro-web/scripts/generate-icons.mjs`**

  ```js
  import sharp from 'sharp';

  // SVG source: white "S" on dark navy background with rounded corners
  const svg = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <rect width="512" height="512" rx="80" ry="80" fill="#0f172a"/>
    <text
      x="50%"
      y="62%"
      dominant-baseline="middle"
      text-anchor="middle"
      font-family="system-ui, -apple-system, sans-serif"
      font-weight="700"
      font-size="320"
      fill="#ffffff"
    >S</text>
  </svg>
  `);

  const icons = [
    { file: 'public/pwa-192x192.png',      size: 192 },
    { file: 'public/pwa-512x512.png',      size: 512 },
    { file: 'public/apple-touch-icon.png', size: 180 },
    { file: 'public/favicon.ico',          size: 32  },
  ];

  for (const { file, size } of icons) {
    await sharp(svg).resize(size, size).png().toFile(file);
    console.log(`✓ ${file}`);
  }
  ```

  > `favicon.ico` is written as a PNG with an `.ico` extension. All modern browsers (Chrome, Firefox, Safari, Edge) accept PNG bytes in `.ico` files.

- [ ] **Step 4: Run the generation script**

  ```bash
  cd shiftpro-web
  node scripts/generate-icons.mjs
  ```

  Expected output:
  ```
  ✓ public/pwa-192x192.png
  ✓ public/pwa-512x512.png
  ✓ public/apple-touch-icon.png
  ✓ public/favicon.ico
  ```

  Verify the files exist:
  ```bash
  ls -lh public/*.png public/*.ico public/*.svg
  ```

- [ ] **Step 5: Verify PWA build**

  ```bash
  npm run build
  ```

  Expected: build succeeds. Check that `dist/manifest.webmanifest` (or `dist/site.webmanifest`) exists and references the icon files.

- [ ] **Step 6: Verify PWA installability**

  ```bash
  npm run dev
  ```

  Open `http://localhost:5173` in Chrome. Open DevTools → Application → Manifest. Confirm:
  - App name: `ShiftPro`
  - Icons: 192×192 and 512×512 both show previews
  - No manifest errors in the console

- [ ] **Step 7: Commit**

  ```bash
  git add shiftpro-web/public/mask-icon.svg \
          shiftpro-web/public/pwa-192x192.png \
          shiftpro-web/public/pwa-512x512.png \
          shiftpro-web/public/apple-touch-icon.png \
          shiftpro-web/public/favicon.ico \
          shiftpro-web/scripts/generate-icons.mjs \
          shiftpro-web/package.json \
          shiftpro-web/package-lock.json
  git commit -m "feat: PWA icons — favicon, apple-touch, pwa-192, pwa-512, mask-icon (1.14)"
  ```

---

## Task 6: Final Verification

- [ ] **Step 1: Run full test suite**

  ```bash
  cd shiftpro-web
  npm test -- --run
  ```

  Expected: all tests pass, 0 failures.

- [ ] **Step 2: Full typecheck**

  ```bash
  npm run typecheck
  ```

  Expected: 0 errors.

- [ ] **Step 3: Update DEVELOPMENT-STATUS.md**

  In `DEVELOPMENT-STATUS.md`, move tasks `1.5`, `1.12`, and `1.14` from "Remaining for Phase 1" to "Completed":

  ```markdown
  | 1.5 Storage buckets | ✅ | avatars, policies, exports, org-assets. RLS via my_organization_id()/my_role() helpers. |
  | 1.12 Profile edit form | ✅ | Inline edit. Admin-only fields gated by role. |
  | 1.14 PWA config | ✅ | vite-plugin-pwa configured + all icon files generated. |
  ```

  Also update "Next Steps" to reflect Phase 1 is complete (only Railway deploy + JWT hook remain deferred).

- [ ] **Step 4: Commit status update**

  ```bash
  cd /path/to/repo/root
  git add DEVELOPMENT-STATUS.md
  git commit -m "docs: mark Phase 1 tasks 1.5, 1.12, 1.14 complete"
  ```

---

## Definition of Done Checklist

- [ ] All four storage buckets exist in Supabase with correct RLS policies
- [ ] Admin/manager can open an employee profile and edit first name, last name, phone, hire date, employee number
- [ ] Admin additionally sees and can edit hourly rate, role, status
- [ ] Employees viewing their **own** profile see only the phone field in edit mode (not name, hire date, etc.)
- [ ] Edit form validates required fields inline; shows success/error feedback
- [ ] Cancel discards changes with no side effects
- [ ] PWA installable from Chrome/Edge (install prompt appears in address bar)
- [ ] Manifest shows correct app name and icon previews in DevTools → Application
- [ ] `npm run typecheck` — 0 errors
- [ ] `npm test -- --run` — all tests pass

-- Profiles RLS policies that subquery profiles cause infinite recursion (500 from PostgREST).
-- Fix: security-definer helper functions that bypass RLS when reading profiles.

drop policy if exists "org_isolation_select" on profiles;
drop policy if exists "admin_manager_insert" on profiles;
drop policy if exists "admin_update_any" on profiles;
drop policy if exists "self_select" on profiles;

-- These run as postgres (superuser) so they bypass RLS — breaking the recursion cycle.
create or replace function public.my_organization_id()
returns uuid language sql stable security definer
set search_path = public
as $$ select organization_id from profiles where id = auth.uid() limit 1 $$;

create or replace function public.my_role()
returns text language sql stable security definer
set search_path = public
as $$ select role::text from profiles where id = auth.uid() limit 1 $$;

-- Users can always read their own row (non-recursive, needed on first login before org is known)
create policy "self_select" on profiles for select
  using (id = auth.uid());

-- Users can read all profiles in their org
create policy "org_isolation_select" on profiles for select
  using (organization_id = public.my_organization_id());

-- Admins and managers can create profiles in their org
create policy "admin_manager_insert" on profiles for insert
  with check (
    organization_id = public.my_organization_id()
    and public.my_role() in ('admin', 'manager')
  );

-- Admins can update any profile in their org
create policy "admin_update_any" on profiles for update
  using (
    organization_id = public.my_organization_id()
    and public.my_role() = 'admin'
  );

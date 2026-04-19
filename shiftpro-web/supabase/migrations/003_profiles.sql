create type user_role as enum ('admin', 'manager', 'employee');
create type employee_status as enum ('active', 'inactive', 'invited');

create table profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  organization_id   uuid not null references organizations(id) on delete cascade,
  role              user_role not null default 'employee',
  status            employee_status not null default 'invited',
  first_name        text not null,
  last_name         text not null,
  email             text not null,
  phone             text,
  avatar_url        text,
  employee_number   text,
  hire_date         date,
  hourly_rate       numeric(10,2),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index profiles_org_idx on profiles(organization_id);
create index profiles_email_idx on profiles(email);

create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();

alter table profiles enable row level security;

create policy "org_isolation_select" on profiles for select
  using (organization_id = (select organization_id from profiles where id = auth.uid()));

create policy "admin_manager_insert" on profiles for insert
  with check (
    organization_id = (select organization_id from profiles p2 where p2.id = auth.uid())
    and (select role from profiles p2 where p2.id = auth.uid()) in ('admin','manager')
  );

create policy "admin_update_any" on profiles for update
  using (
    organization_id = (select organization_id from profiles p2 where p2.id = auth.uid())
    and (select role from profiles p2 where p2.id = auth.uid()) = 'admin'
  );

create policy "self_update" on profiles for update
  using (id = auth.uid());

-- Embeds organization_id and user_role into the JWT
-- SECURITY DEFINER so it runs as postgres and bypasses RLS on profiles
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable
security definer
set search_path = public
as $$
declare
  claims jsonb;
  user_profile record;
begin
  select organization_id, role into user_profile
  from public.profiles where id = (event->>'user_id')::uuid;

  claims := event->'claims';

  if user_profile.organization_id is not null then
    claims := jsonb_set(claims, '{app_metadata,organization_id}', to_jsonb(user_profile.organization_id::text));
    claims := jsonb_set(claims, '{app_metadata,user_role}', to_jsonb(user_profile.role::text));
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function custom_access_token_hook to supabase_auth_admin;
revoke execute on function custom_access_token_hook from authenticated, anon, public;

-- Organizations RLS (deferred here because policies reference profiles)
create policy "org_members_read" on organizations for select
  using (id in (select organization_id from profiles where id = auth.uid()));

create policy "org_admin_update" on organizations for update
  using (id in (select organization_id from profiles where id = auth.uid() and role = 'admin'));

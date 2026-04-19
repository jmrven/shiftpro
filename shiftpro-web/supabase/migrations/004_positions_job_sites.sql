create table positions (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  name             text not null,
  color            text not null default '#6366f1',
  default_rate     numeric(10,2),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index positions_org_idx on positions(organization_id);

create trigger positions_updated_at
  before update on positions
  for each row execute function update_updated_at();

alter table positions enable row level security;

create policy "org_isolation" on positions for all
  using (organization_id = (select organization_id from profiles where id = auth.uid()));

create policy "admin_manager_write" on positions for insert
  with check (
    organization_id = (select organization_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) in ('admin','manager')
  );

create table profile_positions (
  profile_id   uuid not null references profiles(id) on delete cascade,
  position_id  uuid not null references positions(id) on delete cascade,
  primary key (profile_id, position_id)
);

alter table profile_positions enable row level security;

create policy "org_isolation" on profile_positions for all
  using (
    profile_id in (
      select id from profiles
      where organization_id = (select organization_id from profiles where id = auth.uid())
    )
  );

create table job_sites (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  name             text not null,
  address          text,
  location         geography(point, 4326),
  geofence_radius  integer not null default 200,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index job_sites_org_idx on job_sites(organization_id);
create index job_sites_location_idx on job_sites using gist(location);

create trigger job_sites_updated_at
  before update on job_sites
  for each row execute function update_updated_at();

alter table job_sites enable row level security;

create policy "org_isolation" on job_sites for all
  using (organization_id = (select organization_id from profiles where id = auth.uid()));

create policy "admin_write" on job_sites for insert
  with check (
    organization_id = (select organization_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) = 'admin'
  );

-- New enum types for scheduling
do $$ begin
  create type shift_status as enum ('draft', 'published');
exception when duplicate_object then null; end $$;

do $$ begin
  create type request_type as enum ('swap', 'offer', 'drop', 'open_shift');
exception when duplicate_object then null; end $$;

do $$ begin
  create type request_status as enum ('pending', 'approved', 'denied', 'canceled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type day_of_week as enum ('sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday');
exception when duplicate_object then null; end $$;

-- Schedules (teams / locations)
create table if not exists schedules (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  color           text not null default '#3B82F6',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(organization_id, name)
);
create index if not exists idx_schedules_org on schedules(organization_id);
create trigger schedules_updated_at before update on schedules
  for each row execute function update_updated_at();

-- Employee ↔ Schedule membership + sort order
create table if not exists employee_schedules (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  schedule_id uuid not null references schedules(id) on delete cascade,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  unique(profile_id, schedule_id)
);
create index if not exists idx_emp_sched_profile   on employee_schedules(profile_id);
create index if not exists idx_emp_sched_schedule  on employee_schedules(schedule_id);

-- Manager ↔ Schedule
create table if not exists manager_schedules (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  schedule_id uuid not null references schedules(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique(profile_id, schedule_id)
);

-- Shifts
create table if not exists shifts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  schedule_id     uuid not null references schedules(id) on delete cascade,
  profile_id      uuid references profiles(id) on delete set null,
  position_id     uuid references positions(id) on delete set null,
  job_site_id     uuid references job_sites(id) on delete set null,
  start_time      timestamptz not null,
  end_time        timestamptz not null,
  break_minutes   integer not null default 0,
  notes           text,
  status          shift_status not null default 'draft',
  is_open_shift   boolean not null default false,
  color           text,
  created_by      uuid references profiles(id) on delete set null,
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint valid_shift_times check (end_time > start_time)
);
create index if not exists idx_shifts_org      on shifts(organization_id);
create index if not exists idx_shifts_schedule on shifts(schedule_id);
create index if not exists idx_shifts_profile  on shifts(profile_id);
create index if not exists idx_shifts_time     on shifts(schedule_id, start_time, end_time);
create index if not exists idx_shifts_open     on shifts(schedule_id, is_open_shift) where is_open_shift = true;
create trigger shifts_updated_at before update on shifts
  for each row execute function update_updated_at();

-- Schedule Templates
create table if not exists schedule_templates (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  schedule_id     uuid not null references schedules(id) on delete cascade,
  name            text not null,
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger schedule_templates_updated_at before update on schedule_templates
  for each row execute function update_updated_at();

create table if not exists schedule_template_shifts (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references schedule_templates(id) on delete cascade,
  position_id   uuid references positions(id) on delete set null,
  day_of_week   day_of_week not null,
  start_time    time not null,
  end_time      time not null,
  break_minutes integer not null default 0,
  notes         text,
  created_at    timestamptz not null default now()
);

-- Shift Requests
create table if not exists shift_requests (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  type              request_type not null,
  status            request_status not null default 'pending',
  requester_id      uuid not null references profiles(id) on delete restrict,
  shift_id          uuid not null references shifts(id) on delete cascade,
  target_shift_id   uuid references shifts(id) on delete set null,
  target_profile_id uuid references profiles(id) on delete set null,
  manager_note      text,
  requester_note    text,
  reviewed_by       uuid references profiles(id) on delete set null,
  reviewed_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_shift_req_org       on shift_requests(organization_id);
create index if not exists idx_shift_req_status    on shift_requests(organization_id, status);
create index if not exists idx_shift_req_requester on shift_requests(requester_id);
create index if not exists idx_template_shifts_template on schedule_template_shifts(template_id);
create index if not exists idx_templates_org      on schedule_templates(organization_id);
create index if not exists idx_templates_schedule on schedule_templates(schedule_id);
create trigger shift_requests_updated_at before update on shift_requests
  for each row execute function update_updated_at();

-- Employee Availability
create table if not exists employee_availability (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references profiles(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  day_of_week     day_of_week not null,
  is_available    boolean not null default true,
  start_time      time,
  end_time        time,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(profile_id, day_of_week)
);
create index if not exists idx_availability_profile on employee_availability(profile_id);
create trigger employee_availability_updated_at before update on employee_availability
  for each row execute function update_updated_at();

-- RLS --

alter table schedules               enable row level security;
alter table employee_schedules      enable row level security;
alter table manager_schedules       enable row level security;
alter table shifts                  enable row level security;
alter table schedule_templates      enable row level security;
alter table schedule_template_shifts enable row level security;
alter table shift_requests          enable row level security;
alter table employee_availability   enable row level security;

-- schedules
create policy "schedules_read" on schedules for select
  using (organization_id = (select organization_id from profiles where id = auth.uid()));
create policy "schedules_insert" on schedules for insert
  with check (
    organization_id = (select organization_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) in ('admin', 'manager')
  );
create policy "schedules_update" on schedules for update
  using (organization_id = (select organization_id from profiles where id = auth.uid()))
  with check (
    organization_id = (select organization_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) in ('admin', 'manager')
  );
create policy "schedules_delete" on schedules for delete
  using (
    organization_id = (select organization_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) in ('admin', 'manager')
  );

-- employee_schedules
create policy "emp_sched_read" on employee_schedules for select
  using (
    schedule_id in (
      select id from schedules
      where organization_id = (select organization_id from profiles where id = auth.uid())
    )
  );
create policy "emp_sched_write" on employee_schedules for all
  using (
    schedule_id in (
      select id from schedules
      where organization_id = (select organization_id from profiles where id = auth.uid())
    )
  )
  with check (
    (select role from profiles where id = auth.uid()) in ('admin', 'manager')
  );

-- manager_schedules
create policy "mgr_sched_read" on manager_schedules for select
  using (
    schedule_id in (
      select id from schedules
      where organization_id = (select organization_id from profiles where id = auth.uid())
    )
  );
create policy "mgr_sched_write" on manager_schedules for all
  using (
    schedule_id in (
      select id from schedules
      where organization_id = (select organization_id from profiles where id = auth.uid())
    )
  )
  with check (
    (select role from profiles where id = auth.uid()) in ('admin', 'manager')
  );

-- shifts
create policy "shifts_read" on shifts for select
  using (organization_id = (select organization_id from profiles where id = auth.uid()));
create policy "shifts_insert" on shifts for insert
  with check (
    organization_id = (select organization_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) in ('admin', 'manager')
  );
create policy "shifts_update" on shifts for update
  using (organization_id = (select organization_id from profiles where id = auth.uid()))
  with check (
    organization_id = (select organization_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) in ('admin', 'manager')
  );
create policy "shifts_delete" on shifts for delete
  using (
    organization_id = (select organization_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) in ('admin', 'manager')
  );

-- schedule_templates
create policy "templates_read" on schedule_templates for select
  using (organization_id = (select organization_id from profiles where id = auth.uid()));
create policy "templates_write" on schedule_templates for all
  using (organization_id = (select organization_id from profiles where id = auth.uid()))
  with check (
    (select role from profiles where id = auth.uid()) in ('admin', 'manager')
  );
create policy "template_shifts_read" on schedule_template_shifts for select
  using (
    template_id in (
      select id from schedule_templates
      where organization_id = (select organization_id from profiles where id = auth.uid())
    )
  );
create policy "template_shifts_write" on schedule_template_shifts for all
  using (
    template_id in (
      select id from schedule_templates
      where organization_id = (select organization_id from profiles where id = auth.uid())
    )
  )
  with check (
    (select role from profiles where id = auth.uid()) in ('admin', 'manager')
  );

-- shift_requests
create policy "shift_req_read" on shift_requests for select
  using (organization_id = (select organization_id from profiles where id = auth.uid()));
create policy "shift_req_insert" on shift_requests for insert
  with check (
    organization_id = (select organization_id from profiles where id = auth.uid())
    and requester_id = auth.uid()
  );
-- managers can update any request (approve/deny/add note)
create policy "shift_req_update_manager" on shift_requests for update
  using (organization_id = (select organization_id from profiles where id = auth.uid()))
  with check (
    (select role from profiles where id = auth.uid()) in ('admin', 'manager')
  );
-- employees can cancel their own pending requests
create policy "shift_req_cancel_self" on shift_requests for update
  using (
    organization_id = (select organization_id from profiles where id = auth.uid())
    and requester_id = auth.uid()
    and status = 'pending'
  )
  with check (
    requester_id = auth.uid()
    and status = 'canceled'
  );

-- employee_availability
create policy "avail_self" on employee_availability for all
  using (
    organization_id = (select organization_id from profiles where id = auth.uid())
    and (
      profile_id = auth.uid()
      or (select role from profiles where id = auth.uid()) in ('admin', 'manager')
    )
  )
  with check (
    organization_id = (select organization_id from profiles where id = auth.uid())
    and (
      profile_id = auth.uid()
      or (select role from profiles where id = auth.uid()) in ('admin', 'manager')
    )
  );

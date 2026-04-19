create table organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  timezone      text not null default 'America/New_York',
  logo_url      text,
  brand_color   text default '#0f172a',
  plan          text not null default 'trial' check (plan in ('trial','starter','pro','enterprise')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger organizations_updated_at
  before update on organizations
  for each row execute function update_updated_at();

alter table organizations enable row level security;

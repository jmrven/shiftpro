-- Enable required PostgreSQL extensions
create extension if not exists "uuid-ossp";
create extension if not exists "postgis";
create extension if not exists "pg_trgm";
create extension if not exists "pg_cron";

-- Shared updated_at trigger used by all tables
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

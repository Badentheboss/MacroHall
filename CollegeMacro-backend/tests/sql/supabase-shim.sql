-- Minimal stand-in for what a Supabase project provides, so migrations and RLS
-- can be tested in PGlite: roles, auth.users, auth.uid(), default grants, the
-- realtime publication, and the app's pre-existing public.users table.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);

create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

create publication supabase_realtime;

-- Shape of the users table the mobile app already uses.
create table public.users (
  id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  username text,
  email text,
  birthday date,
  log jsonb not null default '[]',
  "dailyValues" jsonb,
  last_dining_hall text
);
alter table public.users enable row level security;
create policy "own row" on public.users for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

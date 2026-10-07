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

-- Just enough of Supabase Storage for bucket rows and object policies.
create schema storage;
grant usage on schema storage to anon, authenticated, service_role;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text not null,
  owner uuid default auth.uid()
);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated;
grant all on storage.objects, storage.buckets to service_role;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;

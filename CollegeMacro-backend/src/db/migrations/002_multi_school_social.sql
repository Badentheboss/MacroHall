-- 002: multi-school sign-up, dated menus, friends presence + messaging.
-- Apply after src/db/schema.sql, then src/db/seed/schools.sql.
-- Safe to re-run.
--
-- Security model:
-- * Menu data is public to read; only the service role (backend) writes it.
-- * New accounts need a .edu email (trigger on auth.users), and a profile can
--   only join a live school whose email domain matches the account's email.
-- * Location is never stored. check_in() turns coordinates into a dining hall
--   (or nothing) inside the database and keeps only the hall id for 90 min.
-- * Friends see each other's hall; nobody else does. Ghost mode hides it.
-- * Messages only flow between accepted friends who have not blocked each other.

-- ---------------------------------------------------------------- schools ---
alter table public.schools
  add column if not exists short_name text,
  add column if not exists email_domains text[] not null default '{}',
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists timezone text not null default 'America/New_York',
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists menu_platform text,
  add column if not exists status text not null default 'coming_soon';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'schools_status_check') then
    alter table public.schools
      add constraint schools_status_check check (status in ('live', 'coming_soon'));
  end if;
end $$;

create index if not exists idx_schools_email_domains on public.schools using gin (email_domains);

-- Michigan was the only school before this migration; existing accounts belong to it.
insert into public.schools (slug, name, short_name, email_domains, city, state, timezone, menu_platform, status)
values ('umich', 'University of Michigan', 'Michigan', '{umich.edu}', 'Ann Arbor', 'MI', 'America/Detroit', 'custom-html', 'live')
on conflict (slug) do update
  set email_domains = excluded.email_domains,
      timezone = excluded.timezone,
      status = 'live';

-- ----------------------------------------------------------- dining halls ---
alter table public.dining_halls
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists geofence_radius_m integer not null default 75,
  add column if not exists is_active boolean not null default true;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'dining_halls_geofence_radius_check') then
    alter table public.dining_halls
      add constraint dining_halls_geofence_radius_check check (geofence_radius_m between 15 and 500);
  end if;
end $$;

-- ------------------------------------------------------------- menu items ---
alter table public.menu_items
  add column if not exists menu_date date not null default current_date,
  add column if not exists nutrition_source text not null default 'official';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'menu_items_nutrition_source_check') then
    alter table public.menu_items
      add constraint menu_items_nutrition_source_check
      check (nutrition_source in ('official', 'ai_extracted', 'ai_estimated', 'crowdsourced'));
  end if;
end $$;

alter table public.menu_items drop constraint if exists menu_items_hall_id_name_subheader_key;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'menu_items_hall_date_name_subheader_key') then
    alter table public.menu_items
      add constraint menu_items_hall_date_name_subheader_key unique (hall_id, menu_date, name, subheader);
  end if;
end $$;

create index if not exists idx_menu_items_hall_date on public.menu_items (hall_id, menu_date);

-- One row per dish with its meals, tags and nutrition, in the shape the app
-- already uses (nutrition_facts keys: calories, protein, total_carbohydrate, ...).
create or replace view public.menu_items_flat
with (security_invoker = true) as
select
  mi.id,
  mi.hall_id,
  dh.school_id,
  dh.slug as hall_slug,
  dh.name as hall_name,
  mi.menu_date,
  mi.name,
  mi.subheader,
  mi.nutrition_source,
  coalesce((select array_agg(m.meal order by m.meal) from public.menu_item_meals m where m.menu_item_id = mi.id), '{}') as meals,
  coalesce((select array_agg(a.allergen order by a.allergen) from public.menu_item_allergens a where a.menu_item_id = mi.id), '{}') as allergens,
  coalesce((select array_agg(t.trait order by t.trait) from public.menu_item_traits t where t.menu_item_id = mi.id), '{}') as traits,
  coalesce(
    (select jsonb_object_agg(
        n.nutrient_key,
        case when n.nutrient_value ~ '^-?[0-9]+(\.[0-9]+)?$' then to_jsonb(n.nutrient_value::numeric) else to_jsonb(n.nutrient_value) end)
     from public.menu_item_nutrition n where n.menu_item_id = mi.id),
    '{}'::jsonb) as nutrition_facts
from public.menu_items mi
join public.dining_halls dh on dh.id = mi.hall_id;

-- Menu data is public. Writes happen only through the service role, which
-- bypasses RLS (the ingestion job must use SUPABASE_SERVICE_ROLE_KEY).
do $$
declare
  t text;
begin
  foreach t in array array['schools', 'dining_halls', 'menu_items', 'menu_item_meals',
                           'menu_item_allergens', 'menu_item_traits', 'menu_item_nutrition']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s are public" on public.%I', t, t);
    execute format('create policy "%s are public" on public.%I for select to anon, authenticated using (true)', t, t);
  end loop;
end $$;

grant select on public.menu_items_flat to anon, authenticated;

-- ------------------------------------------------------- email helpers ---
create or replace function public.email_domain(p_email text)
returns text language sql immutable as $$
  select lower(split_part(coalesce(p_email, ''), '@', 2))
$$;

-- True when the domain is one of the allowed domains or a subdomain of one
-- (buckeyemail.osu.edu is allowed by osu.edu).
create or replace function public.domain_matches(p_domain text, p_allowed text[])
returns boolean language sql immutable as $$
  select exists (
    select 1 from unnest(p_allowed) as allowed(d)
    where p_domain = lower(d) or right(p_domain, length(d) + 1) = '.' || lower(d)
  )
$$;

-- --------------------------------------------- .edu-only account creation ---
create or replace function public.enforce_edu_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is null or public.email_domain(new.email) !~ '^[a-z0-9.-]+\.edu$' then
    raise exception 'MacroHall accounts require a .edu email address.' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists enforce_edu_email on auth.users;
create trigger enforce_edu_email
  before insert or update of email on auth.users
  for each row execute function public.enforce_edu_email();

-- ------------------------------------------------------------------ users ---
alter table public.users
  add column if not exists school_id bigint references public.schools(id),
  add column if not exists last_log_reset_on date;

-- Existing accounts predate multi-school support and are Michigan students.
update public.users
set school_id = (select id from public.schools where slug = 'umich')
where school_id is null;

create or replace function public.enforce_user_school()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  v_domains text[];
  v_status text;
begin
  if new.school_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.school_id is not distinct from old.school_id then
    return new;
  end if;

  select email into v_email from auth.users where id = new.id;
  select email_domains, status into v_domains, v_status from public.schools where id = new.school_id;

  if v_domains is null then
    raise exception 'Unknown school.' using errcode = 'foreign_key_violation';
  end if;
  if v_status <> 'live' then
    raise exception 'MacroHall is not live at this school yet.' using errcode = 'check_violation';
  end if;
  if not public.domain_matches(public.email_domain(v_email), v_domains) then
    raise exception 'Your email does not belong to the selected school.' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists enforce_user_school on public.users;
create trigger enforce_user_school
  before insert or update of school_id on public.users
  for each row execute function public.enforce_user_school();

-- --------------------------------------------------------------- profiles ---
-- The social-facing slice of a user. Kept apart from public.users, which holds
-- private data (food log, weight, birthday) that friends must never read.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  school_id bigint references public.schools(id),
  share_presence boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_school on public.profiles (school_id);

create or replace function public.sync_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, school_id)
  values (new.id, left(coalesce(nullif(btrim(new.username), ''), 'Student'), 60), new.school_id)
  on conflict (id) do update
    set display_name = excluded.display_name,
        school_id = excluded.school_id,
        updated_at = now();
  return new;
end $$;

drop trigger if exists sync_profile on public.users;
create trigger sync_profile
  after insert or update of username, school_id on public.users
  for each row execute function public.sync_profile();

insert into public.profiles (id, display_name, school_id)
select u.id, left(coalesce(nullif(btrim(u.username), ''), 'Student'), 60), u.school_id
from public.users u
where exists (select 1 from auth.users a where a.id = u.id)
on conflict (id) do nothing;

create or replace function public.my_school_id()
returns bigint language sql stable security definer set search_path = public as $$
  select school_id from public.profiles where id = auth.uid()
$$;

-- -------------------------------------------------------- friends, blocks ---
create table if not exists public.friendships (
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create unique index if not exists idx_friendships_pair
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists idx_friendships_addressee on public.friendships (addressee_id);

create table if not exists public.blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create or replace function public.are_friends(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and ((requester_id = p_a and addressee_id = p_b) or (requester_id = p_b and addressee_id = p_a))
  )
$$;

create or replace function public.is_blocked(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a)
  )
$$;

alter table public.profiles enable row level security;
drop policy if exists "profiles visible to classmates and friends" on public.profiles;
create policy "profiles visible to classmates and friends" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or (school_id = public.my_school_id() and not public.is_blocked(auth.uid(), id))
    or public.are_friends(auth.uid(), id)
  );

alter table public.friendships enable row level security;
drop policy if exists "see own friendships" on public.friendships;
create policy "see own friendships" on public.friendships
  for select to authenticated
  using (auth.uid() in (requester_id, addressee_id));

alter table public.blocks enable row level security;
drop policy if exists "see own blocks" on public.blocks;
create policy "see own blocks" on public.blocks
  for select to authenticated
  using (blocker_id = auth.uid());

create or replace function public.require_user()
returns uuid language plpgsql stable as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in.' using errcode = 'insufficient_privilege';
  end if;
  return auth.uid();
end $$;

-- Sends a request, or accepts if the other person already asked.
create or replace function public.send_friend_request(p_target uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.require_user();
  v_existing public.friendships;
begin
  if p_target = v_me then
    raise exception 'You cannot friend yourself.';
  end if;
  if not exists (select 1 from public.profiles where id = p_target and school_id = public.my_school_id()) then
    raise exception 'That student is not at your school.';
  end if;
  if public.is_blocked(v_me, p_target) then
    raise exception 'You cannot send a request to this student.';
  end if;

  select * into v_existing from public.friendships
  where (requester_id = v_me and addressee_id = p_target) or (requester_id = p_target and addressee_id = v_me);

  if found then
    if v_existing.status = 'accepted' then
      return 'accepted';
    end if;
    if v_existing.requester_id = p_target then
      update public.friendships set status = 'accepted', responded_at = now()
      where requester_id = p_target and addressee_id = v_me;
      return 'accepted';
    end if;
    return 'pending';
  end if;

  insert into public.friendships (requester_id, addressee_id) values (v_me, p_target);
  return 'pending';
end $$;

create or replace function public.respond_friend_request(p_requester uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.require_user();
begin
  if p_accept then
    update public.friendships set status = 'accepted', responded_at = now()
    where requester_id = p_requester and addressee_id = v_me and status = 'pending';
  else
    delete from public.friendships
    where requester_id = p_requester and addressee_id = v_me and status = 'pending';
  end if;
end $$;

create or replace function public.remove_friend(p_other uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.require_user();
begin
  delete from public.friendships
  where (requester_id = v_me and addressee_id = p_other) or (requester_id = p_other and addressee_id = v_me);
end $$;

create or replace function public.block_user(p_target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.require_user();
begin
  insert into public.blocks (blocker_id, blocked_id) values (v_me, p_target) on conflict do nothing;
  delete from public.friendships
  where (requester_id = v_me and addressee_id = p_target) or (requester_id = p_target and addressee_id = v_me);
end $$;

create or replace function public.unblock_user(p_target uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.blocks where blocker_id = public.require_user() and blocked_id = p_target;
end $$;

-- Classmates matching a name, for adding friends.
create or replace function public.search_classmates(p_query text)
returns table (id uuid, display_name text, friendship text)
language sql stable security definer set search_path = public as $$
  select
    p.id,
    p.display_name,
    coalesce((
      select case when f.status = 'accepted' then 'friends'
                  when f.requester_id = auth.uid() then 'requested'
                  else 'incoming' end
      from public.friendships f
      where (f.requester_id = auth.uid() and f.addressee_id = p.id)
         or (f.requester_id = p.id and f.addressee_id = auth.uid())
    ), 'none') as friendship
  from public.profiles p
  where auth.uid() is not null
    and p.school_id = public.my_school_id()
    and p.id <> auth.uid()
    and char_length(btrim(p_query)) >= 2
    and p.display_name ilike '%' || replace(replace(btrim(p_query), '%', ''), '_', '') || '%'
    and not public.is_blocked(auth.uid(), p.id)
  order by p.display_name
  limit 25
$$;

-- --------------------------------------------------------------- presence ---
create table if not exists public.presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  hall_id bigint not null references public.dining_halls(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.presence enable row level security;
drop policy if exists "see own presence" on public.presence;
create policy "see own presence" on public.presence
  for select to authenticated
  using (user_id = auth.uid());

-- Finds the dining hall at the caller's school whose geofence contains the
-- point. GPS accuracy (meters) widens the fence by up to 50 m.
create or replace function public.hall_at(p_school_id bigint, p_lat double precision, p_lng double precision, p_accuracy_m double precision)
returns table (hall_id bigint, hall_name text, distance_m double precision)
language sql stable security definer set search_path = public as $$
  select id, name, distance
  from (
    select h.id, h.name, h.geofence_radius_m,
      2 * 6371000 * asin(sqrt(
        power(sin(radians(h.latitude - p_lat) / 2), 2)
        + cos(radians(p_lat)) * cos(radians(h.latitude)) * power(sin(radians(h.longitude - p_lng) / 2), 2)
      )) as distance
    from public.dining_halls h
    where h.school_id = p_school_id
      and h.is_active
      and h.latitude is not null
      and h.longitude is not null
  ) candidates
  where distance <= geofence_radius_m + least(greatest(coalesce(p_accuracy_m, 0), 0), 50)
  order by distance
  limit 1
$$;

-- Records which dining hall (if any) the caller is in. Coordinates are used for
-- the lookup and discarded. Returns the hall, or no row when not at one.
create or replace function public.check_in(p_lat double precision, p_lng double precision, p_accuracy_m double precision default null)
returns table (hall_id bigint, hall_name text)
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.require_user();
  v_hall record;
  v_sharing boolean;
begin
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Invalid coordinates.';
  end if;

  select * into v_hall from public.hall_at(public.my_school_id(), p_lat, p_lng, p_accuracy_m);
  select share_presence into v_sharing from public.profiles where id = v_me;

  if v_hall.hall_id is null or not coalesce(v_sharing, false) then
    delete from public.presence where user_id = v_me;
  else
    insert into public.presence (user_id, hall_id, checked_in_at, expires_at)
    values (v_me, v_hall.hall_id, now(), now() + interval '90 minutes')
    on conflict (user_id) do update
      set hall_id = excluded.hall_id, checked_in_at = excluded.checked_in_at, expires_at = excluded.expires_at;
  end if;

  if v_hall.hall_id is not null then
    return query select v_hall.hall_id, v_hall.hall_name;
  end if;
end $$;

-- Manual check-in ("I'm at Bursley") for halls without coordinates.
create or replace function public.check_in_hall(p_hall_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.require_user();
begin
  if not exists (
    select 1 from public.dining_halls where id = p_hall_id and school_id = public.my_school_id() and is_active
  ) then
    raise exception 'That dining hall is not at your school.';
  end if;
  if not (select share_presence from public.profiles where id = v_me) then
    return;
  end if;

  insert into public.presence (user_id, hall_id, checked_in_at, expires_at)
  values (v_me, p_hall_id, now(), now() + interval '90 minutes')
  on conflict (user_id) do update
    set hall_id = excluded.hall_id, checked_in_at = excluded.checked_in_at, expires_at = excluded.expires_at;
end $$;

create or replace function public.check_out()
returns void language sql security definer set search_path = public as $$
  delete from public.presence where user_id = public.require_user()
$$;

create or replace function public.set_ghost_mode(p_enabled boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.require_user();
begin
  update public.profiles set share_presence = not p_enabled, updated_at = now() where id = v_me;
  if p_enabled then
    delete from public.presence where user_id = v_me;
  end if;
end $$;

-- Every accepted friend with the hall they are at, or null hall when they are
-- not at one, are hiding, or their check-in expired. Hidden and absent look
-- identical on purpose.
create or replace function public.get_friends_presence()
returns table (friend_id uuid, display_name text, hall_id bigint, hall_name text, checked_in_at timestamptz)
language sql stable security definer set search_path = public as $$
  with friends as (
    select case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end as id
    from public.friendships f
    where f.status = 'accepted' and auth.uid() in (f.requester_id, f.addressee_id)
  )
  select p.id, p.display_name, live.hall_id, live.hall_name, live.checked_in_at
  from friends
  join public.profiles p on p.id = friends.id
  left join lateral (
    select pr.hall_id, h.name as hall_name, pr.checked_in_at
    from public.presence pr
    join public.dining_halls h on h.id = pr.hall_id
    where pr.user_id = p.id and pr.expires_at > now() and p.share_presence
  ) live on true
  where not public.is_blocked(auth.uid(), p.id)
  order by live.hall_id is null, p.display_name
$$;

-- --------------------------------------------------------------- messages ---
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  sender_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> recipient_id)
);

create index if not exists idx_messages_recipient on public.messages (recipient_id, created_at desc);
create index if not exists idx_messages_sender on public.messages (sender_id, created_at desc);

alter table public.messages enable row level security;
drop policy if exists "read own conversations" on public.messages;
create policy "read own conversations" on public.messages
  for select to authenticated
  using (auth.uid() in (sender_id, recipient_id));
drop policy if exists "message friends" on public.messages;
create policy "message friends" on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and read_at is null
    and public.are_friends(sender_id, recipient_id)
    and not public.is_blocked(sender_id, recipient_id)
  );

create or replace function public.mark_conversation_read(p_other uuid)
returns void language sql security definer set search_path = public as $$
  update public.messages set read_at = now()
  where recipient_id = public.require_user() and sender_id = p_other and read_at is null
$$;

-- Live delivery to the recipient (Supabase Realtime honors the select policy).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

create table if not exists public.reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reported_user_id uuid not null references auth.users(id) on delete cascade,
  message_id bigint references public.messages(id) on delete set null,
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.reports enable row level security;
drop policy if exists "file reports" on public.reports;
create policy "file reports" on public.reports
  for insert to authenticated
  with check (reporter_id = auth.uid() and resolved_at is null);

-- ------------------------------------------------- school waitlist requests ---
create table if not exists public.school_requests (
  id bigint generated always as identity primary key,
  school_id bigint references public.schools(id) on delete cascade,
  school_name text not null check (char_length(btrim(school_name)) between 2 and 120),
  email text not null check (email ~* '^[^@[:space:]]+@[a-z0-9.-]+\.edu$'),
  created_at timestamptz not null default now()
);

alter table public.school_requests enable row level security;
drop policy if exists "anyone can join a waitlist" on public.school_requests;
create policy "anyone can join a waitlist" on public.school_requests
  for insert to anon, authenticated
  with check (true);

-- ------------------------------------------------------------- AI quota ---
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  requests integer not null default 0,
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;

-- Called by the backend (service role) before each chatbot request. Returns
-- false once the user has used today's allowance.
create or replace function public.consume_ai_quota(p_user uuid, p_limit integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  insert into public.ai_usage (user_id, day, requests)
  values (p_user, current_date, 1)
  on conflict (user_id, day) do update set requests = public.ai_usage.requests + 1
  returning requests into v_count;
  return v_count <= p_limit;
end $$;

-- ---------------------------------------------------- daily log rollover ---
-- Clears each user's food log once per campus-local day. Run hourly; a user is
-- reset on the first run after midnight in their school's time zone. Users
-- seen for the first time are stamped without clearing anything.
create or replace function public.reset_daily_logs()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_cleared integer;
begin
  update public.users u
  set last_log_reset_on = (now() at time zone coalesce(s.timezone, 'America/Detroit'))::date
  from public.users u2
  left join public.schools s on s.id = u2.school_id
  where u.id = u2.id and u.last_log_reset_on is null;

  update public.users u
  set log = '[]', last_log_reset_on = local.today
  from (
    select u2.id, (now() at time zone coalesce(s.timezone, 'America/Detroit'))::date as today
    from public.users u2
    left join public.schools s on s.id = u2.school_id
  ) local
  where u.id = local.id and u.last_log_reset_on < local.today;

  get diagnostics v_cleared = row_count;
  return v_cleared;
end $$;

-- ----------------------------------------------------------------- grants ---
-- Functions are executable by PUBLIC by default; lock everything down, then
-- open exactly what the app calls.
revoke execute on function
  public.enforce_edu_email(), public.enforce_user_school(), public.sync_profile(),
  public.consume_ai_quota(uuid, integer), public.reset_daily_logs(),
  public.hall_at(bigint, double precision, double precision, double precision)
from public, anon, authenticated;

grant execute on function public.consume_ai_quota(uuid, integer), public.reset_daily_logs() to service_role;

revoke execute on function
  public.send_friend_request(uuid), public.respond_friend_request(uuid, boolean), public.remove_friend(uuid),
  public.block_user(uuid), public.unblock_user(uuid), public.search_classmates(text),
  public.check_in(double precision, double precision, double precision), public.check_in_hall(bigint),
  public.check_out(), public.set_ghost_mode(boolean), public.get_friends_presence(),
  public.mark_conversation_read(uuid)
from public, anon;

grant execute on function
  public.send_friend_request(uuid), public.respond_friend_request(uuid, boolean), public.remove_friend(uuid),
  public.block_user(uuid), public.unblock_user(uuid), public.search_classmates(text),
  public.check_in(double precision, double precision, double precision), public.check_in_hall(bigint),
  public.check_out(), public.set_ghost_mode(boolean), public.get_friends_presence(),
  public.mark_conversation_read(uuid)
to authenticated;

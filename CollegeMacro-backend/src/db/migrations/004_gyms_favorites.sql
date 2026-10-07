-- 004: favorite dishes, gyms, gym visit tracking, separate location toggles.
-- Apply after 003. Safe to re-run.
--
-- * Favorite dishes are matched by name against the student's school's menus
--   for today and tomorrow (favorites_on_menu).
-- * Gyms have geofences like dining halls. Gym location is opt-in
--   (profiles.track_gym) and separate from dining-hall location
--   (profiles.share_presence). When on, checking in at a gym records a visit
--   (gym_sessions) and friends see "At the gym".
-- * check_in_place() resolves coordinates to the nearest dining hall or gym;
--   coordinates are never stored.

-- ------------------------------------------------------- favorite dishes ---
create table if not exists public.favorite_dishes (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  dish_name text not null check (char_length(btrim(dish_name)) between 1 and 120),
  dish_key text generated always as (lower(btrim(dish_name))) stored,
  created_at timestamptz not null default now(),
  primary key (user_id, dish_key)
);

alter table public.favorite_dishes enable row level security;
drop policy if exists "own favorites" on public.favorite_dishes;
create policy "own favorites" on public.favorite_dishes
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists idx_menu_items_name_key on public.menu_items (lower(btrim(name)), menu_date);

-- Where the caller's favorite dishes are served today and tomorrow.
create or replace function public.favorites_on_menu()
returns table (day date, dish_name text, hall_id bigint, hall_name text, meals text[], calories numeric, protein numeric)
language sql stable security definer set search_path = public as $$
  select mi.menu_date, mi.name, dh.id, dh.name,
    coalesce((select array_agg(m.meal order by m.meal) from public.menu_item_meals m where m.menu_item_id = mi.id), '{}'),
    (select public.jnum(to_jsonb(n.nutrient_value)) from public.menu_item_nutrition n where n.menu_item_id = mi.id and n.nutrient_key = 'calories'),
    (select public.jnum(to_jsonb(n.nutrient_value)) from public.menu_item_nutrition n where n.menu_item_id = mi.id and n.nutrient_key = 'protein')
  from public.favorite_dishes f
  join public.menu_items mi on lower(btrim(mi.name)) = f.dish_key
  join public.dining_halls dh on dh.id = mi.hall_id
  where f.user_id = auth.uid()
    and dh.school_id = public.my_school_id()
    and mi.menu_date in (public.user_today(auth.uid()), public.user_today(auth.uid()) + 1)
  order by mi.menu_date, mi.name, dh.name
$$;

-- ------------------------------------------------------------------ gyms ---
create table if not exists public.gym_facilities (
  id bigint generated always as identity primary key,
  school_id bigint not null references public.schools(id) on delete cascade,
  slug text not null,
  name text not null,
  latitude double precision,
  longitude double precision,
  geofence_radius_m integer not null default 100 check (geofence_radius_m between 25 and 600),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (school_id, slug)
);

alter table public.gym_facilities enable row level security;
drop policy if exists "gyms are public" on public.gym_facilities;
create policy "gyms are public" on public.gym_facilities for select to anon, authenticated using (true);

alter table public.profiles add column if not exists track_gym boolean not null default false;

create table if not exists public.gym_sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  gym_id bigint not null references public.gym_facilities(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists idx_gym_sessions_user on public.gym_sessions (user_id, started_at desc);

alter table public.gym_sessions enable row level security;
drop policy if exists "read visible gym sessions" on public.gym_sessions;
create policy "read visible gym sessions" on public.gym_sessions
  for select to authenticated
  using (public.can_view_log(user_id));

-- A visit nobody ended (no geofence exit, no "Leave") counts for 2 hours at most.
create or replace function public.session_minutes(p_started timestamptz, p_ended timestamptz)
returns numeric language sql stable as $$
  select greatest(0, extract(epoch from (coalesce(p_ended, least(now(), p_started + interval '2 hours')) - p_started)) / 60)
$$;

-- Presence can now point at a dining hall or a gym.
alter table public.presence alter column hall_id drop not null;
alter table public.presence add column if not exists gym_id bigint references public.gym_facilities(id) on delete cascade;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'presence_one_place') then
    alter table public.presence add constraint presence_one_place check (num_nonnulls(hall_id, gym_id) = 1);
  end if;
end $$;

create or replace function public.gym_at(p_school_id bigint, p_lat double precision, p_lng double precision, p_accuracy_m double precision)
returns table (gym_id bigint, gym_name text, distance_m double precision)
language sql stable security definer set search_path = public as $$
  select id, name, distance
  from (
    select g.id, g.name, g.geofence_radius_m,
      2 * 6371000 * asin(sqrt(
        power(sin(radians(g.latitude - p_lat) / 2), 2)
        + cos(radians(p_lat)) * cos(radians(g.latitude)) * power(sin(radians(g.longitude - p_lng) / 2), 2)
      )) as distance
    from public.gym_facilities g
    where g.school_id = p_school_id and g.is_active and g.latitude is not null and g.longitude is not null
  ) candidates
  where distance <= geofence_radius_m + least(greatest(coalesce(p_accuracy_m, 0), 0), 50)
  order by distance
  limit 1
$$;

create or replace function public.end_gym_session(p_user uuid)
returns void language sql security definer set search_path = public as $$
  update public.gym_sessions
  set ended_at = least(now(), started_at + interval '2 hours')
  where user_id = p_user and ended_at is null
$$;

-- Starts (or continues) a visit at a gym and shows friends "At <gym>".
create or replace function public.enter_gym(p_user uuid, p_gym_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_open public.gym_sessions;
begin
  select * into v_open from public.gym_sessions
  where user_id = p_user and ended_at is null
  order by started_at desc limit 1;

  if not found or v_open.gym_id <> p_gym_id or v_open.started_at < now() - interval '2 hours' then
    perform public.end_gym_session(p_user);
    insert into public.gym_sessions (user_id, gym_id) values (p_user, p_gym_id) returning * into v_open;
  end if;

  delete from public.presence where user_id = p_user;
  insert into public.presence (user_id, gym_id, checked_in_at, expires_at)
  values (p_user, p_gym_id, v_open.started_at, now() + interval '2 hours');
end $$;

-- Resolves coordinates to the nearest dining hall (always detected, shared
-- only with dining location on) or gym (only with gym location on).
create or replace function public.check_in_place(p_lat double precision, p_lng double precision, p_accuracy_m double precision default null)
returns table (place_type text, place_id bigint, place_name text)
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.require_user();
  v_profile public.profiles;
  v_hall record;
  v_gym_id bigint;
  v_gym_name text;
  v_gym_distance double precision;
begin
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Invalid coordinates.';
  end if;

  select * into v_profile from public.profiles where id = v_me;
  select * into v_hall from public.hall_at(v_profile.school_id, p_lat, p_lng, p_accuracy_m);
  if v_profile.track_gym then
    select g.gym_id, g.gym_name, g.distance_m into v_gym_id, v_gym_name, v_gym_distance
    from public.gym_at(v_profile.school_id, p_lat, p_lng, p_accuracy_m) g;
  end if;

  if v_gym_id is not null and (v_hall.hall_id is null or v_gym_distance <= v_hall.distance_m) then
    perform public.enter_gym(v_me, v_gym_id);
    return query select 'gym'::text, v_gym_id, v_gym_name;
    return;
  end if;

  perform public.end_gym_session(v_me);
  delete from public.presence where user_id = v_me;

  if v_hall.hall_id is not null then
    if v_profile.share_presence then
      insert into public.presence (user_id, hall_id, checked_in_at, expires_at)
      values (v_me, v_hall.hall_id, now(), now() + interval '90 minutes');
    end if;
    return query select 'hall'::text, v_hall.hall_id, v_hall.hall_name;
  end if;
end $$;

-- 002's hall check-ins upsert presence; with gyms in the same row they must
-- end any gym visit and clear the row first (one place at a time).
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
  perform public.end_gym_session(v_me);
  delete from public.presence where user_id = v_me;
  if (select share_presence from public.profiles where id = v_me) then
    insert into public.presence (user_id, hall_id, checked_in_at, expires_at)
    values (v_me, p_hall_id, now(), now() + interval '90 minutes');
  end if;
end $$;

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

  perform public.end_gym_session(v_me);
  delete from public.presence where user_id = v_me;
  if v_hall.hall_id is not null and coalesce(v_sharing, false) then
    insert into public.presence (user_id, hall_id, checked_in_at, expires_at)
    values (v_me, v_hall.hall_id, now(), now() + interval '90 minutes');
  end if;

  if v_hall.hall_id is not null then
    return query select v_hall.hall_id, v_hall.hall_name;
  end if;
end $$;

-- Manual "I'm at the gym" (and geofence entry from background tracking).
create or replace function public.check_in_gym(p_gym_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.require_user();
begin
  if not exists (select 1 from public.gym_facilities where id = p_gym_id and school_id = public.my_school_id() and is_active) then
    raise exception 'That gym is not at your school.';
  end if;
  if (select track_gym from public.profiles where id = v_me) then
    perform public.enter_gym(v_me, p_gym_id);
  end if;
end $$;

-- Geofence exit: leave only if the user is still checked in at that place.
create or replace function public.leave_place(p_type text, p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.require_user();
begin
  if p_type = 'gym' then
    update public.gym_sessions set ended_at = now() where user_id = v_me and gym_id = p_id and ended_at is null;
    delete from public.presence where user_id = v_me and gym_id = p_id;
  elsif p_type = 'hall' then
    delete from public.presence where user_id = v_me and hall_id = p_id;
  end if;
end $$;

create or replace function public.check_out()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.require_user();
begin
  update public.gym_sessions set ended_at = now() where user_id = v_me and ended_at is null;
  delete from public.presence where user_id = v_me;
end $$;

create or replace function public.set_location_sharing(p_dining boolean, p_gym boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.require_user();
begin
  update public.profiles set share_presence = p_dining, track_gym = p_gym, updated_at = now() where id = v_me;
  if not p_dining then
    delete from public.presence where user_id = v_me and hall_id is not null;
  end if;
  if not p_gym then
    perform public.end_gym_session(v_me);
    delete from public.presence where user_id = v_me and gym_id is not null;
  end if;
end $$;

-- Friends with where they are: a dining hall (dining location on) or a gym
-- (gym location on). Same privacy rule as before: hidden looks like absent.
drop function if exists public.get_friends_presence();
create function public.get_friends_presence()
returns table (friend_id uuid, display_name text, hall_id bigint, hall_name text, checked_in_at timestamptz, gym_id bigint, gym_name text)
language sql stable security definer set search_path = public as $$
  with friends as (
    select case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end as id
    from public.friendships f
    where f.status = 'accepted' and auth.uid() in (f.requester_id, f.addressee_id)
  )
  select p.id, p.display_name, live.hall_id, live.hall_name, live.checked_in_at, live.gym_id, live.gym_name
  from friends
  join public.profiles p on p.id = friends.id
  left join lateral (
    select pr.hall_id, h.name as hall_name, pr.checked_in_at, pr.gym_id, g.name as gym_name
    from public.presence pr
    left join public.dining_halls h on h.id = pr.hall_id
    left join public.gym_facilities g on g.id = pr.gym_id
    where pr.user_id = p.id
      and pr.expires_at > now()
      and ((pr.hall_id is not null and p.share_presence) or (pr.gym_id is not null and p.track_gym))
  ) live on true
  where not public.is_blocked(auth.uid(), p.id)
  order by coalesce(live.hall_id, live.gym_id) is null, p.display_name
$$;

-- Gyms at the caller's school: how many MacroHall students are checked in
-- (only shown at 3 or more, so nobody can be singled out) and which friends.
create or replace function public.gym_overview()
returns table (gym_id bigint, gym_name text, has_geofence boolean, students_here integer, friends_here text[])
language sql stable security definer set search_path = public as $$
  select g.id, g.name, g.latitude is not null,
    (
      select count(*) from public.presence pr
      join public.profiles p on p.id = pr.user_id
      where pr.gym_id = g.id and pr.expires_at > now() and p.track_gym
    )::integer,
    coalesce((
      select array_agg(p.display_name order by p.display_name)
      from public.presence pr
      join public.profiles p on p.id = pr.user_id
      where pr.gym_id = g.id and pr.expires_at > now() and p.track_gym
        and public.are_friends(auth.uid(), p.id) and not public.is_blocked(auth.uid(), p.id)
    ), '{}')
  from public.gym_facilities g
  where g.school_id = public.my_school_id() and g.is_active and auth.uid() is not null
  order by g.name
$$;

-- Wrap the count so small numbers stay hidden.
create or replace function public.gym_overview_safe()
returns table (gym_id bigint, gym_name text, has_geofence boolean, students_here integer, friends_here text[])
language sql stable security definer set search_path = public as $$
  select gym_id, gym_name, has_geofence, case when students_here >= 3 then students_here end, friends_here
  from public.gym_overview()
$$;

-- --------------------------------------------- profile: favorites + gym ---
create or replace function public.gym_stats(p_user uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with tz as (
    select coalesce((select s.timezone from public.profiles p join public.schools s on s.id = p.school_id where p.id = p_user), 'America/Detroit') as zone
  )
  select jsonb_build_object(
    'at_gym_now', (
      select g.name from public.presence pr join public.gym_facilities g on g.id = pr.gym_id
      where pr.user_id = p_user and pr.expires_at > now()
    ),
    'gym_days_7', (
      select count(distinct (s.started_at at time zone tz.zone)::date) from public.gym_sessions s, tz
      where s.user_id = p_user and s.started_at > now() - interval '7 days'
        and public.session_minutes(s.started_at, s.ended_at) >= 10
    ),
    'gym_minutes_7', (
      select coalesce(round(sum(public.session_minutes(s.started_at, s.ended_at))), 0) from public.gym_sessions s
      where s.user_id = p_user and s.started_at > now() - interval '7 days'
    ),
    'gym_days_30', (
      select count(distinct (s.started_at at time zone tz.zone)::date) from public.gym_sessions s, tz
      where s.user_id = p_user and s.started_at > now() - interval '30 days'
        and public.session_minutes(s.started_at, s.ended_at) >= 10
    ),
    'last_visit', (select max(s.started_at) from public.gym_sessions s where s.user_id = p_user)
  )
  from tz
$$;

-- get_profile from 003 plus favorite dishes and gym stats (gym stats only for
-- people who turned gym location on).
create or replace function public.get_profile(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_profile public.profiles;
  v_can_log boolean;
  v_today date;
  v_result jsonb;
begin
  if not public.can_view_profile(p_user) then
    return null;
  end if;

  select * into v_profile from public.profiles where id = p_user;
  if not found then
    return null;
  end if;

  v_can_log := public.can_view_log(p_user);
  v_today := public.user_today(p_user);

  v_result := jsonb_build_object(
    'id', v_profile.id,
    'display_name', v_profile.display_name,
    'username', v_profile.username,
    'bio', v_profile.bio,
    'avatar_emoji', v_profile.avatar_emoji,
    'accent_color', v_profile.accent_color,
    'goal', v_profile.goal,
    'class_year', v_profile.class_year,
    'school', (select coalesce(short_name, name) from public.schools where id = v_profile.school_id),
    'favorite_hall', (select jsonb_build_object('id', id, 'name', name) from public.dining_halls where id = v_profile.favorite_hall_id),
    'friendship', public.friendship_state(p_user),
    'friend_count', (select count(*) from public.friendships where status = 'accepted' and p_user in (requester_id, addressee_id)),
    'log_visibility', case when p_user = auth.uid() then v_profile.log_visibility end,
    'share_dining', case when p_user = auth.uid() then v_profile.share_presence end,
    'track_gym', case when p_user = auth.uid() then v_profile.track_gym end,
    'can_view_log', v_can_log,
    'today', v_today
  );

  if v_can_log then
    v_result := v_result || jsonb_build_object(
      'stats', jsonb_build_object(
        'streak', public.log_streak(p_user),
        'days_logged_30', (select count(*) from public.daily_logs where user_id = p_user and day > v_today - 30),
        'avg_calories_7', (select round(avg(calories)) from public.daily_logs where user_id = p_user and day > v_today - 7),
        'avg_protein_7', (select round(avg(protein)) from public.daily_logs where user_id = p_user and day > v_today - 7)
      ),
      'usuals', coalesce((
        select jsonb_agg(u order by u.times desc, u.name)
        from (
          select min(e ->> 'name') as name,
                 count(*) as times,
                 round(avg(public.jnum(e -> 'protein') / greatest(public.jnum(e -> 'servings'), 1))) as protein,
                 round(avg(public.jnum(e -> 'calories') / greatest(public.jnum(e -> 'servings'), 1))) as calories
          from public.daily_logs d, jsonb_array_elements(d.entries) e
          where d.user_id = p_user and d.day > v_today - 30 and e ->> 'name' is not null
          group by lower(e ->> 'name')
          order by count(*) desc, min(e ->> 'name')
          limit 8
        ) u
      ), '[]'::jsonb),
      'favorites', coalesce((
        select jsonb_agg(f.dish_name order by f.created_at desc)
        from (select dish_name, created_at from public.favorite_dishes where user_id = p_user order by created_at desc limit 12) f
      ), '[]'::jsonb),
      'gym', case when v_profile.track_gym then public.gym_stats(p_user) end
    );
  end if;

  return v_result;
end $$;

-- ----------------------------------------------------------------- grants ---
revoke execute on function
  public.gym_at(bigint, double precision, double precision, double precision),
  public.end_gym_session(uuid), public.enter_gym(uuid, bigint), public.gym_stats(uuid), public.gym_overview()
from public, anon, authenticated;

revoke execute on function
  public.favorites_on_menu(), public.check_in_place(double precision, double precision, double precision),
  public.check_in_gym(bigint), public.leave_place(text, bigint), public.check_out(),
  public.set_location_sharing(boolean, boolean), public.get_friends_presence(), public.gym_overview_safe()
from public, anon;

grant execute on function
  public.favorites_on_menu(), public.check_in_place(double precision, double precision, double precision),
  public.check_in_gym(bigint), public.leave_place(text, bigint), public.check_out(),
  public.set_location_sharing(boolean, boolean), public.get_friends_presence(), public.gym_overview_safe()
to authenticated;

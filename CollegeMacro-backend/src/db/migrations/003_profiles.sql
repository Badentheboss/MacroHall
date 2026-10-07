-- 003: customizable profiles, food log history, profile pages.
-- Apply after 002. Safe to re-run.
--
-- * Profiles gain a @username, bio, emoji avatar, accent color, goal, class
--   year, favorite hall, and who can see their food log (everyone at their
--   school, friends, or only them; friends by default).
-- * public.users.log is cleared every night, so a calendar needs history:
--   every change to a log is mirrored into daily_logs for the campus-local
--   day (compact entries + macro totals).
-- * Profile pages, the calendar, and "usuals" are served by RPCs that apply
--   the owner's visibility setting; blocked users see nothing.

-- ------------------------------------------------------- profile fields ---
alter table public.profiles
  add column if not exists username text,
  add column if not exists bio text,
  add column if not exists avatar_emoji text not null default '🍽️',
  add column if not exists accent_color text not null default '#32745f',
  add column if not exists goal text,
  add column if not exists class_year integer,
  add column if not exists favorite_hall_id bigint references public.dining_halls(id) on delete set null,
  add column if not exists log_visibility text not null default 'friends';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_username_format') then
    alter table public.profiles add constraint profiles_username_format check (username ~ '^[a-z0-9_.]{3,20}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_bio_length') then
    alter table public.profiles add constraint profiles_bio_length check (char_length(bio) <= 160);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_avatar_length') then
    alter table public.profiles add constraint profiles_avatar_length check (char_length(avatar_emoji) between 1 and 8);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_accent_hex') then
    alter table public.profiles add constraint profiles_accent_hex check (accent_color ~ '^#[0-9A-Fa-f]{6}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_goal_check') then
    alter table public.profiles add constraint profiles_goal_check check (goal in ('bulk', 'cut', 'maintain', 'recomp'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_class_year_check') then
    alter table public.profiles add constraint profiles_class_year_check check (class_year between 2000 and 2040);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_log_visibility_check') then
    alter table public.profiles add constraint profiles_log_visibility_check check (log_visibility in ('everyone', 'friends', 'only_me'));
  end if;
end $$;

create unique index if not exists idx_profiles_username on public.profiles (lower(username));

-- Students edit their own profile, but only these columns. school_id and
-- share_presence stay under the database's control (sign-up checks, ghost mode).
drop policy if exists "edit own profile" on public.profiles;
create policy "edit own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

revoke update on public.profiles from anon, authenticated;
grant update (display_name, username, bio, avatar_emoji, accent_color, goal, class_year, favorite_hall_id, log_visibility)
  on public.profiles to authenticated;

create or replace function public.check_favorite_hall()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.favorite_hall_id is not null and not exists (
    select 1 from public.dining_halls where id = new.favorite_hall_id and school_id = new.school_id
  ) then
    raise exception 'Favorite hall must be at your school.' using errcode = 'check_violation';
  end if;
  new.username := lower(nullif(btrim(new.username), ''));
  new.bio := nullif(btrim(new.bio), '');
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists check_favorite_hall on public.profiles;
create trigger check_favorite_hall
  before insert or update on public.profiles
  for each row execute function public.check_favorite_hall();

-- --------------------------------------------------------- food history ---
create table if not exists public.daily_logs (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  entries jsonb not null default '[]',
  calories integer not null default 0,
  protein numeric(7, 1) not null default 0,
  carbs numeric(7, 1) not null default 0,
  fat numeric(7, 1) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- Numbers in the app's log are sometimes strings ("183") and sometimes numbers.
create or replace function public.jnum(p_value jsonb)
returns numeric language sql immutable as $$
  select case
    when p_value is null or jsonb_typeof(p_value) = 'null' then 0
    when jsonb_typeof(p_value) = 'number' then (p_value #>> '{}')::numeric
    when (p_value #>> '{}') ~ '-?[0-9]+(\.[0-9]+)?' then substring(p_value #>> '{}' from '-?[0-9]+(?:\.[0-9]+)?')::numeric
    else 0
  end
$$;

-- Mirrors the user's current log into today's daily_logs row (campus-local
-- day), with the Dashboard's math: base nutrition x servings.
create or replace function public.sync_daily_log()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_log jsonb := to_jsonb(new.log);
  v_day date;
begin
  select (now() at time zone coalesce(s.timezone, 'America/Detroit'))::date into v_day
  from (select 1) one left join public.schools s on s.id = new.school_id;

  if v_log is null or jsonb_typeof(v_log) <> 'array' or jsonb_array_length(v_log) = 0 then
    delete from public.daily_logs where user_id = new.id and day = v_day;
    return new;
  end if;

  insert into public.daily_logs (user_id, day, entries, calories, protein, carbs, fat, updated_at)
  select new.id, v_day,
    jsonb_agg(jsonb_build_object(
      'name', item.e ->> 'name',
      'meal', item.e ->> 'mealTime',
      'servings', item.s,
      'calories', round(public.jnum(item.b -> 'calories') * item.s),
      'protein', round(public.jnum(item.b -> 'protein') * item.s, 1),
      'carbs', round(public.jnum(item.b -> 'total_carbohydrate') * item.s, 1),
      'fat', round(public.jnum(item.b -> 'total_fat') * item.s, 1)
    )),
    round(sum(public.jnum(item.b -> 'calories') * item.s)),
    round(sum(public.jnum(item.b -> 'protein') * item.s), 1),
    round(sum(public.jnum(item.b -> 'total_carbohydrate') * item.s), 1),
    round(sum(public.jnum(item.b -> 'total_fat') * item.s), 1),
    now()
  from (
    select e,
      coalesce(e -> 'baseNutrition', e -> 'nutrition_facts', '{}'::jsonb) as b,
      coalesce(nullif(public.jnum(e -> 'servings'), 0), 1) as s
    from jsonb_array_elements(v_log) as e
    where jsonb_typeof(e) = 'object'
  ) item
  on conflict (user_id, day) do update
    set entries = excluded.entries,
        calories = excluded.calories,
        protein = excluded.protein,
        carbs = excluded.carbs,
        fat = excluded.fat,
        updated_at = now();
  return new;
end $$;

drop trigger if exists sync_daily_log on public.users;
create trigger sync_daily_log
  after insert or update of log on public.users
  for each row execute function public.sync_daily_log();

-- Start history with whatever is logged right now.
update public.users set log = log;

-- ------------------------------------------------------------ visibility ---
create or replace function public.can_view_profile(p_owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    p_owner = auth.uid()
    or public.are_friends(auth.uid(), p_owner)
    or exists (
      select 1 from public.profiles p
      where p.id = p_owner and p.school_id = public.my_school_id() and not public.is_blocked(auth.uid(), p_owner)
    )
  )
$$;

create or replace function public.can_view_log(p_owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    p_owner = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = p_owner
        and not public.is_blocked(auth.uid(), p_owner)
        and (
          (p.log_visibility = 'everyone' and p.school_id = public.my_school_id())
          or (p.log_visibility in ('everyone', 'friends') and public.are_friends(auth.uid(), p_owner))
        )
    )
  )
$$;

alter table public.daily_logs enable row level security;
drop policy if exists "read visible logs" on public.daily_logs;
create policy "read visible logs" on public.daily_logs
  for select to authenticated
  using (public.can_view_log(user_id));

-- ---------------------------------------------------------- profile RPCs ---
create or replace function public.user_today(p_user uuid)
returns date language sql stable security definer set search_path = public as $$
  select (now() at time zone coalesce(
    (select s.timezone from public.profiles p join public.schools s on s.id = p.school_id where p.id = p_user),
    'America/Detroit'))::date
$$;

-- Consecutive logged days ending today (or yesterday, so a streak survives
-- until the user logs today).
create or replace function public.log_streak(p_user uuid)
returns integer language plpgsql stable security definer set search_path = public as $$
declare
  v_day date := public.user_today(p_user);
  v_count integer := 0;
begin
  if not exists (select 1 from public.daily_logs where user_id = p_user and day = v_day) then
    v_day := v_day - 1;
  end if;
  while exists (select 1 from public.daily_logs where user_id = p_user and day = v_day) loop
    v_count := v_count + 1;
    v_day := v_day - 1;
  end loop;
  return v_count;
end $$;

create or replace function public.friendship_state(p_other uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when p_other = auth.uid() then 'self'
    else coalesce((
      select case when f.status = 'accepted' then 'friends'
                  when f.requester_id = auth.uid() then 'requested'
                  else 'incoming' end
      from public.friendships f
      where (f.requester_id = auth.uid() and f.addressee_id = p_other)
         or (f.requester_id = p_other and f.addressee_id = auth.uid())
    ), 'none')
  end
$$;

-- Everything a profile page shows. Returns null when the caller may not see
-- the profile; stats and usuals are null when the food log is hidden.
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
      ), '[]'::jsonb)
    );
  end if;

  return v_result;
end $$;

-- Daily totals for one month of the calendar.
create or replace function public.get_log_month(p_user uuid, p_month date)
returns table (day date, calories integer, protein numeric, carbs numeric, fat numeric, items integer)
language sql stable security definer set search_path = public as $$
  select d.day, d.calories, d.protein, d.carbs, d.fat, jsonb_array_length(d.entries)
  from public.daily_logs d
  where d.user_id = p_user
    and public.can_view_log(p_user)
    and d.day >= date_trunc('month', p_month)::date
    and d.day < (date_trunc('month', p_month) + interval '1 month')::date
  order by d.day
$$;

-- Classmates by name or @username, with what the caller needs for a row.
create or replace function public.search_people(p_query text)
returns table (id uuid, display_name text, username text, avatar_emoji text, accent_color text, goal text, friendship text)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.username, p.avatar_emoji, p.accent_color, p.goal, public.friendship_state(p.id)
  from public.profiles p,
       lateral (select replace(replace(ltrim(btrim(p_query), '@'), '%', ''), '_', '\_') as q) term
  where auth.uid() is not null
    and p.school_id = public.my_school_id()
    and p.id <> auth.uid()
    and char_length(term.q) >= 2
    and (p.display_name ilike '%' || term.q || '%' or p.username ilike term.q || '%')
    and not public.is_blocked(auth.uid(), p.id)
  order by (p.username ilike term.q || '%') desc, p.display_name
  limit 25
$$;

revoke execute on function
  public.sync_daily_log(), public.check_favorite_hall(), public.user_today(uuid), public.log_streak(uuid)
from public, anon, authenticated;

revoke execute on function
  public.get_profile(uuid), public.get_log_month(uuid, date), public.search_people(text),
  public.can_view_profile(uuid), public.can_view_log(uuid), public.friendship_state(uuid)
from public, anon;

grant execute on function
  public.get_profile(uuid), public.get_log_month(uuid, date), public.search_people(text),
  public.can_view_profile(uuid), public.can_view_log(uuid), public.friendship_state(uuid)
to authenticated;

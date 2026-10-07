-- 005: school colors and profile photos.
-- Run after 004. Safe to re-run.

-- ------------------------------------------------------------ school colors --
-- Official colors tint the app for each school's students (seeded from
-- src/config/schoolColors.js).
alter table public.schools
  add column if not exists primary_color text,
  add column if not exists secondary_color text;

alter table public.schools drop constraint if exists schools_color_format;
alter table public.schools add constraint schools_color_format check (
  (primary_color is null or primary_color ~ '^#[0-9A-Fa-f]{6}$')
  and (secondary_color is null or secondary_color ~ '^#[0-9A-Fa-f]{6}$')
);

-- ----------------------------------------------------------- profile photos --
-- Photos live in the public "avatars" storage bucket under the owner's folder.
-- The profile stores only the object path, never a URL, so it can't point at
-- an outside image, and the check keeps it inside the owner's folder.
alter table public.profiles add column if not exists avatar_path text;

alter table public.profiles drop constraint if exists profiles_avatar_path_format;
alter table public.profiles add constraint profiles_avatar_path_format check (
  avatar_path is null
  or avatar_path ~ ('^' || id::text || '/[A-Za-z0-9_-]{1,64}\.(jpg|jpeg|png|webp)$')
);

grant update (avatar_path) on public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Anyone can view a photo by its public URL; only the owner can add, replace
-- or delete files in their own folder (avatars/<user id>/...).
drop policy if exists "avatars: owner reads own folder" on storage.objects;
create policy "avatars: owner reads own folder" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars: owner uploads" on storage.objects;
create policy "avatars: owner uploads" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars: owner updates" on storage.objects;
create policy "avatars: owner updates" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars: owner deletes" on storage.objects;
create policy "avatars: owner deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ------------------------------------------- profile and search return photos --
-- get_profile from 004 plus avatar_path.
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
    'avatar_path', v_profile.avatar_path,
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

drop function if exists public.search_people(text);
create function public.search_people(p_query text)
returns table (id uuid, display_name text, username text, avatar_emoji text, avatar_path text, accent_color text, goal text, friendship text)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.username, p.avatar_emoji, p.avatar_path, p.accent_color, p.goal, public.friendship_state(p.id)
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

revoke execute on function public.search_people(text) from public, anon;
grant execute on function public.search_people(text) to authenticated;

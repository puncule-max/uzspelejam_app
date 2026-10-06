
revoke select on public.profiles from anon, authenticated;

grant select(
  id,
  display_name,
  avatar_url,
  visibility,
  rating_average,
  rating_count,
  completed_games_count,
  created_at
) on public.profiles to anon, authenticated;

create or replace function private.get_profile_detail_impl(p_user_id uuid)
returns table(
  id uuid,
  display_name text,
  avatar_url text,
  visibility public.profile_visibility,
  rating_average numeric,
  rating_count integer,
  completed_games_count integer,
  city text,
  about text,
  language text,
  is_self boolean
)
language sql
stable
security definer
set search_path=''
as $$
  select
    p.id,
    p.display_name,
    p.avatar_url,
    p.visibility,
    p.rating_average,
    p.rating_count,
    p.completed_games_count,
    case when p.visibility='public' or p.id=auth.uid() then p.city else null end,
    case when p.visibility='public' or p.id=auth.uid() then p.about else null end,
    case when p.id=auth.uid() then p.language else null end,
    p.id=auth.uid()
  from public.profiles p
  where p.id=p_user_id
    and (
      p.visibility='public'
      or p.id=auth.uid()
      or auth.uid() is not null
    )
  limit 1;
$$;

revoke all on function private.get_profile_detail_impl(uuid) from public,anon,authenticated;
grant execute on function private.get_profile_detail_impl(uuid) to anon,authenticated;

create or replace function public.get_profile_detail(p_user_id uuid)
returns table(
  id uuid,
  display_name text,
  avatar_url text,
  visibility public.profile_visibility,
  rating_average numeric,
  rating_count integer,
  completed_games_count integer,
  city text,
  about text,
  language text,
  is_self boolean
)
language sql
stable
security invoker
set search_path=''
as $$ select * from private.get_profile_detail_impl($1); $$;

revoke all on function public.get_profile_detail(uuid) from public;
grant execute on function public.get_profile_detail(uuid) to anon,authenticated;

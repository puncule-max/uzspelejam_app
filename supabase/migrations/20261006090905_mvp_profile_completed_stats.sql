
create or replace function private.completed_games_for_user(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path=''
as $$
  select count(distinct g.id)::integer
  from public.games g
  where g.ends_at<=now()
    and g.cancelled_at is null
    and (
      g.creator_id=p_user_id
      or exists(
        select 1 from public.game_participants gp
        where gp.game_id=g.id
          and gp.user_id=p_user_id
          and gp.status='accepted'
      )
    );
$$;

revoke all on function private.completed_games_for_user(uuid) from public,anon,authenticated;

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
    private.completed_games_for_user(p.id),
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

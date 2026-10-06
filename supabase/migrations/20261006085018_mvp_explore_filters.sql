
drop function if exists public.list_public_games(integer);

create or replace function private.list_public_games_impl(
  p_limit integer default 50,
  p_query text default null,
  p_mode public.play_mode default null,
  p_quick text default null,
  p_open_only boolean default false
)
returns table(
  id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  mode public.play_mode,
  custom_location text,
  city text,
  online_platform text,
  additional_players_required integer,
  accepted_players_count integer,
  remaining_players integer,
  required_skill_levels public.skill_level[],
  total_cost numeric,
  payment_method public.payment_method,
  venue_booked boolean,
  activity_name_lv text,
  activity_name_en text
)
language sql
stable
security definer
set search_path=''
as $$
  select
    g.id,
    g.starts_at,
    g.ends_at,
    g.mode,
    g.custom_location,
    g.city,
    g.online_platform,
    g.additional_players_required,
    private.accepted_count(g.id),
    greatest(0, g.additional_players_required - private.accepted_count(g.id)),
    g.required_skill_levels,
    g.total_cost,
    g.payment_method,
    g.venue_booked,
    a.name_lv,
    a.name_en
  from public.games g
  join public.activities a on a.id=g.activity_id
  where g.visibility='public'
    and g.cancelled_at is null
    and g.ends_at>now()
    and (
      nullif(trim(p_query),'') is null
      or lower(a.name_lv) like '%' || lower(trim(p_query)) || '%'
      or lower(a.name_en) like '%' || lower(trim(p_query)) || '%'
      or lower(coalesce(g.city,'')) like '%' || lower(trim(p_query)) || '%'
      or lower(coalesce(g.custom_location,'')) like '%' || lower(trim(p_query)) || '%'
      or lower(coalesce(g.online_platform,'')) like '%' || lower(trim(p_query)) || '%'
    )
    and (p_mode is null or g.mode=p_mode or g.mode='both')
    and (
      coalesce(p_open_only,false)=false
      or private.accepted_count(g.id) < g.additional_players_required
    )
    and (
      p_quick is null
      or p_quick=''
      or (
        p_quick='today'
        and (g.starts_at at time zone 'Europe/Riga')::date = (now() at time zone 'Europe/Riga')::date
      )
      or (
        p_quick='tomorrow'
        and (g.starts_at at time zone 'Europe/Riga')::date = (now() at time zone 'Europe/Riga')::date + 1
      )
      or (
        p_quick='week'
        and (g.starts_at at time zone 'Europe/Riga')::date between
          (now() at time zone 'Europe/Riga')::date
          and (now() at time zone 'Europe/Riga')::date + 7
      )
    )
  order by
    case when private.accepted_count(g.id) < g.additional_players_required then 0 else 1 end,
    g.starts_at asc
  limit greatest(1, least(coalesce(p_limit,50),100));
$$;

revoke all on function private.list_public_games_impl(integer,text,public.play_mode,text,boolean) from public,anon,authenticated;
grant execute on function private.list_public_games_impl(integer,text,public.play_mode,text,boolean) to anon,authenticated;

create or replace function public.list_public_games(
  p_limit integer default 50,
  p_query text default null,
  p_mode public.play_mode default null,
  p_quick text default null,
  p_open_only boolean default false
)
returns table(
  id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  mode public.play_mode,
  custom_location text,
  city text,
  online_platform text,
  additional_players_required integer,
  accepted_players_count integer,
  remaining_players integer,
  required_skill_levels public.skill_level[],
  total_cost numeric,
  payment_method public.payment_method,
  venue_booked boolean,
  activity_name_lv text,
  activity_name_en text
)
language sql
stable
security invoker
set search_path=''
as $$ select * from private.list_public_games_impl($1,$2,$3,$4,$5); $$;

revoke all on function public.list_public_games(integer,text,public.play_mode,text,boolean) from public;
grant execute on function public.list_public_games(integer,text,public.play_mode,text,boolean) to anon,authenticated;

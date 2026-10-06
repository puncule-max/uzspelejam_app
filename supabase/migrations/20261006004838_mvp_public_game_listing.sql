
create or replace function public.list_public_games(p_limit integer default 50)
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
    private.accepted_count(g.id) as accepted_players_count,
    greatest(0, g.additional_players_required - private.accepted_count(g.id)) as remaining_players,
    g.required_skill_levels,
    g.total_cost,
    g.payment_method,
    g.venue_booked,
    a.name_en
  from public.games g
  join public.activities a on a.id=g.activity_id
  where g.visibility='public'
    and g.cancelled_at is null
    and g.ends_at>now()
  order by
    case when private.accepted_count(g.id) < g.additional_players_required then 0 else 1 end,
    g.starts_at asc
  limit greatest(1, least(coalesce(p_limit,50),100));
$$;

revoke all on function public.list_public_games(integer) from public;
grant execute on function public.list_public_games(integer) to anon,authenticated;

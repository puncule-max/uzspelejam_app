
create or replace function private.list_public_games_filtered_impl(
  p_limit integer default 50,
  p_query text default null,
  p_mode public.play_mode default null,
  p_quick text default null,
  p_open_only boolean default false,
  p_activity_id uuid default null,
  p_category text default null,
  p_city text default null,
  p_skill public.skill_level default null,
  p_gender public.gender_preference default null,
  p_price text default null,
  p_venue_booked boolean default null
)
returns table(
  id uuid,
  activity_id uuid,
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
  gender_preference public.gender_preference,
  total_cost numeric,
  payment_method public.payment_method,
  venue_booked boolean,
  activity_name_lv text,
  activity_name_en text,
  category text
)
language sql
stable
security definer
set search_path=''
as $$
  select
    g.id,
    g.activity_id,
    g.starts_at,
    g.ends_at,
    g.mode,
    g.custom_location,
    g.city,
    g.online_platform,
    g.additional_players_required,
    private.accepted_count(g.id),
    greatest(0,g.additional_players_required-private.accepted_count(g.id)),
    g.required_skill_levels,
    g.gender_preference,
    g.total_cost,
    g.payment_method,
    g.venue_booked,
    a.name_lv,
    a.name_en,
    a.category
  from public.games g
  join public.activities a on a.id=g.activity_id
  join public.profiles organizer on organizer.id=g.creator_id
  left join public.venues v on v.id=g.venue_id
  where g.visibility='public'
    and g.cancelled_at is null
    and g.ends_at>now()
    and (
      nullif(trim(p_query),'') is null
      or lower(a.name_lv) like '%'||lower(trim(p_query))||'%'
      or lower(a.name_en) like '%'||lower(trim(p_query))||'%'
      or lower(coalesce(g.city,'')) like '%'||lower(trim(p_query))||'%'
      or lower(coalesce(g.custom_location,'')) like '%'||lower(trim(p_query))||'%'
      or lower(coalesce(g.online_platform,'')) like '%'||lower(trim(p_query))||'%'
      or lower(coalesce(organizer.display_name,'')) like '%'||lower(trim(p_query))||'%'
      or lower(coalesce(v.name,'')) like '%'||lower(trim(p_query))||'%'
      or lower(coalesce(v.address,'')) like '%'||lower(trim(p_query))||'%'
    )
    and (p_mode is null or g.mode=p_mode or g.mode='both')
    and (p_activity_id is null or g.activity_id=p_activity_id)
    and (nullif(trim(p_category),'') is null or a.category=p_category)
    and (nullif(trim(p_city),'') is null or lower(coalesce(g.city,''))=lower(trim(p_city)))
    and (
      p_skill is null
      or cardinality(g.required_skill_levels)=0
      or p_skill=any(g.required_skill_levels)
    )
    and (
      p_gender is null
      or g.gender_preference='anyone'
      or g.gender_preference=p_gender
    )
    and (
      p_price is null or p_price=''
      or (p_price='free' and g.payment_method='free')
      or (p_price='paid' and g.payment_method<>'free')
    )
    and (p_venue_booked is null or g.venue_booked=p_venue_booked)
    and (
      coalesce(p_open_only,false)=false
      or private.accepted_count(g.id)<g.additional_players_required
    )
    and (
      p_quick is null or p_quick=''
      or (
        p_quick='today'
        and (g.starts_at at time zone 'Europe/Riga')::date=(now() at time zone 'Europe/Riga')::date
      )
      or (
        p_quick='tomorrow'
        and (g.starts_at at time zone 'Europe/Riga')::date=(now() at time zone 'Europe/Riga')::date+1
      )
      or (
        p_quick='week'
        and (g.starts_at at time zone 'Europe/Riga')::date between
          (now() at time zone 'Europe/Riga')::date
          and (now() at time zone 'Europe/Riga')::date+7
      )
      or (
        p_quick='weekend'
        and (g.starts_at at time zone 'Europe/Riga')::date between
          (now() at time zone 'Europe/Riga')::date
            + ((6-extract(isodow from (now() at time zone 'Europe/Riga')::date)::int+7)%7)
          and
          (now() at time zone 'Europe/Riga')::date
            + ((6-extract(isodow from (now() at time zone 'Europe/Riga')::date)::int+7)%7)
            + 1
      )
      or (
        left(p_quick,5)='date:'
        and (g.starts_at at time zone 'Europe/Riga')::date=to_date(substring(p_quick from 6),'YYYY-MM-DD')
      )
    )
  order by
    case when private.accepted_count(g.id)<g.additional_players_required then 0 else 1 end,
    g.starts_at asc
  limit greatest(1,least(coalesce(p_limit,50),100));
$$;

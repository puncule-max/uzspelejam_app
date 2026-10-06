
alter table public.games
add column if not exists organizer_share_included boolean not null default true;

create or replace function private.create_game_with_requirements_impl(
  p_activity_id uuid,
  p_mode public.play_mode,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_additional_players_required integer,
  p_visibility public.game_visibility,
  p_required_skill_levels public.skill_level[],
  p_gender_preference public.gender_preference,
  p_custom_location text,
  p_city text,
  p_online_platform text,
  p_total_cost numeric,
  p_payment_method public.payment_method,
  p_venue_booked boolean,
  p_cancellation_policy_minutes integer,
  p_description text,
  p_position_requirements jsonb,
  p_organizer_share_included boolean
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_game_id uuid;
begin
  v_game_id:=private.create_game_with_requirements_impl(
    p_activity_id,p_mode,p_starts_at,p_ends_at,p_additional_players_required,p_visibility,
    p_required_skill_levels,p_gender_preference,p_custom_location,p_city,p_online_platform,
    p_total_cost,p_payment_method,p_venue_booked,p_cancellation_policy_minutes,p_description,
    p_position_requirements
  );
  update public.games
  set organizer_share_included=coalesce(p_organizer_share_included,true)
  where id=v_game_id;
  return v_game_id;
end;
$$;

revoke all on function private.create_game_with_requirements_impl(
  uuid,public.play_mode,timestamptz,timestamptz,integer,public.game_visibility,
  public.skill_level[],public.gender_preference,text,text,text,numeric,
  public.payment_method,boolean,integer,text,jsonb,boolean
) from public,anon;
grant execute on function private.create_game_with_requirements_impl(
  uuid,public.play_mode,timestamptz,timestamptz,integer,public.game_visibility,
  public.skill_level[],public.gender_preference,text,text,text,numeric,
  public.payment_method,boolean,integer,text,jsonb,boolean
) to authenticated;

create or replace function public.create_game_with_requirements(
  p_activity_id uuid,
  p_mode public.play_mode,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_additional_players_required integer,
  p_visibility public.game_visibility default 'public',
  p_required_skill_levels public.skill_level[] default '{}',
  p_gender_preference public.gender_preference default 'anyone',
  p_custom_location text default null,
  p_city text default null,
  p_online_platform text default null,
  p_total_cost numeric default 0,
  p_payment_method public.payment_method default 'free',
  p_venue_booked boolean default null,
  p_cancellation_policy_minutes integer default null,
  p_description text default null,
  p_position_requirements jsonb default '{}'::jsonb,
  p_organizer_share_included boolean default true
)
returns uuid
language sql
security invoker
set search_path=''
as $$
  select private.create_game_with_requirements_impl(
    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18
  );
$$;

revoke all on function public.create_game_with_requirements(
  uuid,public.play_mode,timestamptz,timestamptz,integer,public.game_visibility,
  public.skill_level[],public.gender_preference,text,text,text,numeric,
  public.payment_method,boolean,integer,text,jsonb,boolean
) from public,anon;
grant execute on function public.create_game_with_requirements(
  uuid,public.play_mode,timestamptz,timestamptz,integer,public.game_visibility,
  public.skill_level[],public.gender_preference,text,text,text,numeric,
  public.payment_method,boolean,integer,text,jsonb,boolean
) to authenticated;

create or replace function private.update_game_details_impl(
  p_game_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_custom_location text,
  p_city text,
  p_online_platform text,
  p_total_cost numeric,
  p_payment_method public.payment_method,
  p_venue_booked boolean,
  p_cancellation_policy_minutes integer,
  p_description text,
  p_organizer_share_included boolean
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid:=auth.uid();
  v_old public.games%rowtype;
  v_date_changed boolean;
  v_time_changed boolean;
  v_venue_changed boolean;
  v_price_changed boolean;
  v_booking_changed boolean;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_old from public.games where id=p_game_id for update;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  if v_old.creator_id<>v_user then raise exception 'ORGANIZER_REQUIRED'; end if;
  if v_old.cancelled_at is not null then raise exception 'GAME_CANCELLED'; end if;
  if v_old.ends_at<=now() then raise exception 'GAME_COMPLETED'; end if;
  if p_starts_at<=now() then raise exception 'GAME_MUST_BE_FUTURE'; end if;
  if p_ends_at<=p_starts_at then raise exception 'INVALID_TIME_RANGE'; end if;
  if coalesce(p_total_cost,0)<0 then raise exception 'INVALID_COST'; end if;

  v_date_changed :=
    (v_old.starts_at at time zone 'Europe/Riga')::date
    is distinct from
    (p_starts_at at time zone 'Europe/Riga')::date;

  v_time_changed :=
    (v_old.starts_at at time zone 'Europe/Riga')::time
    is distinct from
    (p_starts_at at time zone 'Europe/Riga')::time
    or
    (v_old.ends_at at time zone 'Europe/Riga')::time
    is distinct from
    (p_ends_at at time zone 'Europe/Riga')::time;

  v_venue_changed :=
    coalesce(v_old.custom_location,'') is distinct from coalesce(nullif(trim(p_custom_location),''),'')
    or coalesce(v_old.city,'') is distinct from coalesce(nullif(trim(p_city),''),'')
    or coalesce(v_old.online_platform,'') is distinct from coalesce(nullif(trim(p_online_platform),''),'');

  v_price_changed :=
    v_old.total_cost is distinct from coalesce(p_total_cost,0)
    or v_old.payment_method is distinct from p_payment_method
    or v_old.organizer_share_included is distinct from coalesce(p_organizer_share_included,true);

  v_booking_changed := v_old.venue_booked is distinct from p_venue_booked;

  update public.games
  set
    starts_at=p_starts_at,
    ends_at=p_ends_at,
    custom_location=nullif(trim(p_custom_location),''),
    city=nullif(trim(p_city),''),
    online_platform=nullif(trim(p_online_platform),''),
    total_cost=coalesce(p_total_cost,0),
    payment_method=p_payment_method,
    organizer_share_included=coalesce(p_organizer_share_included,true),
    venue_booked=p_venue_booked,
    cancellation_policy_minutes=p_cancellation_policy_minutes,
    description=nullif(trim(p_description),''),
    updated_at=now()
  where id=p_game_id;

  if v_date_changed then
    perform private.notify_game_audience(p_game_id,'date_changed','notify_date_change',jsonb_build_object('starts_at',p_starts_at));
  end if;
  if v_time_changed then
    perform private.notify_game_audience(p_game_id,'time_changed','notify_time_change',jsonb_build_object('starts_at',p_starts_at,'ends_at',p_ends_at));
  end if;
  if v_venue_changed then
    perform private.notify_game_audience(p_game_id,'venue_changed','notify_venue_change',jsonb_build_object('city',p_city,'location',p_custom_location,'platform',p_online_platform));
  end if;
  if v_price_changed then
    perform private.notify_game_audience(
      p_game_id,'price_changed','notify_price_change',
      jsonb_build_object(
        'total_cost',p_total_cost,
        'payment_method',p_payment_method,
        'organizer_share_included',coalesce(p_organizer_share_included,true)
      )
    );
  end if;
  if v_booking_changed then
    perform private.notify_game_audience(p_game_id,'booking_status_changed','notify_booking_status',jsonb_build_object('venue_booked',p_venue_booked));
  end if;
end;
$$;

revoke all on function private.update_game_details_impl(
  uuid,timestamptz,timestamptz,text,text,text,numeric,public.payment_method,boolean,integer,text,boolean
) from public,anon;
grant execute on function private.update_game_details_impl(
  uuid,timestamptz,timestamptz,text,text,text,numeric,public.payment_method,boolean,integer,text,boolean
) to authenticated;

create or replace function public.update_game_details(
  p_game_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_custom_location text default null,
  p_city text default null,
  p_online_platform text default null,
  p_total_cost numeric default 0,
  p_payment_method public.payment_method default 'free',
  p_venue_booked boolean default null,
  p_cancellation_policy_minutes integer default null,
  p_description text default null,
  p_organizer_share_included boolean default true
)
returns void
language sql
security invoker
set search_path=''
as $$
  select private.update_game_details_impl($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12);
$$;

revoke all on function public.update_game_details(
  uuid,timestamptz,timestamptz,text,text,text,numeric,public.payment_method,boolean,integer,text,boolean
) from public,anon;
grant execute on function public.update_game_details(
  uuid,timestamptz,timestamptz,text,text,text,numeric,public.payment_method,boolean,integer,text,boolean
) to authenticated;

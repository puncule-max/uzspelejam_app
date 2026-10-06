
alter type public.notification_type add value if not exists 'date_changed';
alter type public.notification_type add value if not exists 'time_changed';
alter type public.notification_type add value if not exists 'venue_changed';
alter type public.notification_type add value if not exists 'price_changed';
alter type public.notification_type add value if not exists 'booking_status_changed';
alter type public.notification_type add value if not exists 'new_player';

create or replace function private.notify_game_audience(
  p_game_id uuid,
  p_type public.notification_type,
  p_follower_flag text,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if p_follower_flag not in (
    'notify_date_change','notify_time_change','notify_venue_change','notify_price_change',
    'notify_new_players','notify_booking_status','notify_cancelled','notify_fully_booked'
  ) then
    raise exception 'INVALID_FOLLOWER_FLAG';
  end if;

  execute format(
    $q$
      insert into public.notifications(user_id,game_id,type,payload)
      select distinct audience.user_id,$1,$2,$3
      from (
        select gp.user_id
        from public.game_participants gp
        where gp.game_id=$1 and gp.status='accepted'
        union
        select gf.user_id
        from public.game_followers gf
        where gf.game_id=$1 and gf.%I=true
      ) audience
      where audience.user_id <> (select creator_id from public.games where id=$1)
    $q$,
    p_follower_flag
  )
  using p_game_id,p_type,coalesce(p_payload,'{}'::jsonb);
end;
$$;
revoke all on function private.notify_game_audience(uuid,public.notification_type,text,jsonb) from public,anon,authenticated;

create or replace function private.update_game_details_impl(
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
  p_description text default null
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
    or v_old.payment_method is distinct from p_payment_method;

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
    perform private.notify_game_audience(p_game_id,'price_changed','notify_price_change',jsonb_build_object('total_cost',p_total_cost,'payment_method',p_payment_method));
  end if;
  if v_booking_changed then
    perform private.notify_game_audience(p_game_id,'booking_status_changed','notify_booking_status',jsonb_build_object('venue_booked',p_venue_booked));
  end if;
end;
$$;

create or replace function private.cancel_game_impl(
  p_game_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_game public.games%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_game from public.games where id=p_game_id for update;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  if v_game.creator_id<>v_user then raise exception 'ORGANIZER_REQUIRED'; end if;
  if v_game.cancelled_at is not null then return; end if;
  if v_game.ends_at<=now() then raise exception 'GAME_COMPLETED'; end if;

  update public.games
  set cancelled_at=now(),
      cancellation_reason=nullif(trim(p_reason),''),
      updated_at=now()
  where id=p_game_id;

  perform private.notify_game_audience(
    p_game_id,
    'game_cancelled',
    'notify_cancelled',
    jsonb_build_object('reason',nullif(trim(p_reason),''))
  );
end;
$$;

revoke all on function private.update_game_details_impl(uuid,timestamptz,timestamptz,text,text,text,numeric,public.payment_method,boolean,integer,text) from public,anon;
revoke all on function private.cancel_game_impl(uuid,text) from public,anon;
grant execute on function private.update_game_details_impl(uuid,timestamptz,timestamptz,text,text,text,numeric,public.payment_method,boolean,integer,text) to authenticated;
grant execute on function private.cancel_game_impl(uuid,text) to authenticated;

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
  p_description text default null
)
returns void language sql security invoker set search_path=''
as $$ select private.update_game_details_impl($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11); $$;

create or replace function public.cancel_game(p_game_id uuid,p_reason text default null)
returns void language sql security invoker set search_path=''
as $$ select private.cancel_game_impl($1,$2); $$;

revoke all on function public.update_game_details(uuid,timestamptz,timestamptz,text,text,text,numeric,public.payment_method,boolean,integer,text) from public,anon;
revoke all on function public.cancel_game(uuid,text) from public,anon;
grant execute on function public.update_game_details(uuid,timestamptz,timestamptz,text,text,text,numeric,public.payment_method,boolean,integer,text) to authenticated;
grant execute on function public.cancel_game(uuid,text) to authenticated;

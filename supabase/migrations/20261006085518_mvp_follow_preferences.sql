
create or replace function private.update_follow_preferences_impl(
  p_game_id uuid,
  p_notify_spot_available boolean,
  p_notify_fully_booked boolean,
  p_notify_date_change boolean,
  p_notify_time_change boolean,
  p_notify_venue_change boolean,
  p_notify_price_change boolean,
  p_notify_new_players boolean,
  p_notify_booking_status boolean,
  p_notify_cancelled boolean,
  p_push_enabled boolean
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if not private.can_view_game(p_game_id,v_user) then raise exception 'GAME_NOT_ACCESSIBLE'; end if;

  insert into public.game_followers(
    game_id,user_id,
    notify_spot_available,notify_fully_booked,notify_date_change,notify_time_change,
    notify_venue_change,notify_price_change,notify_new_players,notify_booking_status,
    notify_cancelled,push_enabled,updated_at
  )
  values(
    p_game_id,v_user,
    coalesce(p_notify_spot_available,false),coalesce(p_notify_fully_booked,false),
    coalesce(p_notify_date_change,false),coalesce(p_notify_time_change,false),
    coalesce(p_notify_venue_change,false),coalesce(p_notify_price_change,false),
    coalesce(p_notify_new_players,false),coalesce(p_notify_booking_status,false),
    coalesce(p_notify_cancelled,false),coalesce(p_push_enabled,false),now()
  )
  on conflict(game_id,user_id) do update set
    notify_spot_available=excluded.notify_spot_available,
    notify_fully_booked=excluded.notify_fully_booked,
    notify_date_change=excluded.notify_date_change,
    notify_time_change=excluded.notify_time_change,
    notify_venue_change=excluded.notify_venue_change,
    notify_price_change=excluded.notify_price_change,
    notify_new_players=excluded.notify_new_players,
    notify_booking_status=excluded.notify_booking_status,
    notify_cancelled=excluded.notify_cancelled,
    push_enabled=excluded.push_enabled,
    updated_at=now();
end;
$$;

revoke all on function private.update_follow_preferences_impl(uuid,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean) from public,anon;
grant execute on function private.update_follow_preferences_impl(uuid,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean) to authenticated;

create or replace function public.update_follow_preferences(
  p_game_id uuid,
  p_notify_spot_available boolean,
  p_notify_fully_booked boolean,
  p_notify_date_change boolean,
  p_notify_time_change boolean,
  p_notify_venue_change boolean,
  p_notify_price_change boolean,
  p_notify_new_players boolean,
  p_notify_booking_status boolean,
  p_notify_cancelled boolean,
  p_push_enabled boolean
)
returns void
language sql
security invoker
set search_path=''
as $$
  select private.update_follow_preferences_impl(
    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
  );
$$;

revoke all on function public.update_follow_preferences(uuid,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean) from public,anon;
grant execute on function public.update_follow_preferences(uuid,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean) to authenticated;

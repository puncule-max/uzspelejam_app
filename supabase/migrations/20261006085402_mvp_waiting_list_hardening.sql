
create or replace function private.join_waiting_list_impl(p_game_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_game public.games%rowtype; v_id uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_game from public.games where id=p_game_id for update;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  if v_game.creator_id=v_user then raise exception 'ORGANIZER_CANNOT_JOIN_WAITING'; end if;
  if v_game.cancelled_at is not null or v_game.ends_at<=now() then raise exception 'GAME_NOT_ACTIVE'; end if;
  if not private.can_view_game(p_game_id,v_user) then raise exception 'GAME_NOT_ACCESSIBLE'; end if;
  if exists(
    select 1 from public.blocks
    where (blocker_user_id=v_user and blocked_user_id=v_game.creator_id)
       or (blocker_user_id=v_game.creator_id and blocked_user_id=v_user)
  ) then raise exception 'USER_BLOCKED'; end if;
  if private.accepted_count(p_game_id) < v_game.additional_players_required then raise exception 'GAME_HAS_OPEN_SPOTS'; end if;
  if exists(select 1 from public.game_participants where game_id=p_game_id and user_id=v_user and status='accepted') then raise exception 'ALREADY_ACCEPTED'; end if;
  if exists(select 1 from public.game_applications where game_id=p_game_id and user_id=v_user and status='pending') then raise exception 'APPLICATION_PENDING'; end if;

  insert into public.game_waiting_list(game_id,user_id,status)
  values(p_game_id,v_user,'active')
  on conflict(game_id,user_id) do update set status='active',updated_at=now(),created_at=now()
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function private.my_waiting_list_position_impl(p_game_id uuid)
returns integer
language sql
stable
security definer
set search_path=''
as $$
  with mine as (
    select created_at
    from public.game_waiting_list
    where game_id=p_game_id and user_id=auth.uid() and status='active'
    limit 1
  )
  select case
    when not exists(select 1 from mine) then null
    else 1 + (
      select count(*)::integer
      from public.game_waiting_list w, mine m
      where w.game_id=p_game_id and w.status='active' and w.created_at < m.created_at
    )
  end;
$$;
revoke all on function private.my_waiting_list_position_impl(uuid) from public,anon;
grant execute on function private.my_waiting_list_position_impl(uuid) to authenticated;

create or replace function public.my_waiting_list_position(p_game_id uuid)
returns integer
language sql
stable
security invoker
set search_path=''
as $$ select private.my_waiting_list_position_impl($1); $$;
revoke all on function public.my_waiting_list_position(uuid) from public,anon;
grant execute on function public.my_waiting_list_position(uuid) to authenticated;


create or replace function private.accept_application_impl(
  p_application_id uuid,
  p_team_id uuid default null,
  p_position_id uuid default null
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid:=auth.uid();
  v_app public.game_applications%rowtype;
  v_game public.games%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_app
  from public.game_applications
  where id=p_application_id
  for update;

  if not found or v_app.status<>'pending' then
    raise exception 'PENDING_APPLICATION_NOT_FOUND';
  end if;

  select * into v_game
  from public.games
  where id=v_app.game_id
  for update;

  if v_game.creator_id<>v_user then raise exception 'ORGANIZER_REQUIRED'; end if;
  if v_game.cancelled_at is not null or v_game.ends_at<=now() then raise exception 'GAME_NOT_ACTIVE'; end if;
  if private.accepted_count(v_game.id) >= v_game.additional_players_required then raise exception 'GAME_FULL'; end if;

  if p_team_id is not null and not exists(
    select 1 from public.game_teams
    where id=p_team_id and game_id=v_game.id
  ) then raise exception 'TEAM_NOT_VALID_FOR_GAME'; end if;

  if p_position_id is not null and not exists(
    select 1 from public.positions
    where id=p_position_id and activity_id=v_game.activity_id and active
  ) then raise exception 'POSITION_NOT_VALID_FOR_ACTIVITY'; end if;

  insert into public.game_participants(
    game_id,user_id,team_id,position_id,status,joined_at,left_at
  )
  values(
    v_game.id,
    v_app.user_id,
    p_team_id,
    coalesce(p_position_id,v_app.requested_position_id),
    'accepted',
    now(),
    null
  )
  on conflict(game_id,user_id) do update set
    status='accepted',
    team_id=excluded.team_id,
    position_id=excluded.position_id,
    joined_at=now(),
    left_at=null;

  update public.game_applications
  set status='accepted',updated_at=now()
  where id=v_app.id;

  update public.game_waiting_list
  set status='promoted',updated_at=now()
  where game_id=v_game.id and user_id=v_app.user_id and status='active';

  insert into public.notifications(user_id,game_id,type,payload)
  values(v_app.user_id,v_game.id,'application_accepted','{}'::jsonb);
end;
$$;

create or replace function private.promote_waiting_user_impl(
  p_waiting_id uuid,
  p_team_id uuid default null,
  p_position_id uuid default null
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid:=auth.uid();
  v_wait public.game_waiting_list%rowtype;
  v_game public.games%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_wait
  from public.game_waiting_list
  where id=p_waiting_id
  for update;

  if not found or v_wait.status<>'active' then
    raise exception 'ACTIVE_WAITING_ENTRY_NOT_FOUND';
  end if;

  select * into v_game
  from public.games
  where id=v_wait.game_id
  for update;

  if v_game.creator_id<>v_user then raise exception 'ORGANIZER_REQUIRED'; end if;
  if v_game.cancelled_at is not null or v_game.ends_at<=now() then raise exception 'GAME_NOT_ACTIVE'; end if;
  if private.accepted_count(v_game.id) >= v_game.additional_players_required then raise exception 'GAME_FULL'; end if;

  if p_team_id is not null and not exists(
    select 1 from public.game_teams
    where id=p_team_id and game_id=v_game.id
  ) then raise exception 'TEAM_NOT_VALID_FOR_GAME'; end if;

  if p_position_id is not null and not exists(
    select 1 from public.positions
    where id=p_position_id and activity_id=v_game.activity_id and active
  ) then raise exception 'POSITION_NOT_VALID_FOR_ACTIVITY'; end if;

  insert into public.game_participants(
    game_id,user_id,team_id,position_id,status,joined_at,left_at
  )
  values(
    v_game.id,v_wait.user_id,p_team_id,p_position_id,'accepted',now(),null
  )
  on conflict(game_id,user_id) do update set
    status='accepted',
    team_id=excluded.team_id,
    position_id=excluded.position_id,
    joined_at=now(),
    left_at=null;

  update public.game_waiting_list
  set status='promoted',updated_at=now()
  where id=v_wait.id;

  update public.game_applications
  set status='accepted',updated_at=now()
  where game_id=v_game.id and user_id=v_wait.user_id and status='pending';

  insert into public.notifications(user_id,game_id,type,payload)
  values(v_wait.user_id,v_game.id,'waiting_list_promoted','{}'::jsonb);
end;
$$;

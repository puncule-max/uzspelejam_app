
create or replace function private.notify_game_audience_excluding(
  p_game_id uuid,
  p_type public.notification_type,
  p_follower_flag text,
  p_exclude_user uuid default null,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if p_follower_flag not in (
    'notify_spot_available','notify_date_change','notify_time_change','notify_venue_change',
    'notify_price_change','notify_new_players','notify_booking_status','notify_cancelled',
    'notify_fully_booked'
  ) then raise exception 'INVALID_FOLLOWER_FLAG'; end if;

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
        and ($4 is null or audience.user_id<>$4)
    $q$,
    p_follower_flag
  )
  using p_game_id,p_type,coalesce(p_payload,'{}'::jsonb),p_exclude_user;
end;
$$;
revoke all on function private.notify_game_audience_excluding(uuid,public.notification_type,text,uuid,jsonb) from public,anon,authenticated;

create or replace function private.ensure_group_membership(p_game_id uuid,p_user_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_conversation uuid;
begin
  select id into v_conversation
  from public.conversations
  where game_id=p_game_id and type='group'
  limit 1;

  if v_conversation is not null then
    insert into public.conversation_members(conversation_id,user_id,joined_at,left_at)
    values(v_conversation,p_user_id,now(),null)
    on conflict(conversation_id,user_id) do update
      set joined_at=now(),left_at=null;
  end if;
end;
$$;
revoke all on function private.ensure_group_membership(uuid,uuid) from public,anon,authenticated;

create or replace function private.leave_group_membership(p_game_id uuid,p_user_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  update public.conversation_members cm
  set left_at=now()
  from public.conversations c
  where c.id=cm.conversation_id
    and c.game_id=p_game_id
    and c.type='group'
    and cm.user_id=p_user_id
    and cm.left_at is null;
end;
$$;
revoke all on function private.leave_group_membership(uuid,uuid) from public,anon,authenticated;

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
  v_after_count integer;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_app from public.game_applications where id=p_application_id for update;
  if not found or v_app.status<>'pending' then raise exception 'PENDING_APPLICATION_NOT_FOUND'; end if;

  select * into v_game from public.games where id=v_app.game_id for update;
  if v_game.creator_id<>v_user then raise exception 'ORGANIZER_REQUIRED'; end if;
  if v_game.cancelled_at is not null or v_game.ends_at<=now() then raise exception 'GAME_NOT_ACTIVE'; end if;
  if private.accepted_count(v_game.id) >= v_game.additional_players_required then raise exception 'GAME_FULL'; end if;

  if p_team_id is not null and not exists(
    select 1 from public.game_teams where id=p_team_id and game_id=v_game.id
  ) then raise exception 'TEAM_NOT_VALID_FOR_GAME'; end if;

  if p_position_id is not null and not exists(
    select 1 from public.positions where id=p_position_id and activity_id=v_game.activity_id and active
  ) then raise exception 'POSITION_NOT_VALID_FOR_ACTIVITY'; end if;

  insert into public.game_participants(game_id,user_id,team_id,position_id,status,joined_at,left_at)
  values(v_game.id,v_app.user_id,p_team_id,coalesce(p_position_id,v_app.requested_position_id),'accepted',now(),null)
  on conflict(game_id,user_id) do update set
    status='accepted',
    team_id=excluded.team_id,
    position_id=excluded.position_id,
    joined_at=now(),
    left_at=null;

  update public.game_applications set status='accepted',updated_at=now() where id=v_app.id;
  update public.game_waiting_list set status='promoted',updated_at=now()
  where game_id=v_game.id and user_id=v_app.user_id and status='active';

  perform private.ensure_group_membership(v_game.id,v_app.user_id);

  insert into public.notifications(user_id,game_id,type,payload)
  values(v_app.user_id,v_game.id,'application_accepted','{}'::jsonb);

  perform private.notify_game_audience_excluding(
    v_game.id,'new_player','notify_new_players',v_app.user_id,
    jsonb_build_object('user_id',v_app.user_id)
  );

  v_after_count:=private.accepted_count(v_game.id);
  if v_after_count>=v_game.additional_players_required then
    perform private.notify_game_audience_excluding(
      v_game.id,'fully_booked','notify_fully_booked',null,'{}'::jsonb
    );
  end if;
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
  v_after_count integer;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_wait from public.game_waiting_list where id=p_waiting_id for update;
  if not found or v_wait.status<>'active' then raise exception 'ACTIVE_WAITING_ENTRY_NOT_FOUND'; end if;

  select * into v_game from public.games where id=v_wait.game_id for update;
  if v_game.creator_id<>v_user then raise exception 'ORGANIZER_REQUIRED'; end if;
  if v_game.cancelled_at is not null or v_game.ends_at<=now() then raise exception 'GAME_NOT_ACTIVE'; end if;
  if private.accepted_count(v_game.id) >= v_game.additional_players_required then raise exception 'GAME_FULL'; end if;

  if p_team_id is not null and not exists(
    select 1 from public.game_teams where id=p_team_id and game_id=v_game.id
  ) then raise exception 'TEAM_NOT_VALID_FOR_GAME'; end if;

  if p_position_id is not null and not exists(
    select 1 from public.positions where id=p_position_id and activity_id=v_game.activity_id and active
  ) then raise exception 'POSITION_NOT_VALID_FOR_ACTIVITY'; end if;

  insert into public.game_participants(game_id,user_id,team_id,position_id,status,joined_at,left_at)
  values(v_game.id,v_wait.user_id,p_team_id,p_position_id,'accepted',now(),null)
  on conflict(game_id,user_id) do update set
    status='accepted',
    team_id=excluded.team_id,
    position_id=excluded.position_id,
    joined_at=now(),
    left_at=null;

  update public.game_waiting_list set status='promoted',updated_at=now() where id=v_wait.id;
  update public.game_applications set status='accepted',updated_at=now()
  where game_id=v_game.id and user_id=v_wait.user_id and status='pending';

  perform private.ensure_group_membership(v_game.id,v_wait.user_id);

  insert into public.notifications(user_id,game_id,type,payload)
  values(v_wait.user_id,v_game.id,'waiting_list_promoted','{}'::jsonb);

  perform private.notify_game_audience_excluding(
    v_game.id,'new_player','notify_new_players',v_wait.user_id,
    jsonb_build_object('user_id',v_wait.user_id)
  );

  v_after_count:=private.accepted_count(v_game.id);
  if v_after_count>=v_game.additional_players_required then
    perform private.notify_game_audience_excluding(
      v_game.id,'fully_booked','notify_fully_booked',null,'{}'::jsonb
    );
  end if;
end;
$$;

create or replace function private.leave_game_impl(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_game public.games%rowtype; v_was_full boolean;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_game from public.games where id=p_game_id for update;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;

  v_was_full := private.accepted_count(p_game_id) >= v_game.additional_players_required;

  update public.game_participants
  set status='left',left_at=now(),team_id=null
  where game_id=p_game_id and user_id=v_user and status='accepted';
  if not found then raise exception 'ACCEPTED_PARTICIPANT_NOT_FOUND'; end if;

  perform private.leave_group_membership(p_game_id,v_user);

  if v_was_full then
    perform private.notify_game_audience_excluding(
      p_game_id,'spot_available','notify_spot_available',v_user,'{}'::jsonb
    );
  end if;
end;
$$;

create or replace function private.update_participant_assignment_impl(
  p_game_id uuid,
  p_user_id uuid,
  p_team_id uuid default null,
  p_position_id uuid default null
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_game public.games%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_game from public.games where id=p_game_id;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  if v_game.creator_id<>v_user then raise exception 'ORGANIZER_REQUIRED'; end if;

  if p_team_id is not null and not exists(
    select 1 from public.game_teams where id=p_team_id and game_id=p_game_id
  ) then raise exception 'TEAM_NOT_VALID_FOR_GAME'; end if;

  if p_position_id is not null and not exists(
    select 1 from public.positions where id=p_position_id and activity_id=v_game.activity_id and active
  ) then raise exception 'POSITION_NOT_VALID_FOR_ACTIVITY'; end if;

  update public.game_participants
  set team_id=p_team_id,position_id=p_position_id
  where game_id=p_game_id and user_id=p_user_id and status='accepted';

  if not found then raise exception 'ACCEPTED_PARTICIPANT_NOT_FOUND'; end if;
end;
$$;

create or replace function private.remove_participant_impl(
  p_game_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_game public.games%rowtype; v_was_full boolean;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_game from public.games where id=p_game_id for update;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  if v_game.creator_id<>v_user then raise exception 'ORGANIZER_REQUIRED'; end if;
  if p_user_id=v_game.creator_id then raise exception 'CANNOT_REMOVE_ORGANIZER'; end if;

  v_was_full:=private.accepted_count(p_game_id)>=v_game.additional_players_required;

  update public.game_participants
  set status='removed',left_at=now(),team_id=null
  where game_id=p_game_id and user_id=p_user_id and status='accepted';
  if not found then raise exception 'ACCEPTED_PARTICIPANT_NOT_FOUND'; end if;

  perform private.leave_group_membership(p_game_id,p_user_id);

  insert into public.notifications(user_id,game_id,type,payload)
  values(p_user_id,p_game_id,'participant_removed','{}'::jsonb);

  if v_was_full then
    perform private.notify_game_audience_excluding(
      p_game_id,'spot_available','notify_spot_available',p_user_id,'{}'::jsonb
    );
  end if;
end;
$$;

revoke all on function private.update_participant_assignment_impl(uuid,uuid,uuid,uuid) from public,anon;
revoke all on function private.remove_participant_impl(uuid,uuid) from public,anon;
grant execute on function private.update_participant_assignment_impl(uuid,uuid,uuid,uuid) to authenticated;
grant execute on function private.remove_participant_impl(uuid,uuid) to authenticated;

create or replace function public.update_participant_assignment(
  p_game_id uuid,p_user_id uuid,p_team_id uuid default null,p_position_id uuid default null
)
returns void language sql security invoker set search_path=''
as $$ select private.update_participant_assignment_impl($1,$2,$3,$4); $$;

create or replace function public.remove_participant(p_game_id uuid,p_user_id uuid)
returns void language sql security invoker set search_path=''
as $$ select private.remove_participant_impl($1,$2); $$;

revoke all on function public.update_participant_assignment(uuid,uuid,uuid,uuid) from public,anon;
revoke all on function public.remove_participant(uuid,uuid) from public,anon;
grant execute on function public.update_participant_assignment(uuid,uuid,uuid,uuid) to authenticated;
grant execute on function public.remove_participant(uuid,uuid) to authenticated;

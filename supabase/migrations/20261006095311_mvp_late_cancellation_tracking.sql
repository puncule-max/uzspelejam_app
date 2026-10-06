
alter table public.game_participants
add column if not exists late_cancellation boolean not null default false;

create or replace function private.reset_late_cancellation_on_accept()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if new.status='accepted' then
    new.late_cancellation:=false;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_game_participants_reset_late_cancellation on public.game_participants;
create trigger trg_game_participants_reset_late_cancellation
before insert or update of status
on public.game_participants
for each row
execute function private.reset_late_cancellation_on_accept();

create or replace function private.leave_game_impl(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid:=auth.uid();
  v_game public.games%rowtype;
  v_was_full boolean;
  v_late boolean:=false;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_game
  from public.games
  where id=p_game_id
  for update;

  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  if v_game.cancelled_at is not null then raise exception 'GAME_CANCELLED'; end if;
  if v_game.ends_at<=now() then raise exception 'GAME_COMPLETED'; end if;

  v_was_full:=private.accepted_count(p_game_id)>=v_game.additional_players_required;
  v_late:=
    coalesce(v_game.cancellation_policy_minutes,0)>0
    and now()>v_game.starts_at-make_interval(mins=>v_game.cancellation_policy_minutes);

  update public.game_participants
  set
    status='left',
    left_at=now(),
    team_id=null,
    late_cancellation=v_late
  where game_id=p_game_id
    and user_id=v_user
    and status='accepted';

  if not found then raise exception 'ACCEPTED_PARTICIPANT_NOT_FOUND'; end if;

  perform private.leave_group_membership(p_game_id,v_user);

  if v_was_full then
    perform private.notify_game_audience_excluding(
      p_game_id,'spot_available','notify_spot_available',v_user,'{}'::jsonb
    );
  end if;
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
declare
  v_user uuid:=auth.uid();
  v_game public.games%rowtype;
  v_was_full boolean;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_game
  from public.games
  where id=p_game_id
  for update;

  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  if v_game.creator_id<>v_user then raise exception 'ORGANIZER_REQUIRED'; end if;
  if p_user_id=v_game.creator_id then raise exception 'CANNOT_REMOVE_ORGANIZER'; end if;

  v_was_full:=private.accepted_count(p_game_id)>=v_game.additional_players_required;

  update public.game_participants
  set
    status='removed',
    left_at=now(),
    team_id=null,
    late_cancellation=false
  where game_id=p_game_id
    and user_id=p_user_id
    and status='accepted';

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

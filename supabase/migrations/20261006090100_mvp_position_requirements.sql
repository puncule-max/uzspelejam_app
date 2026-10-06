
create table public.game_position_requirements (
  game_id uuid not null references public.games(id) on delete cascade,
  position_id uuid not null references public.positions(id) on delete cascade,
  required_count integer not null check (required_count between 1 and 99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(game_id,position_id)
);

create index idx_position_requirements_position on public.game_position_requirements(position_id);

alter table public.game_position_requirements enable row level security;

create policy position_requirements_visible_read on public.game_position_requirements
for select to authenticated
using (private.can_view_game(game_id,(select auth.uid())));

create policy position_requirements_anon_public_read on public.game_position_requirements
for select to anon
using (exists(select 1 from public.games g where g.id=game_id and g.visibility='public'));

grant select on public.game_position_requirements to anon,authenticated;

create or replace function private.set_position_requirement_impl(
  p_game_id uuid,
  p_position_id uuid,
  p_required_count integer
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_game public.games%rowtype; v_position public.positions%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_game from public.games where id=p_game_id;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  if v_game.creator_id<>v_user then raise exception 'ORGANIZER_REQUIRED'; end if;

  select * into v_position from public.positions where id=p_position_id and active;
  if not found or v_position.activity_id<>v_game.activity_id then raise exception 'POSITION_NOT_VALID_FOR_ACTIVITY'; end if;

  if coalesce(p_required_count,0)<=0 then
    delete from public.game_position_requirements where game_id=p_game_id and position_id=p_position_id;
  elsif p_required_count>99 then
    raise exception 'INVALID_REQUIRED_COUNT';
  else
    insert into public.game_position_requirements(game_id,position_id,required_count,updated_at)
    values(p_game_id,p_position_id,p_required_count,now())
    on conflict(game_id,position_id) do update
      set required_count=excluded.required_count,updated_at=now();
  end if;
end;
$$;

revoke all on function private.set_position_requirement_impl(uuid,uuid,integer) from public,anon;
grant execute on function private.set_position_requirement_impl(uuid,uuid,integer) to authenticated;

create or replace function public.set_position_requirement(
  p_game_id uuid,
  p_position_id uuid,
  p_required_count integer
)
returns void
language sql
security invoker
set search_path=''
as $$ select private.set_position_requirement_impl($1,$2,$3); $$;

revoke all on function public.set_position_requirement(uuid,uuid,integer) from public,anon;
grant execute on function public.set_position_requirement(uuid,uuid,integer) to authenticated;

create or replace function private.join_game_impl(p_game_id uuid,p_requested_position_id uuid default null)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_game public.games%rowtype; v_id uuid; v_status public.application_status;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_game from public.games where id=p_game_id for update;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  if v_game.creator_id=v_user then raise exception 'ORGANIZER_CANNOT_JOIN'; end if;
  if v_game.cancelled_at is not null then raise exception 'GAME_CANCELLED'; end if;
  if v_game.ends_at <= now() then raise exception 'GAME_COMPLETED'; end if;
  if not private.can_view_game(p_game_id,v_user) then raise exception 'GAME_NOT_ACCESSIBLE'; end if;
  if exists(select 1 from public.blocks where (blocker_user_id=v_user and blocked_user_id=v_game.creator_id) or (blocker_user_id=v_game.creator_id and blocked_user_id=v_user)) then raise exception 'USER_BLOCKED'; end if;
  if exists(select 1 from public.game_participants where game_id=p_game_id and user_id=v_user and status='accepted') then raise exception 'ALREADY_ACCEPTED'; end if;
  if exists(select 1 from public.game_waiting_list where game_id=p_game_id and user_id=v_user and status='active') then raise exception 'ALREADY_WAITING'; end if;
  if private.accepted_count(p_game_id) >= v_game.additional_players_required then raise exception 'GAME_FULL'; end if;

  if p_requested_position_id is not null and not exists(
    select 1 from public.positions p
    where p.id=p_requested_position_id and p.activity_id=v_game.activity_id and p.active
  ) then raise exception 'POSITION_NOT_VALID_FOR_ACTIVITY'; end if;

  select status into v_status from public.game_applications where game_id=p_game_id and user_id=v_user;
  if v_status='pending' then raise exception 'APPLICATION_ALREADY_PENDING'; end if;
  if v_status='declined' then raise exception 'APPLICATION_PREVIOUSLY_DECLINED'; end if;

  insert into public.game_applications(game_id,user_id,requested_position_id,status)
  values(p_game_id,v_user,p_requested_position_id,'pending')
  on conflict(game_id,user_id) do update set requested_position_id=excluded.requested_position_id,status='pending',updated_at=now()
  returning id into v_id;

  insert into public.notifications(user_id,game_id,type,payload)
  values(v_game.creator_id,p_game_id,'application_received',jsonb_build_object('application_id',v_id));
  return v_id;
end;
$$;

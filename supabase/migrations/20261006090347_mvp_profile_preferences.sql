
create table public.user_activities (
  user_id uuid not null references public.profiles(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  skill_level public.skill_level,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(user_id,activity_id)
);

create table public.user_preferred_positions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  position_id uuid not null references public.positions(id) on delete cascade,
  priority integer not null default 1 check (priority between 1 and 10),
  created_at timestamptz not null default now(),
  primary key(user_id,position_id)
);

create index idx_user_activities_activity on public.user_activities(activity_id,user_id);
create index idx_user_preferred_positions_position on public.user_preferred_positions(position_id,user_id);

alter table public.user_activities enable row level security;
alter table public.user_preferred_positions enable row level security;

create policy user_activities_authenticated_read on public.user_activities
for select to authenticated using (true);
create policy user_activities_anon_public_read on public.user_activities
for select to anon using (
  exists(select 1 from public.profiles p where p.id=user_id and p.visibility='public')
);

create policy preferred_positions_authenticated_read on public.user_preferred_positions
for select to authenticated using (true);
create policy preferred_positions_anon_public_read on public.user_preferred_positions
for select to anon using (
  exists(select 1 from public.profiles p where p.id=user_id and p.visibility='public')
);

grant select on public.user_activities,public.user_preferred_positions to anon,authenticated;

create or replace function private.set_user_activity_impl(
  p_activity_id uuid,
  p_enabled boolean,
  p_skill_level public.skill_level default null
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_activity public.activities%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_activity from public.activities where id=p_activity_id and active;
  if not found then raise exception 'ACTIVITY_NOT_FOUND'; end if;

  if coalesce(p_enabled,false)=false then
    delete from public.user_preferred_positions upp
    using public.positions pos
    where upp.user_id=v_user and upp.position_id=pos.id and pos.activity_id=p_activity_id;
    delete from public.user_activities where user_id=v_user and activity_id=p_activity_id;
    return;
  end if;

  if v_activity.supports_skill_levels=false then p_skill_level:=null; end if;

  insert into public.user_activities(user_id,activity_id,skill_level,updated_at)
  values(v_user,p_activity_id,p_skill_level,now())
  on conflict(user_id,activity_id) do update
    set skill_level=excluded.skill_level,updated_at=now();
end;
$$;

create or replace function private.set_preferred_position_impl(
  p_position_id uuid,
  p_enabled boolean,
  p_priority integer default 1
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_position public.positions%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_position from public.positions where id=p_position_id and active;
  if not found then raise exception 'POSITION_NOT_FOUND'; end if;

  if not exists(
    select 1 from public.user_activities
    where user_id=v_user and activity_id=v_position.activity_id
  ) then raise exception 'ACTIVITY_NOT_SELECTED'; end if;

  if coalesce(p_enabled,false)=false then
    delete from public.user_preferred_positions where user_id=v_user and position_id=p_position_id;
    return;
  end if;

  insert into public.user_preferred_positions(user_id,position_id,priority)
  values(v_user,p_position_id,greatest(1,least(coalesce(p_priority,1),10)))
  on conflict(user_id,position_id) do update set priority=excluded.priority;
end;
$$;

revoke all on function private.set_user_activity_impl(uuid,boolean,public.skill_level) from public,anon;
revoke all on function private.set_preferred_position_impl(uuid,boolean,integer) from public,anon;
grant execute on function private.set_user_activity_impl(uuid,boolean,public.skill_level) to authenticated;
grant execute on function private.set_preferred_position_impl(uuid,boolean,integer) to authenticated;

create or replace function public.set_user_activity(
  p_activity_id uuid,
  p_enabled boolean,
  p_skill_level public.skill_level default null
)
returns void language sql security invoker set search_path=''
as $$ select private.set_user_activity_impl($1,$2,$3); $$;

create or replace function public.set_preferred_position(
  p_position_id uuid,
  p_enabled boolean,
  p_priority integer default 1
)
returns void language sql security invoker set search_path=''
as $$ select private.set_preferred_position_impl($1,$2,$3); $$;

revoke all on function public.set_user_activity(uuid,boolean,public.skill_level) from public,anon;
revoke all on function public.set_preferred_position(uuid,boolean,integer) from public,anon;
grant execute on function public.set_user_activity(uuid,boolean,public.skill_level) to authenticated;
grant execute on function public.set_preferred_position(uuid,boolean,integer) to authenticated;

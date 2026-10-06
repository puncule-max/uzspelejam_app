
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid references public.profiles(id) on delete set null,
  game_id uuid references public.games(id) on delete set null,
  reason text not null check (reason in ('spam','harassment','unsafe','inappropriate','fraud','other')),
  comment text check (comment is null or char_length(comment) <= 2000),
  status text not null default 'open' check (status in ('open','reviewed','resolved','dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index idx_reports_reporter on public.reports(reporter_user_id,created_at desc);
create index idx_reports_status on public.reports(status,created_at);
create index idx_reports_game on public.reports(game_id);
create index idx_reports_reported_user on public.reports(reported_user_id);

alter table public.reports enable row level security;

create policy reports_own_read on public.reports
for select to authenticated
using (reporter_user_id=(select auth.uid()));

grant select on public.reports to authenticated;

create or replace function private.report_game_impl(p_game_id uuid,p_reason text,p_comment text default null)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_game public.games%rowtype; v_id uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_reason not in ('spam','harassment','unsafe','inappropriate','fraud','other') then raise exception 'INVALID_REASON'; end if;

  select * into v_game from public.games where id=p_game_id;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;

  if v_game.visibility='private' and not private.can_view_game(p_game_id,v_user) then
    raise exception 'GAME_NOT_ACCESSIBLE';
  end if;

  insert into public.reports(reporter_user_id,reported_user_id,game_id,reason,comment)
  values(v_user,v_game.creator_id,p_game_id,p_reason,nullif(trim(p_comment),''))
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function private.block_user_impl(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_user_id is null or p_user_id=v_user then raise exception 'INVALID_BLOCK_TARGET'; end if;
  if not exists(select 1 from public.profiles where id=p_user_id) then raise exception 'USER_NOT_FOUND'; end if;

  insert into public.blocks(blocker_user_id,blocked_user_id)
  values(v_user,p_user_id)
  on conflict(blocker_user_id,blocked_user_id) do nothing;
end;
$$;

create or replace function private.unblock_user_impl(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  delete from public.blocks where blocker_user_id=v_user and blocked_user_id=p_user_id;
end;
$$;

revoke all on function private.report_game_impl(uuid,text,text) from public,anon;
revoke all on function private.block_user_impl(uuid) from public,anon;
revoke all on function private.unblock_user_impl(uuid) from public,anon;
grant execute on function private.report_game_impl(uuid,text,text) to authenticated;
grant execute on function private.block_user_impl(uuid) to authenticated;
grant execute on function private.unblock_user_impl(uuid) to authenticated;

create or replace function public.report_game(p_game_id uuid,p_reason text,p_comment text default null)
returns uuid language sql security invoker set search_path=''
as $$ select private.report_game_impl($1,$2,$3); $$;

create or replace function public.block_user(p_user_id uuid)
returns void language sql security invoker set search_path=''
as $$ select private.block_user_impl($1); $$;

create or replace function public.unblock_user(p_user_id uuid)
returns void language sql security invoker set search_path=''
as $$ select private.unblock_user_impl($1); $$;

revoke all on function public.report_game(uuid,text,text) from public,anon;
revoke all on function public.block_user(uuid) from public,anon;
revoke all on function public.unblock_user(uuid) from public,anon;
grant execute on function public.report_game(uuid,text,text) to authenticated;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;

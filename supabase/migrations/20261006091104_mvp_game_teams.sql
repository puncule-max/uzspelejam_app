
create table public.game_teams (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  sort_order integer not null default 0,
  max_players integer check (max_players is null or max_players >= 1),
  created_at timestamptz not null default now(),
  unique(game_id,name)
);

alter table public.game_participants
  add column if not exists team_id uuid references public.game_teams(id) on delete set null;

create index idx_game_teams_game on public.game_teams(game_id,sort_order);
create index if not exists idx_participants_team on public.game_participants(team_id);

alter table public.game_teams enable row level security;

create policy game_teams_anon_public_read on public.game_teams
for select to anon
using (exists(select 1 from public.games g where g.id=game_id and g.visibility='public'));

create policy game_teams_authenticated_read on public.game_teams
for select to authenticated
using (private.can_view_game(game_id,(select auth.uid())));

grant select on public.game_teams to anon,authenticated;

create or replace function private.ensure_default_game_teams()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare v_supports boolean;
begin
  select a.supports_teams into v_supports
  from public.activities a
  where a.id=new.activity_id;

  if coalesce(v_supports,false) then
    insert into public.game_teams(game_id,name,sort_order)
    values(new.id,'Team A',10),(new.id,'Team B',20)
    on conflict(game_id,name) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.ensure_default_game_teams() from public,anon,authenticated;

create trigger games_create_default_teams
after insert on public.games
for each row execute procedure private.ensure_default_game_teams();

insert into public.game_teams(game_id,name,sort_order)
select g.id,'Team A',10
from public.games g
join public.activities a on a.id=g.activity_id
where a.supports_teams
on conflict(game_id,name) do nothing;

insert into public.game_teams(game_id,name,sort_order)
select g.id,'Team B',20
from public.games g
join public.activities a on a.id=g.activity_id
where a.supports_teams
on conflict(game_id,name) do nothing;

create or replace function private.assign_participant_team_impl(
  p_game_id uuid,
  p_user_id uuid,
  p_team_id uuid
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
    select 1 from public.game_teams
    where id=p_team_id and game_id=p_game_id
  ) then raise exception 'TEAM_NOT_VALID_FOR_GAME'; end if;

  update public.game_participants
  set team_id=p_team_id
  where game_id=p_game_id and user_id=p_user_id and status='accepted';

  if not found then raise exception 'ACCEPTED_PARTICIPANT_NOT_FOUND'; end if;
end;
$$;

revoke all on function private.assign_participant_team_impl(uuid,uuid,uuid) from public,anon;
grant execute on function private.assign_participant_team_impl(uuid,uuid,uuid) to authenticated;

create or replace function public.assign_participant_team(
  p_game_id uuid,
  p_user_id uuid,
  p_team_id uuid
)
returns void
language sql
security invoker
set search_path=''
as $$ select private.assign_participant_team_impl($1,$2,$3); $$;

revoke all on function public.assign_participant_team(uuid,uuid,uuid) from public,anon;
grant execute on function public.assign_participant_team(uuid,uuid,uuid) to authenticated;

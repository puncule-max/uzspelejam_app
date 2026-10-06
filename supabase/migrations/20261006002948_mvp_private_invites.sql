
create table public.game_access_grants (
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  source text not null default 'invite' check (source in ('invite','organizer')),
  created_at timestamptz not null default now(),
  primary key(game_id,user_id)
);

create table private.game_invites (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
revoke all on private.game_invites from public,anon,authenticated;

create index idx_access_grants_user on public.game_access_grants(user_id,created_at desc);
create index idx_private_invites_game on private.game_invites(game_id,created_at desc);

create or replace function private.can_view_game(p_game_id uuid,p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1 from public.games g
    where g.id=p_game_id and (
      g.visibility='public'
      or g.creator_id=p_user_id
      or exists(select 1 from public.game_access_grants gag where gag.game_id=g.id and gag.user_id=p_user_id)
      or exists(select 1 from public.game_participants gp where gp.game_id=g.id and gp.user_id=p_user_id and gp.status='accepted')
      or exists(select 1 from public.game_applications ga where ga.game_id=g.id and ga.user_id=p_user_id and ga.status='pending')
      or exists(select 1 from public.game_waiting_list gw where gw.game_id=g.id and gw.user_id=p_user_id and gw.status='active')
      or exists(select 1 from public.game_followers gf where gf.game_id=g.id and gf.user_id=p_user_id)
    )
  );
$$;
revoke all on function private.can_view_game(uuid,uuid) from public,anon;
grant execute on function private.can_view_game(uuid,uuid) to authenticated;

create or replace function private.create_private_invite_impl(p_game_id uuid,p_valid_hours integer default 168)
returns text
language plpgsql
security definer
set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_game public.games%rowtype; v_token text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_game from public.games where id=p_game_id;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  if v_game.creator_id<>v_user then raise exception 'ORGANIZER_REQUIRED'; end if;
  if v_game.visibility<>'private' then raise exception 'PRIVATE_GAME_REQUIRED'; end if;
  if p_valid_hours < 1 or p_valid_hours > 2160 then raise exception 'INVALID_EXPIRY'; end if;

  v_token := encode(extensions.gen_random_bytes(24),'hex');
  insert into private.game_invites(game_id,token_hash,created_by,expires_at)
  values(p_game_id,encode(extensions.digest(v_token,'sha256'),'hex'),v_user,now()+make_interval(hours=>p_valid_hours));
  return v_token;
end;
$$;

create or replace function private.claim_private_invite_impl(p_token text)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_invite private.game_invites%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_invite
  from private.game_invites
  where token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
    and revoked_at is null
    and (expires_at is null or expires_at>now())
  order by created_at desc
  limit 1;

  if not found then raise exception 'INVITE_INVALID_OR_EXPIRED'; end if;

  insert into public.game_access_grants(game_id,user_id,source)
  values(v_invite.game_id,v_user,'invite')
  on conflict(game_id,user_id) do nothing;

  return v_invite.game_id;
end;
$$;

create or replace function private.preview_private_game_impl(p_token text)
returns table(
  game_id uuid,
  activity_name_lv text,
  activity_name_en text,
  starts_at timestamptz,
  ends_at timestamptz,
  mode public.play_mode,
  custom_location text,
  city text,
  online_platform text,
  additional_players_required integer,
  required_skill_levels public.skill_level[],
  total_cost numeric,
  payment_method public.payment_method,
  venue_booked boolean,
  description text,
  organizer_name text
)
language sql
stable
security definer
set search_path=''
as $$
  select
    g.id,a.name_lv,a.name_en,g.starts_at,g.ends_at,g.mode,g.custom_location,g.city,g.online_platform,
    g.additional_players_required,g.required_skill_levels,g.total_cost,g.payment_method,g.venue_booked,
    g.description,p.display_name
  from private.game_invites i
  join public.games g on g.id=i.game_id
  join public.activities a on a.id=g.activity_id
  join public.profiles p on p.id=g.creator_id
  where i.token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
    and i.revoked_at is null
    and (i.expires_at is null or i.expires_at>now())
    and g.visibility='private'
    and g.cancelled_at is null
    and g.ends_at>now()
  order by i.created_at desc
  limit 1;
$$;

revoke all on function private.create_private_invite_impl(uuid,integer) from public,anon;
revoke all on function private.claim_private_invite_impl(text) from public,anon;
revoke all on function private.preview_private_game_impl(text) from public,anon,authenticated;
grant execute on function private.create_private_invite_impl(uuid,integer) to authenticated;
grant execute on function private.claim_private_invite_impl(text) to authenticated;
grant usage on schema private to anon;
grant execute on function private.preview_private_game_impl(text) to anon,authenticated;

create or replace function public.create_private_invite(p_game_id uuid,p_valid_hours integer default 168)
returns text language sql security invoker set search_path=''
as $$ select private.create_private_invite_impl($1,$2); $$;

create or replace function public.claim_private_invite(p_token text)
returns uuid language sql security invoker set search_path=''
as $$ select private.claim_private_invite_impl($1); $$;

create or replace function public.preview_private_game(p_token text)
returns table(
  game_id uuid,
  activity_name_lv text,
  activity_name_en text,
  starts_at timestamptz,
  ends_at timestamptz,
  mode public.play_mode,
  custom_location text,
  city text,
  online_platform text,
  additional_players_required integer,
  required_skill_levels public.skill_level[],
  total_cost numeric,
  payment_method public.payment_method,
  venue_booked boolean,
  description text,
  organizer_name text
)
language sql security invoker set search_path=''
as $$ select * from private.preview_private_game_impl($1); $$;

revoke all on function public.create_private_invite(uuid,integer) from public,anon;
revoke all on function public.claim_private_invite(text) from public,anon;
revoke all on function public.preview_private_game(text) from public;
grant execute on function public.create_private_invite(uuid,integer) to authenticated;
grant execute on function public.claim_private_invite(text) to authenticated;
grant execute on function public.preview_private_game(text) to anon,authenticated;

alter table public.game_access_grants enable row level security;
create policy access_grants_related_read on public.game_access_grants
for select to authenticated
using (
  user_id=(select auth.uid())
  or exists(select 1 from public.games g where g.id=game_id and g.creator_id=(select auth.uid()))
);
grant select on public.game_access_grants to authenticated;


create extension if not exists pgcrypto;
create schema if not exists private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

do $$ begin create type public.profile_visibility as enum ('public','private'); exception when duplicate_object then null; end $$;
do $$ begin create type public.play_mode as enum ('physical','online','both'); exception when duplicate_object then null; end $$;
do $$ begin create type public.participation_type as enum ('opponent','partner','team','multiplayer','flexible'); exception when duplicate_object then null; end $$;
do $$ begin create type public.skill_level as enum ('beginner','intermediate','advanced'); exception when duplicate_object then null; end $$;
do $$ begin create type public.game_visibility as enum ('public','private'); exception when duplicate_object then null; end $$;
do $$ begin create type public.gender_preference as enum ('anyone','men','women','mixed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.payment_method as enum ('free','pay_in_advance','pay_at_venue'); exception when duplicate_object then null; end $$;
do $$ begin create type public.application_status as enum ('pending','accepted','declined','withdrawn'); exception when duplicate_object then null; end $$;
do $$ begin create type public.participant_status as enum ('accepted','left','removed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.waiting_status as enum ('active','promoted','left'); exception when duplicate_object then null; end $$;
do $$ begin create type public.notification_type as enum ('application_received','application_accepted','application_declined','spot_available','fully_booked','waiting_list_promoted','game_cancelled'); exception when duplicate_object then null; end $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  avatar_url text,
  city text,
  visibility public.profile_visibility not null default 'private',
  language text not null default 'lv' check (language in ('lv','en')),
  about text check (about is null or char_length(about) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.account_private (
  user_id uuid primary key references auth.users(id) on delete cascade,
  birth_date date not null,
  is_minor boolean not null,
  created_at timestamptz not null default now()
);
revoke all on private.account_private from public, anon, authenticated;

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_lv text not null,
  name_en text not null,
  category text not null,
  participation_type public.participation_type not null,
  play_mode public.play_mode not null,
  supports_teams boolean not null default false,
  supports_positions boolean not null default false,
  supports_skill_levels boolean not null default true,
  min_players integer not null check (min_players >= 2),
  max_players integer check (max_players is null or max_players >= min_players),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.positions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  code text not null,
  name_lv text not null,
  name_en text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  unique(activity_id, code)
);

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete restrict,
  activity_id uuid not null references public.activities(id) on delete restrict,
  venue_id uuid references public.venues(id) on delete set null,
  mode public.play_mode not null,
  custom_location text,
  city text,
  online_platform text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  additional_players_required integer not null check (additional_players_required >= 1),
  required_skill_levels public.skill_level[] not null default '{}',
  gender_preference public.gender_preference not null default 'anyone',
  total_cost numeric(10,2) not null default 0 check (total_cost >= 0),
  payment_method public.payment_method not null default 'free',
  venue_booked boolean,
  cancellation_policy_minutes integer check (cancellation_policy_minutes is null or cancellation_policy_minutes >= 0),
  visibility public.game_visibility not null default 'public',
  description text check (description is null or char_length(description) <= 4000),
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (
    (mode = 'physical' and (venue_id is not null or nullif(trim(custom_location),'') is not null))
    or (mode = 'online' and nullif(trim(online_platform),'') is not null)
    or mode = 'both'
  ),
  check (
    (payment_method = 'free' and total_cost = 0)
    or (payment_method <> 'free' and total_cost >= 0)
  )
);

create table public.game_applications (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  requested_position_id uuid references public.positions(id) on delete set null,
  status public.application_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(game_id,user_id)
);

create table public.game_participants (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  position_id uuid references public.positions(id) on delete set null,
  status public.participant_status not null default 'accepted',
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  unique(game_id,user_id)
);

create table public.game_waiting_list (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.waiting_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(game_id,user_id)
);

create table public.game_followers (
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  notify_spot_available boolean not null default true,
  notify_fully_booked boolean not null default false,
  notify_date_change boolean not null default true,
  notify_time_change boolean not null default true,
  notify_venue_change boolean not null default true,
  notify_price_change boolean not null default false,
  notify_new_players boolean not null default false,
  notify_booking_status boolean not null default false,
  notify_cancelled boolean not null default true,
  push_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(game_id,user_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_id uuid references public.games(id) on delete cascade,
  type public.notification_type not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.blocks (
  blocker_user_id uuid not null references public.profiles(id) on delete cascade,
  blocked_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(blocker_user_id,blocked_user_id),
  check(blocker_user_id <> blocked_user_id)
);

create index idx_games_explore on public.games(starts_at,visibility,cancelled_at);
create index idx_games_creator on public.games(creator_id,starts_at desc);
create index idx_applications_game_status on public.game_applications(game_id,status);
create index idx_applications_user_status on public.game_applications(user_id,status);
create index idx_participants_game_status on public.game_participants(game_id,status);
create index idx_participants_user_status on public.game_participants(user_id,status);
create index idx_waiting_game_status on public.game_waiting_list(game_id,status,created_at);
create index idx_followers_user on public.game_followers(user_id,created_at desc);
create index idx_notifications_user on public.notifications(user_id,read_at,created_at desc);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_birth date;
  v_age integer;
  v_language text;
begin
  if (new.raw_user_meta_data ->> 'birth_date') !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'BIRTH_DATE_REQUIRED';
  end if;
  v_birth := (new.raw_user_meta_data ->> 'birth_date')::date;
  v_age := extract(year from age(current_date, v_birth));
  if v_age < 16 then raise exception 'MINIMUM_AGE_16'; end if;
  v_language := case when new.raw_user_meta_data ->> 'language' in ('lv','en') then new.raw_user_meta_data ->> 'language' else 'lv' end;

  insert into public.profiles(id,display_name,city,visibility,language)
  values(
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name',''), split_part(coalesce(new.email,'player'),'@',1)),
    nullif(new.raw_user_meta_data ->> 'city',''),
    'private',
    v_language
  );

  insert into private.account_private(user_id,birth_date,is_minor)
  values(new.id,v_birth,v_age < 18);
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure private.handle_new_user();

create or replace function private.accepted_count(p_game_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$ select count(*)::integer from public.game_participants where game_id=p_game_id and status='accepted'; $$;
revoke all on function private.accepted_count(uuid) from public,anon,authenticated;

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
      or exists(select 1 from public.game_participants gp where gp.game_id=g.id and gp.user_id=p_user_id and gp.status='accepted')
      or exists(select 1 from public.game_applications ga where ga.game_id=g.id and ga.user_id=p_user_id and ga.status='pending')
      or exists(select 1 from public.game_waiting_list gw where gw.game_id=g.id and gw.user_id=p_user_id and gw.status='active')
      or exists(select 1 from public.game_followers gf where gf.game_id=g.id and gf.user_id=p_user_id)
    )
  );
$$;
revoke all on function private.can_view_game(uuid,uuid) from public,anon;
grant execute on function private.can_view_game(uuid,uuid) to authenticated;

create or replace function private.create_game_impl(
  p_activity_id uuid,p_mode public.play_mode,p_starts_at timestamptz,p_ends_at timestamptz,
  p_additional_players_required integer,p_visibility public.game_visibility default 'public',
  p_required_skill_levels public.skill_level[] default '{}',p_gender_preference public.gender_preference default 'anyone',
  p_custom_location text default null,p_city text default null,p_online_platform text default null,
  p_total_cost numeric default 0,p_payment_method public.payment_method default 'free',
  p_venue_booked boolean default null,p_cancellation_policy_minutes integer default null,p_description text default null
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_activity public.activities%rowtype; v_id uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_starts_at <= now() then raise exception 'GAME_MUST_BE_FUTURE'; end if;
  if p_ends_at <= p_starts_at then raise exception 'INVALID_TIME_RANGE'; end if;
  if p_additional_players_required < 1 then raise exception 'INVALID_CAPACITY'; end if;
  select * into v_activity from public.activities where id=p_activity_id and active;
  if not found then raise exception 'ACTIVITY_NOT_FOUND'; end if;
  if p_mode='online' and v_activity.play_mode='physical' then raise exception 'ONLINE_NOT_SUPPORTED'; end if;
  if p_mode='physical' and v_activity.play_mode='online' then raise exception 'PHYSICAL_NOT_SUPPORTED'; end if;

  insert into public.games(
    creator_id,activity_id,mode,custom_location,city,online_platform,starts_at,ends_at,
    additional_players_required,required_skill_levels,gender_preference,total_cost,payment_method,
    venue_booked,cancellation_policy_minutes,visibility,description
  ) values(
    v_user,p_activity_id,p_mode,nullif(trim(p_custom_location),''),nullif(trim(p_city),''),nullif(trim(p_online_platform),''),
    p_starts_at,p_ends_at,p_additional_players_required,coalesce(p_required_skill_levels,'{}'),p_gender_preference,
    coalesce(p_total_cost,0),p_payment_method,p_venue_booked,p_cancellation_policy_minutes,p_visibility,nullif(trim(p_description),'')
  ) returning id into v_id;
  return v_id;
end;
$$;

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
  if private.accepted_count(p_game_id) < v_game.additional_players_required then raise exception 'GAME_HAS_OPEN_SPOTS'; end if;
  if exists(select 1 from public.game_participants where game_id=p_game_id and user_id=v_user and status='accepted') then raise exception 'ALREADY_ACCEPTED'; end if;
  if exists(select 1 from public.game_applications where game_id=p_game_id and user_id=v_user and status='pending') then raise exception 'APPLICATION_PENDING'; end if;
  insert into public.game_waiting_list(game_id,user_id,status)
  values(p_game_id,v_user,'active')
  on conflict(game_id,user_id) do update set status='active',updated_at=now()
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function private.withdraw_application_impl(p_game_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.game_applications
  set status='withdrawn',updated_at=now()
  where game_id=p_game_id and user_id=v_user and status='pending';
  if not found then raise exception 'PENDING_APPLICATION_NOT_FOUND'; end if;
end;
$$;

create or replace function private.leave_waiting_list_impl(p_game_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.game_waiting_list set status='left',updated_at=now()
  where game_id=p_game_id and user_id=v_user and status='active';
  if not found then raise exception 'WAITING_ENTRY_NOT_FOUND'; end if;
end;
$$;

create or replace function private.leave_game_impl(p_game_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_game public.games%rowtype; v_was_full boolean;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_game from public.games where id=p_game_id for update;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  v_was_full := private.accepted_count(p_game_id) >= v_game.additional_players_required;

  update public.game_participants set status='left',left_at=now()
  where game_id=p_game_id and user_id=v_user and status='accepted';
  if not found then raise exception 'ACCEPTED_PARTICIPANT_NOT_FOUND'; end if;

  if v_was_full then
    insert into public.notifications(user_id,game_id,type,payload)
    select gf.user_id,p_game_id,'spot_available','{}'::jsonb
    from public.game_followers gf
    where gf.game_id=p_game_id and gf.notify_spot_available and gf.user_id<>v_user;
  end if;
end;
$$;

create or replace function private.follow_game_impl(p_game_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if not private.can_view_game(p_game_id,v_user) then raise exception 'GAME_NOT_ACCESSIBLE'; end if;
  insert into public.game_followers(game_id,user_id)
  values(p_game_id,v_user)
  on conflict(game_id,user_id) do nothing;
end;
$$;

create or replace function private.unfollow_game_impl(p_game_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  delete from public.game_followers where game_id=p_game_id and user_id=v_user;
end;
$$;

create or replace function private.accept_application_impl(p_application_id uuid,p_team_id uuid default null,p_position_id uuid default null)
returns void language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_app public.game_applications%rowtype; v_game public.games%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_app from public.game_applications where id=p_application_id for update;
  if not found or v_app.status<>'pending' then raise exception 'PENDING_APPLICATION_NOT_FOUND'; end if;
  select * into v_game from public.games where id=v_app.game_id for update;
  if v_game.creator_id<>v_user then raise exception 'ORGANIZER_REQUIRED'; end if;
  if v_game.cancelled_at is not null or v_game.ends_at<=now() then raise exception 'GAME_NOT_ACTIVE'; end if;
  if private.accepted_count(v_game.id) >= v_game.additional_players_required then raise exception 'GAME_FULL'; end if;

  insert into public.game_participants(game_id,user_id,position_id,status,joined_at,left_at)
  values(v_game.id,v_app.user_id,coalesce(p_position_id,v_app.requested_position_id),'accepted',now(),null)
  on conflict(game_id,user_id) do update set status='accepted',position_id=excluded.position_id,joined_at=now(),left_at=null;

  update public.game_applications set status='accepted',updated_at=now() where id=v_app.id;
  update public.game_waiting_list set status='promoted',updated_at=now() where game_id=v_game.id and user_id=v_app.user_id and status='active';
  insert into public.notifications(user_id,game_id,type,payload) values(v_app.user_id,v_game.id,'application_accepted','{}'::jsonb);
end;
$$;

create or replace function private.decline_application_impl(p_application_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_app public.game_applications%rowtype; v_game public.games%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_app from public.game_applications where id=p_application_id for update;
  if not found or v_app.status<>'pending' then raise exception 'PENDING_APPLICATION_NOT_FOUND'; end if;
  select * into v_game from public.games where id=v_app.game_id;
  if v_game.creator_id<>v_user then raise exception 'ORGANIZER_REQUIRED'; end if;
  update public.game_applications set status='declined',updated_at=now() where id=v_app.id;
  insert into public.notifications(user_id,game_id,type,payload) values(v_app.user_id,v_game.id,'application_declined','{}'::jsonb);
end;
$$;

create or replace function private.promote_waiting_user_impl(p_waiting_id uuid,p_team_id uuid default null,p_position_id uuid default null)
returns void language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_wait public.game_waiting_list%rowtype; v_game public.games%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_wait from public.game_waiting_list where id=p_waiting_id for update;
  if not found or v_wait.status<>'active' then raise exception 'ACTIVE_WAITING_ENTRY_NOT_FOUND'; end if;
  select * into v_game from public.games where id=v_wait.game_id for update;
  if v_game.creator_id<>v_user then raise exception 'ORGANIZER_REQUIRED'; end if;
  if v_game.cancelled_at is not null or v_game.ends_at<=now() then raise exception 'GAME_NOT_ACTIVE'; end if;
  if private.accepted_count(v_game.id) >= v_game.additional_players_required then raise exception 'GAME_FULL'; end if;

  insert into public.game_participants(game_id,user_id,position_id,status,joined_at,left_at)
  values(v_game.id,v_wait.user_id,p_position_id,'accepted',now(),null)
  on conflict(game_id,user_id) do update set status='accepted',position_id=excluded.position_id,joined_at=now(),left_at=null;

  update public.game_waiting_list set status='promoted',updated_at=now() where id=v_wait.id;
  update public.game_applications set status='accepted',updated_at=now() where game_id=v_game.id and user_id=v_wait.user_id and status='pending';
  insert into public.notifications(user_id,game_id,type,payload) values(v_wait.user_id,v_game.id,'waiting_list_promoted','{}'::jsonb);
end;
$$;

revoke all on function private.create_game_impl(uuid,public.play_mode,timestamptz,timestamptz,integer,public.game_visibility,public.skill_level[],public.gender_preference,text,text,text,numeric,public.payment_method,boolean,integer,text) from public,anon;
revoke all on function private.join_game_impl(uuid,uuid) from public,anon;
revoke all on function private.join_waiting_list_impl(uuid) from public,anon;
revoke all on function private.withdraw_application_impl(uuid) from public,anon;
revoke all on function private.leave_waiting_list_impl(uuid) from public,anon;
revoke all on function private.leave_game_impl(uuid) from public,anon;
revoke all on function private.follow_game_impl(uuid) from public,anon;
revoke all on function private.unfollow_game_impl(uuid) from public,anon;
revoke all on function private.accept_application_impl(uuid,uuid,uuid) from public,anon;
revoke all on function private.decline_application_impl(uuid) from public,anon;
revoke all on function private.promote_waiting_user_impl(uuid,uuid,uuid) from public,anon;

grant execute on function private.create_game_impl(uuid,public.play_mode,timestamptz,timestamptz,integer,public.game_visibility,public.skill_level[],public.gender_preference,text,text,text,numeric,public.payment_method,boolean,integer,text) to authenticated;
grant execute on function private.join_game_impl(uuid,uuid) to authenticated;
grant execute on function private.join_waiting_list_impl(uuid) to authenticated;
grant execute on function private.withdraw_application_impl(uuid) to authenticated;
grant execute on function private.leave_waiting_list_impl(uuid) to authenticated;
grant execute on function private.leave_game_impl(uuid) to authenticated;
grant execute on function private.follow_game_impl(uuid) to authenticated;
grant execute on function private.unfollow_game_impl(uuid) to authenticated;
grant execute on function private.accept_application_impl(uuid,uuid,uuid) to authenticated;
grant execute on function private.decline_application_impl(uuid) to authenticated;
grant execute on function private.promote_waiting_user_impl(uuid,uuid,uuid) to authenticated;

create or replace function public.create_game(
  p_activity_id uuid,p_mode public.play_mode,p_starts_at timestamptz,p_ends_at timestamptz,
  p_additional_players_required integer,p_visibility public.game_visibility default 'public',
  p_required_skill_levels public.skill_level[] default '{}',p_gender_preference public.gender_preference default 'anyone',
  p_custom_location text default null,p_city text default null,p_online_platform text default null,
  p_total_cost numeric default 0,p_payment_method public.payment_method default 'free',
  p_venue_booked boolean default null,p_cancellation_policy_minutes integer default null,p_description text default null
) returns uuid language sql security invoker set search_path=''
as $$ select private.create_game_impl($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16); $$;

create or replace function public.join_game(p_game_id uuid,p_requested_position_id uuid default null)
returns uuid language sql security invoker set search_path=''
as $$ select private.join_game_impl($1,$2); $$;

create or replace function public.join_waiting_list(p_game_id uuid)
returns uuid language sql security invoker set search_path=''
as $$ select private.join_waiting_list_impl($1); $$;

create or replace function public.withdraw_application(p_game_id uuid)
returns void language sql security invoker set search_path=''
as $$ select private.withdraw_application_impl($1); $$;

create or replace function public.leave_waiting_list(p_game_id uuid)
returns void language sql security invoker set search_path=''
as $$ select private.leave_waiting_list_impl($1); $$;

create or replace function public.leave_game(p_game_id uuid)
returns void language sql security invoker set search_path=''
as $$ select private.leave_game_impl($1); $$;

create or replace function public.follow_game(p_game_id uuid)
returns void language sql security invoker set search_path=''
as $$ select private.follow_game_impl($1); $$;

create or replace function public.unfollow_game(p_game_id uuid)
returns void language sql security invoker set search_path=''
as $$ select private.unfollow_game_impl($1); $$;

create or replace function public.accept_application(p_application_id uuid,p_team_id uuid default null,p_position_id uuid default null)
returns void language sql security invoker set search_path=''
as $$ select private.accept_application_impl($1,$2,$3); $$;

create or replace function public.decline_application(p_application_id uuid)
returns void language sql security invoker set search_path=''
as $$ select private.decline_application_impl($1); $$;

create or replace function public.promote_waiting_user(p_waiting_id uuid,p_team_id uuid default null,p_position_id uuid default null)
returns void language sql security invoker set search_path=''
as $$ select private.promote_waiting_user_impl($1,$2,$3); $$;

revoke all on function public.create_game(uuid,public.play_mode,timestamptz,timestamptz,integer,public.game_visibility,public.skill_level[],public.gender_preference,text,text,text,numeric,public.payment_method,boolean,integer,text) from public,anon;
revoke all on function public.join_game(uuid,uuid) from public,anon;
revoke all on function public.join_waiting_list(uuid) from public,anon;
revoke all on function public.withdraw_application(uuid) from public,anon;
revoke all on function public.leave_waiting_list(uuid) from public,anon;
revoke all on function public.leave_game(uuid) from public,anon;
revoke all on function public.follow_game(uuid) from public,anon;
revoke all on function public.unfollow_game(uuid) from public,anon;
revoke all on function public.accept_application(uuid,uuid,uuid) from public,anon;
revoke all on function public.decline_application(uuid) from public,anon;
revoke all on function public.promote_waiting_user(uuid,uuid,uuid) from public,anon;

grant execute on function public.create_game(uuid,public.play_mode,timestamptz,timestamptz,integer,public.game_visibility,public.skill_level[],public.gender_preference,text,text,text,numeric,public.payment_method,boolean,integer,text) to authenticated;
grant execute on function public.join_game(uuid,uuid) to authenticated;
grant execute on function public.join_waiting_list(uuid) to authenticated;
grant execute on function public.withdraw_application(uuid) to authenticated;
grant execute on function public.leave_waiting_list(uuid) to authenticated;
grant execute on function public.leave_game(uuid) to authenticated;
grant execute on function public.follow_game(uuid) to authenticated;
grant execute on function public.unfollow_game(uuid) to authenticated;
grant execute on function public.accept_application(uuid,uuid,uuid) to authenticated;
grant execute on function public.decline_application(uuid) to authenticated;
grant execute on function public.promote_waiting_user(uuid,uuid,uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.activities enable row level security;
alter table public.positions enable row level security;
alter table public.venues enable row level security;
alter table public.games enable row level security;
alter table public.game_applications enable row level security;
alter table public.game_participants enable row level security;
alter table public.game_waiting_list enable row level security;
alter table public.game_followers enable row level security;
alter table public.notifications enable row level security;
alter table public.blocks enable row level security;

create policy profiles_anon_public on public.profiles for select to anon using (visibility='public');
create policy profiles_authenticated_read on public.profiles for select to authenticated using (true);
create policy profiles_self_update on public.profiles for update to authenticated
using ((select auth.uid())=id) with check ((select auth.uid())=id);

create policy activities_public_read on public.activities for select to anon,authenticated using (active=true);
create policy positions_public_read on public.positions for select to anon,authenticated using (active=true);
create policy venues_public_read on public.venues for select to anon,authenticated using (active=true);

create policy games_anon_public_read on public.games for select to anon
using (visibility='public');
create policy games_authenticated_read on public.games for select to authenticated
using (private.can_view_game(id,(select auth.uid())));

create policy applications_related_read on public.game_applications for select to authenticated
using (
  user_id=(select auth.uid())
  or exists(select 1 from public.games g where g.id=game_id and g.creator_id=(select auth.uid()))
);

create policy participants_visible_read on public.game_participants for select to authenticated
using (private.can_view_game(game_id,(select auth.uid())));

create policy waiting_related_read on public.game_waiting_list for select to authenticated
using (
  user_id=(select auth.uid())
  or exists(select 1 from public.games g where g.id=game_id and g.creator_id=(select auth.uid()))
);

create policy followers_own_read on public.game_followers for select to authenticated
using (user_id=(select auth.uid()));

create policy notifications_own_read on public.notifications for select to authenticated
using (user_id=(select auth.uid()));

create policy notifications_own_update on public.notifications for update to authenticated
using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

create policy blocks_related_read on public.blocks for select to authenticated
using (blocker_user_id=(select auth.uid()) or blocked_user_id=(select auth.uid()));

grant select on public.activities,public.positions,public.venues to anon,authenticated;
grant select on public.profiles,public.games,public.game_applications,public.game_participants,public.game_waiting_list,public.game_followers,public.notifications,public.blocks to authenticated;
grant select on public.profiles,public.games to anon;
grant update(display_name,avatar_url,city,visibility,language,about,updated_at) on public.profiles to authenticated;
grant update(read_at) on public.notifications to authenticated;

insert into public.activities(code,name_lv,name_en,category,participation_type,play_mode,supports_teams,supports_positions,supports_skill_levels,min_players,max_players) values
('padel','Padels','Padel','racket','partner','physical',false,false,true,4,4),
('tennis','Teniss','Tennis','racket','opponent','physical',false,false,true,2,4),
('badminton','Badmintons','Badminton','racket','opponent','physical',false,false,true,2,4),
('squash','Skvošs','Squash','racket','opponent','physical',false,false,true,2,2),
('table_tennis','Galda teniss','Table tennis','racket','opponent','physical',false,false,true,2,4),
('football','Futbols','Football','team','team','physical',true,true,true,4,22),
('basketball','Basketbols','Basketball','team','team','physical',true,true,true,4,10),
('basketball_3x3','3x3 basketbols','3x3 basketball','team','team','physical',true,true,true,4,6),
('volleyball','Volejbols','Volleyball','team','team','physical',true,true,true,4,12),
('beach_volleyball','Pludmales volejbols','Beach volleyball','team','team','physical',true,false,true,4,4),
('floorball','Florbols','Floorball','team','team','physical',true,true,true,4,12),
('hockey','Hokejs','Ice hockey','team','team','physical',true,true,true,4,12),
('boxing','Bokss','Boxing','combat','partner','physical',false,false,true,2,2),
('fencing','Paukošana','Fencing','combat','opponent','physical',false,false,true,2,2),
('bowling','Boulings','Bowling','precision','multiplayer','physical',false,false,false,2,8),
('darts','Šautriņas','Darts','precision','opponent','physical',false,false,false,2,8),
('pool','Biljards / Pūls','Pool / Billiards','precision','opponent','physical',false,false,true,2,4),
('chess','Šahs','Chess','mind','opponent','both',false,false,true,2,2),
('checkers','Dambrete','Checkers','mind','opponent','both',false,false,true,2,2),
('go','Go','Go','mind','opponent','both',false,false,true,2,2),
('backgammon','Bekgemons','Backgammon','mind','opponent','both',false,false,true,2,2),
('poker','Pokers','Poker','cards','multiplayer','both',false,false,false,2,10),
('bridge','Bridžs','Bridge','cards','partner','both',false,false,false,4,4)
on conflict(code) do nothing;

insert into public.positions(activity_id,code,name_lv,name_en,sort_order)
select id,'goalkeeper','Vārtsargs','Goalkeeper',10 from public.activities where code='football'
on conflict(activity_id,code) do nothing;
insert into public.positions(activity_id,code,name_lv,name_en,sort_order)
select id,'defender','Aizsargs','Defender',20 from public.activities where code='football'
on conflict(activity_id,code) do nothing;
insert into public.positions(activity_id,code,name_lv,name_en,sort_order)
select id,'midfielder','Pussargs','Midfielder',30 from public.activities where code='football'
on conflict(activity_id,code) do nothing;
insert into public.positions(activity_id,code,name_lv,name_en,sort_order)
select id,'forward','Uzbrucējs','Forward',40 from public.activities where code='football'
on conflict(activity_id,code) do nothing;

insert into public.positions(activity_id,code,name_lv,name_en,sort_order)
select id,'pg','Saspēles vadītājs','Point Guard',10 from public.activities where code='basketball'
on conflict(activity_id,code) do nothing;
insert into public.positions(activity_id,code,name_lv,name_en,sort_order)
select id,'sg','Uzbrūkošais aizsargs','Shooting Guard',20 from public.activities where code='basketball'
on conflict(activity_id,code) do nothing;
insert into public.positions(activity_id,code,name_lv,name_en,sort_order)
select id,'sf','Vieglais uzbrucējs','Small Forward',30 from public.activities where code='basketball'
on conflict(activity_id,code) do nothing;
insert into public.positions(activity_id,code,name_lv,name_en,sort_order)
select id,'pf','Spēka uzbrucējs','Power Forward',40 from public.activities where code='basketball'
on conflict(activity_id,code) do nothing;
insert into public.positions(activity_id,code,name_lv,name_en,sort_order)
select id,'c','Centrs','Center',50 from public.activities where code='basketball'
on conflict(activity_id,code) do nothing;

revoke execute on function public.rls_auto_enable() from public,anon,authenticated;

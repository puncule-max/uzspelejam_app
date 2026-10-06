
alter table public.profiles
  add column if not exists rating_average numeric(3,2) not null default 0,
  add column if not exists rating_count integer not null default 0,
  add column if not exists completed_games_count integer not null default 0;

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  reviewer_user_id uuid not null references public.profiles(id) on delete cascade,
  reviewed_user_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  reliable boolean not null default false,
  friendly boolean not null default false,
  good_teammate boolean not null default false,
  fair_player boolean not null default false,
  comment text check (comment is null or char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(game_id,reviewer_user_id,reviewed_user_id),
  check(reviewer_user_id <> reviewed_user_id)
);

create index idx_ratings_reviewed on public.ratings(reviewed_user_id,created_at desc);
create index idx_ratings_game on public.ratings(game_id);
create index idx_ratings_reviewer on public.ratings(reviewer_user_id,created_at desc);

alter table public.ratings enable row level security;

create policy ratings_authenticated_read on public.ratings
for select to authenticated using (true);

grant select on public.ratings to authenticated;

create or replace function private.recalculate_profile_rating(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  update public.profiles p
  set
    rating_average = coalesce((select round(avg(r.rating)::numeric,2) from public.ratings r where r.reviewed_user_id=p_user_id),0),
    rating_count = (select count(*)::integer from public.ratings r where r.reviewed_user_id=p_user_id),
    updated_at = now()
  where p.id=p_user_id;
end;
$$;
revoke all on function private.recalculate_profile_rating(uuid) from public,anon,authenticated;

create or replace function private.rating_aggregate_trigger()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  perform private.recalculate_profile_rating(coalesce(new.reviewed_user_id,old.reviewed_user_id));
  if tg_op='UPDATE' and new.reviewed_user_id<>old.reviewed_user_id then
    perform private.recalculate_profile_rating(old.reviewed_user_id);
  end if;
  return coalesce(new,old);
end;
$$;
revoke all on function private.rating_aggregate_trigger() from public,anon,authenticated;

create trigger ratings_recalculate_profile
after insert or update or delete on public.ratings
for each row execute procedure private.rating_aggregate_trigger();

create or replace function private.submit_rating_impl(
  p_game_id uuid,
  p_reviewed_user_id uuid,
  p_rating integer,
  p_reliable boolean default false,
  p_friendly boolean default false,
  p_good_teammate boolean default false,
  p_fair_player boolean default false,
  p_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid:=auth.uid();
  v_game public.games%rowtype;
  v_id uuid;
  v_reviewer_eligible boolean;
  v_reviewed_eligible boolean;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_reviewed_user_id=v_user then raise exception 'CANNOT_RATE_SELF'; end if;
  if p_rating<1 or p_rating>5 then raise exception 'INVALID_RATING'; end if;

  select * into v_game from public.games where id=p_game_id;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  if v_game.ends_at>now() then raise exception 'GAME_NOT_COMPLETED'; end if;

  v_reviewer_eligible :=
    v_game.creator_id=v_user
    or exists(
      select 1 from public.game_participants
      where game_id=p_game_id and user_id=v_user and status='accepted'
    );

  v_reviewed_eligible :=
    v_game.creator_id=p_reviewed_user_id
    or exists(
      select 1 from public.game_participants
      where game_id=p_game_id and user_id=p_reviewed_user_id and status='accepted'
    );

  if not v_reviewer_eligible then raise exception 'REVIEWER_NOT_ELIGIBLE'; end if;
  if not v_reviewed_eligible then raise exception 'REVIEWED_USER_NOT_ELIGIBLE'; end if;

  insert into public.ratings(
    game_id,reviewer_user_id,reviewed_user_id,rating,
    reliable,friendly,good_teammate,fair_player,comment,updated_at
  )
  values(
    p_game_id,v_user,p_reviewed_user_id,p_rating,
    coalesce(p_reliable,false),coalesce(p_friendly,false),
    coalesce(p_good_teammate,false),coalesce(p_fair_player,false),
    nullif(trim(p_comment),''),now()
  )
  on conflict(game_id,reviewer_user_id,reviewed_user_id) do update set
    rating=excluded.rating,
    reliable=excluded.reliable,
    friendly=excluded.friendly,
    good_teammate=excluded.good_teammate,
    fair_player=excluded.fair_player,
    comment=excluded.comment,
    updated_at=now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function private.submit_rating_impl(uuid,uuid,integer,boolean,boolean,boolean,boolean,text) from public,anon;
grant execute on function private.submit_rating_impl(uuid,uuid,integer,boolean,boolean,boolean,boolean,text) to authenticated;

create or replace function public.submit_rating(
  p_game_id uuid,
  p_reviewed_user_id uuid,
  p_rating integer,
  p_reliable boolean default false,
  p_friendly boolean default false,
  p_good_teammate boolean default false,
  p_fair_player boolean default false,
  p_comment text default null
)
returns uuid
language sql
security invoker
set search_path=''
as $$ select private.submit_rating_impl($1,$2,$3,$4,$5,$6,$7,$8); $$;

revoke all on function public.submit_rating(uuid,uuid,integer,boolean,boolean,boolean,boolean,text) from public,anon;
grant execute on function public.submit_rating(uuid,uuid,integer,boolean,boolean,boolean,boolean,text) to authenticated;

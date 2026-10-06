-- Run with an administrative SQL connection. All fixtures and writes roll back.
begin;
do $$
declare
  organizer uuid := gen_random_uuid();
  player uuid := gen_random_uuid();
  waiter uuid := gen_random_uuid();
  teen uuid := gen_random_uuid();
  activity uuid;
  game uuid;
  private_game uuid;
  application uuid;
  waiting uuid;
  conversation uuid;
  invite text;
  rejected boolean;
begin
  insert into auth.users(id,email,raw_user_meta_data)
  select id, 'verification-'||id||'@example.invalid',
    jsonb_build_object('display_name','Verification','birth_date',birth_date)
  from (values
    (organizer,'2000-01-01'), (player,'2000-01-01'), (waiter,'2000-01-01'),
    (teen,(current_date - interval '17 years')::date::text)
  ) as fixtures(id,birth_date);

  if (select count(*) from public.profiles where id in (organizer,player,waiter,teen)) <> 4 then
    raise exception 'Automatic profile creation failed';
  end if;
  rejected := false;
  begin
    insert into auth.users(id,email,raw_user_meta_data) values(gen_random_uuid(),
      'underage-verification@example.invalid',jsonb_build_object('display_name','Underage','birth_date',(current_date-interval '15 years')::date::text));
  exception when others then
    if sqlerrm not like '%MINIMUM_AGE_16%' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'Underage signup was accepted'; end if;

  select id into activity from public.activities where active and play_mode in ('online','both') limit 1;
  if activity is null then raise exception 'Online activity catalogue is empty'; end if;

  perform set_config('request.jwt.claim.sub',organizer::text,true);
  execute 'set local role authenticated';
  game := public.create_game_with_requirements(
    p_activity_id=>activity,p_mode=>'online',p_starts_at=>now()+interval '2 days',
    p_ends_at=>now()+interval '2 days 1 hour',p_additional_players_required=>1,
    p_online_platform=>'Verification',p_organizer_share_included=>true);
  private_game := public.create_game_with_requirements(
    p_activity_id=>activity,p_mode=>'online',p_starts_at=>now()+interval '2 days',
    p_ends_at=>now()+interval '2 days 1 hour',p_additional_players_required=>1,
    p_visibility=>'private',p_online_platform=>'Verification',p_organizer_share_included=>true);
  invite := public.create_private_invite(private_game);

  perform set_config('request.jwt.claim.sub',teen::text,true);
  rejected := false;
  begin
    update public.profiles set visibility='public' where id=teen;
  exception when others then
    if sqlerrm not like '%TEEN_PROFILE_MUST_BE_PRIVATE%' then raise; end if;
    rejected:=true;
  end;
  if not rejected then raise exception 'Teen public visibility update was accepted'; end if;
  if (select visibility from public.profiles where id=teen) <> 'private' then
    raise exception 'Teen profile became public';
  end if;
  rejected := false;
  begin
    update public.profiles set rating_count=100 where id=teen;
  exception when insufficient_privilege then rejected:=true;
  end;
  if not rejected then raise exception 'Client changed reputation aggregate'; end if;

  perform set_config('request.jwt.claim.sub',player::text,true);
  if exists(select 1 from public.games where id=private_game) then
    raise exception 'Private game visible without invite';
  end if;
  if public.claim_private_invite(invite) <> private_game then raise exception 'Invite claim failed'; end if;
  if not exists(select 1 from public.games where id=private_game) then raise exception 'Claimed game inaccessible'; end if;
  application := public.join_game(game);
  conversation := public.ensure_organizer_conversation(game);
  insert into public.messages(conversation_id,sender_id,body) values(conversation,player,'Verification message');
  rejected := false;
  begin
    perform public.accept_application(application);
  exception when others then
    if sqlerrm not like '%ORGANIZER_REQUIRED%' then raise; end if;
    rejected:=true;
  end;
  if not rejected then raise exception 'Applicant accepted own request'; end if;

  perform set_config('request.jwt.claim.sub',organizer::text,true);
  perform public.accept_application(application);

  execute 'reset role';
  perform set_config('request.jwt.claim.sub','',true);
  execute 'set local role anon';
  if (select accepted_players_count from public.get_game_capacity(game)) <> 1 then
    raise exception 'Guest capacity summary is incorrect';
  end if;
  if exists(select 1 from public.get_game_capacity(private_game)) then
    raise exception 'Guest can read private game capacity';
  end if;
  execute 'reset role';
  execute 'set local role authenticated';

  perform set_config('request.jwt.claim.sub',waiter::text,true);
  if exists(select 1 from public.messages where conversation_id=conversation) then
    raise exception 'Outsider can read application messages';
  end if;
  rejected := false;
  begin
    insert into public.messages(conversation_id,sender_id,body) values(conversation,waiter,'Unauthorized');
  exception when insufficient_privilege then rejected:=true;
  end;
  if not rejected then raise exception 'Outsider can send application message'; end if;
  rejected := false;
  begin
    perform public.join_game(game);
  exception when others then
    if sqlerrm not like '%GAME_FULL%' then raise; end if;
    rejected:=true;
  end;
  if not rejected then raise exception 'Capacity exceeded'; end if;
  waiting := public.join_waiting_list(game);
  perform public.follow_game(game);
  if (select push_enabled from public.game_followers where game_id=game and user_id=waiter) then
    raise exception 'Unavailable push enabled by default';
  end if;

  perform set_config('request.jwt.claim.sub',player::text,true);
  perform public.leave_game(game);
  perform set_config('request.jwt.claim.sub',organizer::text,true);
  perform public.promote_waiting_user(waiting);
  if (select count(*) from public.game_participants where game_id=game and status='accepted') <> 1 then
    raise exception 'Waiting list promotion capacity failed';
  end if;
  perform public.cancel_game(private_game,'Verification');

  execute 'reset role';
  update public.games set starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour' where id=game;
  perform set_config('request.jwt.claim.sub',waiter::text,true);
  execute 'set local role authenticated';
  perform public.submit_rating(game,organizer,5,true,true,true,true);
  perform public.mark_all_notifications_read();
  if exists(select 1 from public.notifications where user_id=waiter and read_at is null) then
    raise exception 'Notification read state failed';
  end if;
  execute 'reset role';
  if (select rating_count from public.profiles where id=organizer) <> 1 then
    raise exception 'Rating aggregate failed';
  end if;
end;
$$;
rollback;
select 'PASS: signup, age, teen privacy, profile grants, private invites, join/accept, capacity, waiting list, chat RLS, cancellation, ratings, notifications; all fixtures rolled back' as result;

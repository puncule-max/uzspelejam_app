
drop policy if exists conversation_members_same_conversation_read on public.conversation_members;
create policy conversation_members_same_conversation_read
on public.conversation_members
for select
to authenticated
using (
  exists(
    select 1
    from public.conversation_members mine
    where mine.conversation_id=conversation_members.conversation_id
      and mine.user_id=(select auth.uid())
  )
);

drop policy if exists messages_member_read on public.messages;
create policy messages_member_read
on public.messages
for select
to authenticated
using (
  exists(
    select 1
    from public.conversation_members cm
    where cm.conversation_id=messages.conversation_id
      and cm.user_id=(select auth.uid())
  )
);

drop policy if exists messages_active_member_insert on public.messages;
create policy messages_active_member_insert
on public.messages
for insert
to authenticated
with check (
  sender_id=(select auth.uid())
  and exists(
    select 1
    from public.conversation_members cm
    where cm.conversation_id=messages.conversation_id
      and cm.user_id=(select auth.uid())
      and cm.left_at is null
  )
);

create or replace function private.ensure_organizer_conversation_impl(p_game_id uuid)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid:=auth.uid();
  v_game public.games%rowtype;
  v_conversation uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_game
  from public.games
  where id=p_game_id;

  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  if v_game.creator_id=v_user then raise exception 'ORGANIZER_USES_GROUP_CHAT'; end if;
  if v_game.cancelled_at is not null then raise exception 'GAME_CANCELLED'; end if;
  if v_game.ends_at<=now() then raise exception 'GAME_COMPLETED'; end if;
  if not private.can_view_game(p_game_id,v_user) then raise exception 'GAME_NOT_ACCESSIBLE'; end if;

  if exists(
    select 1 from public.blocks
    where (blocker_user_id=v_user and blocked_user_id=v_game.creator_id)
       or (blocker_user_id=v_game.creator_id and blocked_user_id=v_user)
  ) then
    raise exception 'USER_BLOCKED';
  end if;

  insert into public.conversations(game_id,type,applicant_user_id)
  values(p_game_id,'application',v_user)
  on conflict do nothing;

  select id into v_conversation
  from public.conversations
  where game_id=p_game_id
    and type='application'
    and applicant_user_id=v_user
  limit 1;

  insert into public.conversation_members(conversation_id,user_id,joined_at,left_at)
  values(v_conversation,v_game.creator_id,now(),null)
  on conflict(conversation_id,user_id) do update
    set left_at=null;

  insert into public.conversation_members(conversation_id,user_id,joined_at,left_at)
  values(v_conversation,v_user,now(),null)
  on conflict(conversation_id,user_id) do update
    set left_at=null;

  return v_conversation;
end;
$$;

revoke all on function private.ensure_organizer_conversation_impl(uuid) from public,anon,authenticated;

create or replace function public.ensure_organizer_conversation(p_game_id uuid)
returns uuid
language sql
security invoker
set search_path=''
as $$
  select private.ensure_organizer_conversation_impl($1);
$$;

revoke all on function public.ensure_organizer_conversation(uuid) from public,anon;
grant execute on function public.ensure_organizer_conversation(uuid) to authenticated;


create or replace function private.is_conversation_member(
  p_conversation_id uuid,
  p_active_only boolean default false
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1
    from public.conversation_members cm
    where cm.conversation_id=p_conversation_id
      and cm.user_id=auth.uid()
      and (not p_active_only or cm.left_at is null)
  );
$$;

revoke all on function private.is_conversation_member(uuid,boolean) from public,anon;
grant execute on function private.is_conversation_member(uuid,boolean) to authenticated;

drop policy if exists conversations_member_read on public.conversations;
create policy conversations_member_read
on public.conversations
for select
to authenticated
using (private.is_conversation_member(id,false));

drop policy if exists conversation_members_same_conversation_read on public.conversation_members;
create policy conversation_members_same_conversation_read
on public.conversation_members
for select
to authenticated
using (private.is_conversation_member(conversation_id,false));

drop policy if exists messages_member_read on public.messages;
create policy messages_member_read
on public.messages
for select
to authenticated
using (private.is_conversation_member(conversation_id,false));

drop policy if exists messages_active_member_insert on public.messages;
create policy messages_active_member_insert
on public.messages
for insert
to authenticated
with check (
  sender_id=(select auth.uid())
  and private.is_conversation_member(conversation_id,true)
);

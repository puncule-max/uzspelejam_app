
do $$ begin create type public.conversation_type as enum ('application','group'); exception when duplicate_object then null; end $$;

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  type public.conversation_type not null,
  applicant_user_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (
    (type='application' and applicant_user_id is not null)
    or (type='group' and applicant_user_id is null)
  )
);
create unique index conversations_one_group_per_game
  on public.conversations(game_id) where type='group';
create unique index conversations_one_application_per_user
  on public.conversations(game_id,applicant_user_id) where type='application';

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key(conversation_id,user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index idx_conversation_members_user on public.conversation_members(user_id,left_at,conversation_id);
create index idx_messages_conversation_created on public.messages(conversation_id,created_at);
create index idx_messages_sender on public.messages(sender_id);

create or replace function private.ensure_game_group_chat()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare v_conversation uuid;
begin
  insert into public.conversations(game_id,type)
  values(new.id,'group')
  on conflict do nothing;

  select id into v_conversation
  from public.conversations
  where game_id=new.id and type='group'
  limit 1;

  insert into public.conversation_members(conversation_id,user_id,left_at)
  values(v_conversation,new.creator_id,null)
  on conflict(conversation_id,user_id) do update set left_at=null;

  return new;
end;
$$;
revoke all on function private.ensure_game_group_chat() from public,anon,authenticated;

create trigger games_create_group_chat
after insert on public.games
for each row execute procedure private.ensure_game_group_chat();

create or replace function private.sync_application_chat()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare v_creator uuid; v_conversation uuid;
begin
  select creator_id into v_creator from public.games where id=new.game_id;

  if new.status='pending' then
    insert into public.conversations(game_id,type,applicant_user_id)
    values(new.game_id,'application',new.user_id)
    on conflict do nothing;

    select id into v_conversation
    from public.conversations
    where game_id=new.game_id and type='application' and applicant_user_id=new.user_id
    limit 1;

    insert into public.conversation_members(conversation_id,user_id,left_at)
    values(v_conversation,v_creator,null)
    on conflict(conversation_id,user_id) do update set left_at=null;

    insert into public.conversation_members(conversation_id,user_id,left_at)
    values(v_conversation,new.user_id,null)
    on conflict(conversation_id,user_id) do update set left_at=null;
  elsif new.status in ('declined','withdrawn') then
    update public.conversation_members cm
    set left_at=coalesce(cm.left_at,now())
    where cm.user_id=new.user_id
      and cm.conversation_id in (
        select c.id from public.conversations c
        where c.game_id=new.game_id and c.type='application' and c.applicant_user_id=new.user_id
      );
  end if;

  return new;
end;
$$;
revoke all on function private.sync_application_chat() from public,anon,authenticated;

create trigger applications_sync_chat
after insert or update of status on public.game_applications
for each row execute procedure private.sync_application_chat();

create or replace function private.sync_group_chat_member()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare v_conversation uuid;
begin
  select id into v_conversation
  from public.conversations
  where game_id=new.game_id and type='group'
  limit 1;

  if v_conversation is null then
    insert into public.conversations(game_id,type) values(new.game_id,'group')
    returning id into v_conversation;
  end if;

  if new.status='accepted' then
    insert into public.conversation_members(conversation_id,user_id,left_at)
    values(v_conversation,new.user_id,null)
    on conflict(conversation_id,user_id) do update set left_at=null;
  else
    update public.conversation_members
    set left_at=coalesce(left_at,now())
    where conversation_id=v_conversation and user_id=new.user_id;
  end if;

  return new;
end;
$$;
revoke all on function private.sync_group_chat_member() from public,anon,authenticated;

create trigger participants_sync_group_chat
after insert or update of status on public.game_participants
for each row execute procedure private.sync_group_chat_member();

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

create policy conversations_member_read on public.conversations
for select to authenticated
using (
  exists(
    select 1 from public.conversation_members cm
    where cm.conversation_id=id and cm.user_id=(select auth.uid())
  )
);

create policy conversation_members_same_conversation_read on public.conversation_members
for select to authenticated
using (
  exists(
    select 1 from public.conversation_members mine
    where mine.conversation_id=conversation_id and mine.user_id=(select auth.uid())
  )
);

create policy messages_member_read on public.messages
for select to authenticated
using (
  exists(
    select 1 from public.conversation_members cm
    where cm.conversation_id=conversation_id and cm.user_id=(select auth.uid())
  )
);

create policy messages_active_member_insert on public.messages
for insert to authenticated
with check (
  sender_id=(select auth.uid())
  and exists(
    select 1 from public.conversation_members cm
    where cm.conversation_id=conversation_id
      and cm.user_id=(select auth.uid())
      and cm.left_at is null
  )
);

grant select on public.conversations,public.conversation_members,public.messages to authenticated;
grant insert(conversation_id,sender_id,body) on public.messages to authenticated;

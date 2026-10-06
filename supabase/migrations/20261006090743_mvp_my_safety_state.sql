
create or replace function private.get_my_safety_state_impl()
returns table(is_minor boolean)
language sql
stable
security definer
set search_path=''
as $$
  select ap.is_minor
  from private.account_private ap
  where ap.user_id=auth.uid()
  limit 1;
$$;

revoke all on function private.get_my_safety_state_impl() from public,anon;
grant execute on function private.get_my_safety_state_impl() to authenticated;

create or replace function public.get_my_safety_state()
returns table(is_minor boolean)
language sql
stable
security invoker
set search_path=''
as $$ select * from private.get_my_safety_state_impl(); $$;

revoke all on function public.get_my_safety_state() from public,anon;
grant execute on function public.get_my_safety_state() to authenticated;

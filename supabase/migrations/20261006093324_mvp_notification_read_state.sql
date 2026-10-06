
create or replace function private.mark_notification_read_impl(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.notifications
  set read_at=coalesce(read_at,now())
  where id=p_notification_id and user_id=v_user;
end;
$$;

create or replace function private.mark_all_notifications_read_impl()
returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.notifications
  set read_at=now()
  where user_id=v_user and read_at is null;
end;
$$;

revoke all on function private.mark_notification_read_impl(uuid) from public,anon;
revoke all on function private.mark_all_notifications_read_impl() from public,anon;
grant execute on function private.mark_notification_read_impl(uuid) to authenticated;
grant execute on function private.mark_all_notifications_read_impl() to authenticated;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void language sql security invoker set search_path=''
as $$ select private.mark_notification_read_impl($1); $$;

create or replace function public.mark_all_notifications_read()
returns void language sql security invoker set search_path=''
as $$ select private.mark_all_notifications_read_impl(); $$;

revoke all on function public.mark_notification_read(uuid) from public,anon;
revoke all on function public.mark_all_notifications_read() from public,anon;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;


create or replace function private.enforce_profile_safety()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if exists(
    select 1 from private.account_private ap
    where ap.user_id=new.id and ap.is_minor=true
  ) and new.visibility='public' then
    raise exception 'TEEN_PROFILE_MUST_BE_PRIVATE';
  end if;
  new.updated_at:=now();
  return new;
end;
$$;
revoke all on function private.enforce_profile_safety() from public,anon,authenticated;

drop trigger if exists profiles_enforce_safety on public.profiles;
create trigger profiles_enforce_safety
before update on public.profiles
for each row execute procedure private.enforce_profile_safety();

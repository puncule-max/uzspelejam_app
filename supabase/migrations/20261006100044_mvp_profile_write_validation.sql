
alter table public.profiles
  drop constraint if exists profiles_display_name_length_check,
  drop constraint if exists profiles_city_length_check,
  drop constraint if exists profiles_about_length_check,
  drop constraint if exists profiles_language_check;

alter table public.profiles
  add constraint profiles_display_name_length_check
    check (char_length(trim(display_name)) between 1 and 80),
  add constraint profiles_city_length_check
    check (city is null or char_length(city)<=120),
  add constraint profiles_about_length_check
    check (about is null or char_length(about)<=1000),
  add constraint profiles_language_check
    check (language in ('lv','en'));

create or replace function private.set_my_avatar_url_impl(p_avatar_url text)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid:=auth.uid();
  v_prefix text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  v_prefix:='https://pjrosigqyfkagbncoeqy.supabase.co/storage/v1/object/public/avatars/'
    ||v_user::text||'/avatar';

  if p_avatar_url is not null
     and p_avatar_url<>v_prefix
     and p_avatar_url not like v_prefix||'?%' then
    raise exception 'INVALID_AVATAR_URL';
  end if;

  update public.profiles
  set avatar_url=p_avatar_url,updated_at=now()
  where id=v_user;
end;
$$;

revoke all on function private.set_my_avatar_url_impl(text) from public,anon;
grant execute on function private.set_my_avatar_url_impl(text) to authenticated;

create or replace function public.set_my_avatar_url(p_avatar_url text)
returns void
language sql
security invoker
set search_path=''
as $$ select private.set_my_avatar_url_impl($1); $$;

revoke all on function public.set_my_avatar_url(text) from public,anon;
grant execute on function public.set_my_avatar_url(text) to authenticated;

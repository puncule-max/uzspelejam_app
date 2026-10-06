
revoke insert, delete, truncate, references, trigger
on public.profiles
from anon, authenticated;

revoke update
on public.profiles
from anon, authenticated;

grant update(display_name,city,visibility,language,about)
on public.profiles
to authenticated;

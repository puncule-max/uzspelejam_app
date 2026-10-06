-- Recovered from the already-applied production migration. Do not reapply.
alter table public.game_followers
alter column push_enabled set default false;

update public.game_followers
set push_enabled=false
where push_enabled=true;

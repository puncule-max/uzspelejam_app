create or replace function private.get_game_capacity_impl(p_game_id uuid)
returns table(accepted_players_count integer, position_counts jsonb)
language sql stable security definer set search_path=''
as $$
  select private.accepted_count(g.id),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'position_id',r.position_id,'required_count',r.required_count,
        'accepted_count',(select count(*) from public.game_participants gp
          where gp.game_id=g.id and gp.position_id=r.position_id and gp.status='accepted')
      ))
      from public.game_position_requirements r where r.game_id=g.id
    ),'[]'::jsonb)
  from public.games g
  where g.id=p_game_id
    and (g.visibility='public' or (auth.uid() is not null and private.can_view_game(g.id,auth.uid())));
$$;
revoke all on function private.get_game_capacity_impl(uuid) from public;
grant execute on function private.get_game_capacity_impl(uuid) to anon,authenticated;

create or replace function public.get_game_capacity(p_game_id uuid)
returns table(accepted_players_count integer, position_counts jsonb)
language sql stable security invoker set search_path=''
as $$ select * from private.get_game_capacity_impl($1); $$;
revoke all on function public.get_game_capacity(uuid) from public;
grant execute on function public.get_game_capacity(uuid) to anon,authenticated;

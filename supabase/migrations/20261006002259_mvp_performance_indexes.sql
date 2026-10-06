
create index if not exists idx_blocks_blocked_user on public.blocks(blocked_user_id);
create index if not exists idx_applications_requested_position on public.game_applications(requested_position_id);
create index if not exists idx_participants_position on public.game_participants(position_id);
create index if not exists idx_waiting_user on public.game_waiting_list(user_id);
create index if not exists idx_games_activity on public.games(activity_id);
create index if not exists idx_games_venue on public.games(venue_id);
create index if not exists idx_notifications_game on public.notifications(game_id);

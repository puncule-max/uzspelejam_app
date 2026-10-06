
create index if not exists idx_private_invites_created_by
on private.game_invites(created_by);

create index if not exists idx_conversations_applicant_user
on public.conversations(applicant_user_id)
where applicant_user_id is not null;

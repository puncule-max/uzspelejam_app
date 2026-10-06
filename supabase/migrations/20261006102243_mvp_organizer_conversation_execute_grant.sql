-- The public SECURITY INVOKER wrapper delegates to this private implementation.
-- The implementation checks auth.uid(), game access, lifecycle and blocks.
revoke all on function private.ensure_organizer_conversation_impl(uuid) from public, anon;
grant execute on function private.ensure_organizer_conversation_impl(uuid) to authenticated;

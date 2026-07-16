-- Block client PostgREST writes to agastya_sessions.
-- Premium and session JSON must only be mutated via the backend service role.

drop policy if exists agastya_sessions_update_own on public.agastya_sessions;

revoke update, insert, delete on public.agastya_sessions from anon, authenticated;

-- SELECT own rows remains for authenticated (existing policy).
-- Service role bypasses RLS and retains full access.

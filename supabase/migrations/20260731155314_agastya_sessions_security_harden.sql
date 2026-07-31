-- Harden agastya_sessions privileges + SECURITY/RPC surface after security audit.
-- Idempotent: REVOKE / GRANT / ALTER FUNCTION SET are safe to re-run.
-- Does not alter RLS policies or premium/session business logic.

-- ---------------------------------------------------------------------------
-- 1) Strip dangerous / unused table privileges from client roles
--    Keep SELECT so existing agastya_sessions_select_own policy still works.
--    TRUNCATE is not subject to RLS — must not remain on anon/authenticated.
-- ---------------------------------------------------------------------------
revoke truncate, trigger, references on table public.agastya_sessions
  from anon, authenticated;

-- Defense in depth: restate write revokes from 20260716030000 (no-op if already gone).
revoke insert, update, delete on table public.agastya_sessions
  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) Block PostgREST RPC on SECURITY DEFINER allowlist trigger function
--    Trigger continues to fire for service_role / postgres writers.
-- ---------------------------------------------------------------------------
revoke execute on function public.agastya_grant_premium_allowlist()
  from public, anon, authenticated;

grant execute on function public.agastya_grant_premium_allowlist()
  to postgres, service_role;

-- Same advisor class: event-trigger helper must not be client-callable via RPC.
revoke execute on function public.rls_auto_enable()
  from public, anon, authenticated;

grant execute on function public.rls_auto_enable()
  to postgres, service_role;

-- ---------------------------------------------------------------------------
-- 3) Fixed search_path on mutable / SECURITY DEFINER helpers (advisor WARN)
-- ---------------------------------------------------------------------------
alter function public.set_agastya_sessions_updated_at()
  set search_path = public;

alter function public.agastya_grant_premium_allowlist()
  set search_path = public;

alter function public.rls_auto_enable()
  set search_path = pg_catalog;

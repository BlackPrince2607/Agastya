-- Agastya: server-side premium flag written by RevenueCat webhook.
-- This is the authoritative premium status — not the client-side boolean.

alter table public.agastya_sessions
  add column if not exists is_premium boolean not null default false;

-- Fast lookup by supabase_user_id (used by webhook to update on subscription events)
create index if not exists agastya_sessions_supabase_user_id_idx
  on public.agastya_sessions (supabase_user_id)
  where supabase_user_id is not null;

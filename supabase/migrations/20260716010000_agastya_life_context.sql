-- Life Blueprint journey context: layered memory + today's guidance cache.
-- Permanent Identity remains palm_analysis / reports (no new columns).

alter table public.agastya_sessions
  add column if not exists user_memory jsonb not null default '{"journey":[],"temporary":[]}'::jsonb;

alter table public.agastya_sessions
  add column if not exists daily_context jsonb;

-- Weekly Journey Summary cache (one chapter per ISO week).

alter table public.agastya_sessions
  add column if not exists weekly_context jsonb;

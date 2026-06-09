-- Agastya predictions cache: per-period forecasts stored alongside the session row.
-- Apply via Supabase SQL editor or `supabase db push` after linking the project.

alter table public.agastya_sessions
  add column if not exists predictions jsonb;

-- Push notification tokens + send dedup log (service-role only).
-- Applied via Supabase SQL editor or `supabase db push`.

-- ---------------------------------------------------------------------------
-- Device Expo push tokens (backend writes via service role)
-- ---------------------------------------------------------------------------
create table if not exists public.agastya_push_tokens (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references public.agastya_sessions (session_id) on delete cascade,
  supabase_user_id uuid references auth.users (id) on delete set null,
  expo_push_token text not null,
  platform text check (platform is null or platform in ('ios', 'android')),
  timezone_offset_minutes integer,
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agastya_push_tokens_expo_push_token_key unique (expo_push_token)
);

create index if not exists agastya_push_tokens_session_id_idx
  on public.agastya_push_tokens (session_id);

create index if not exists agastya_push_tokens_supabase_user_id_idx
  on public.agastya_push_tokens (supabase_user_id)
  where supabase_user_id is not null;

create index if not exists agastya_push_tokens_enabled_last_seen_idx
  on public.agastya_push_tokens (enabled, last_seen_at);

create or replace function public.set_agastya_push_tokens_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists agastya_push_tokens_updated_at on public.agastya_push_tokens;
create trigger agastya_push_tokens_updated_at
  before update on public.agastya_push_tokens
  for each row execute function public.set_agastya_push_tokens_updated_at();

alter table public.agastya_push_tokens enable row level security;

revoke all on public.agastya_push_tokens from anon, authenticated;
grant all on public.agastya_push_tokens to service_role;

-- ---------------------------------------------------------------------------
-- Dedup log for cron / event pushes (one send per session+event+key)
-- ---------------------------------------------------------------------------
create table if not exists public.agastya_notification_log (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  event_type text not null,
  event_key text not null,
  sent_at timestamptz not null default now(),
  constraint agastya_notification_log_dedup unique (session_id, event_type, event_key)
);

create index if not exists agastya_notification_log_session_idx
  on public.agastya_notification_log (session_id);

alter table public.agastya_notification_log enable row level security;

revoke all on public.agastya_notification_log from anon, authenticated;
grant all on public.agastya_notification_log to service_role;

-- Billing providers: webhook idempotency, checkout intents, premium expiry/source.

alter table public.agastya_sessions
  add column if not exists premium_source text,
  add column if not exists premium_expires_at timestamptz;

comment on column public.agastya_sessions.premium_source is
  'Entitlement source: revenuecat | stripe | razorpay | allowlist';
comment on column public.agastya_sessions.premium_expires_at is
  'When set, premium is active only while is_premium and expires_at > now()';

create table if not exists public.billing_webhook_events (
  id bigserial primary key,
  provider text not null,
  event_id text not null,
  processed_at timestamptz not null default now(),
  unique (provider, event_id)
);

create table if not exists public.billing_checkout_intents (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  device_install_id text not null,
  supabase_user_id uuid,
  provider text not null,
  billing_period text not null check (billing_period in ('monthly', 'annual')),
  amount integer not null,
  currency text not null default 'INR',
  razorpay_payment_link_id text,
  external_transaction_token text,
  administrative_area text,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'expired', 'cancelled', 'failed')),
  success_url text,
  cancel_url text,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  paid_at timestamptz
);

create index if not exists billing_checkout_intents_session_idx
  on public.billing_checkout_intents (session_id);

create index if not exists billing_checkout_intents_link_idx
  on public.billing_checkout_intents (razorpay_payment_link_id)
  where razorpay_payment_link_id is not null;

create table if not exists public.billing_play_reports (
  id bigserial primary key,
  checkout_intent_id uuid references public.billing_checkout_intents (id),
  external_transaction_token text not null,
  reported_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists billing_play_reports_pending_idx
  on public.billing_play_reports (created_at)
  where reported_at is null;

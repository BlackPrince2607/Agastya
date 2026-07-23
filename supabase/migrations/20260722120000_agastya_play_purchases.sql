-- Idempotent Google Play purchase tracking (prevents double-grant on token replay).
-- agastya_sessions PK is session_id (text), not id.

create table if not exists public.billing_play_purchases (
  purchase_token text primary key,
  session_id text not null references public.agastya_sessions(session_id) on delete cascade,
  product_id text not null,
  order_id text,
  premium_granted_at timestamptz not null default now()
);

create index if not exists billing_play_purchases_session_id_idx
  on public.billing_play_purchases (session_id);

alter table public.billing_play_purchases enable row level security;

revoke all on public.billing_play_purchases from anon, authenticated;

-- Service role only — same pattern as billing_checkout_intents.

-- Harden billing tables: service-role only (no client PostgREST access).

alter table public.billing_webhook_events enable row level security;
alter table public.billing_checkout_intents enable row level security;
alter table public.billing_play_reports enable row level security;

revoke all on public.billing_webhook_events from anon, authenticated;
revoke all on public.billing_checkout_intents from anon, authenticated;
revoke all on public.billing_play_reports from anon, authenticated;

-- No policies for anon/authenticated — deny by default under RLS.
-- Service role bypasses RLS.

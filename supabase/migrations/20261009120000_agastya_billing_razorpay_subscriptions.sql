-- Razorpay Subscriptions (auto-renewing monthly / yearly): link checkout intents to subscriptions.

alter table public.billing_checkout_intents
  add column if not exists razorpay_subscription_id text;

create index if not exists billing_checkout_intents_subscription_idx
  on public.billing_checkout_intents (razorpay_subscription_id)
  where razorpay_subscription_id is not null;

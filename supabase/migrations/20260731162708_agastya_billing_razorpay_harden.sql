-- Razorpay production harden:
-- 1) Retry-safe webhook idempotency (processing / processed / failed)
-- 2) Store razorpay_payment_id on checkout intents for refund resolution

alter table public.billing_webhook_events
  add column if not exists status text,
  add column if not exists updated_at timestamptz;

-- Existing rows were insert-on-claim (= successfully observed); treat as processed.
update public.billing_webhook_events
set
  status = coalesce(status, 'processed'),
  updated_at = coalesce(updated_at, processed_at, now())
where status is null or updated_at is null;

alter table public.billing_webhook_events
  alter column status set default 'processed',
  alter column status set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

alter table public.billing_webhook_events
  drop constraint if exists billing_webhook_events_status_check;

alter table public.billing_webhook_events
  add constraint billing_webhook_events_status_check
  check (status in ('processing', 'processed', 'failed'));

alter table public.billing_checkout_intents
  add column if not exists razorpay_payment_id text;

create index if not exists billing_checkout_intents_payment_idx
  on public.billing_checkout_intents (razorpay_payment_id)
  where razorpay_payment_id is not null;

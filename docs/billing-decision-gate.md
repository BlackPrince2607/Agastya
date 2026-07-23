# Billing decision gate (post Track 1.5)

## Inputs

- Completed [`docs/billing-spike-memo.md`](billing-spike-memo.md) with Pass or Fail
- Track 1 hardening merged and web Razorpay staging-verified

## If PASS

1. Keep BillingManager / providers / server `is_premium`.
2. Productize User Choice from paywall using **sync-only** Play path (no second `purchasePackage`).
3. Enable Android Razorpay only via `BILLING_RAZORPAY_ANDROID_ENABLED=true` after ExternalTransactions works.
4. Proceed to Track 2 checklist in DEPLOY.md §6c / Track 2.

## If FAIL

**Do not** enable `BILLING_RAZORPAY_ANDROID_ENABLED`.

Default alternate:

- Android / iOS: RevenueCat only  
- Web: Razorpay (and/or Stripe) from Track 1  

Optional later:

- Wait for RevenueCat-native User Choice support  
- New design review for `PurchasesAreCompletedBy.MY_APP` (separate epic)

## Sign-off

| Role | Name | Date | Decision |
|---|---|---|---|
| Eng | | | Pass / Fail |
| Product | | | Proceed Track 2 / Stay Track 1 |

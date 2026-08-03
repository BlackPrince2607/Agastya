# Razorpay-direct Premium (monthly / annual)

Android: **Razorpay Payment Link only** while `EXPO_PUBLIC_BILLING_RAZORPAY_TEST_BYPASS=true` (no Google Play User Choice sheet).

When you enroll User Choice Billing later, set both app and API bypass flags to `false` to restore Play + Razorpay choice.

## Prices (INR)

| Plan | Amount | Paise env |
|------|--------|-----------|
| Monthly | ₹149 | `RAZORPAY_AMOUNT_MONTHLY_PAISE=14900` |
| Annual | ₹349 | `RAZORPAY_AMOUNT_ANNUAL_PAISE=34900` |

## Flow

1. User picks monthly or yearly on paywall, taps **Unlock Premium**.
2. App opens Razorpay hosted Payment Link (no User Choice dialog).
3. Webhook / confirm → `is_premium=true` with period expiry.

## Env checklist

**Backend:** `RAZORPAY_*`, `RAZORPAY_AMOUNT_MONTHLY_PAISE`, `RAZORPAY_AMOUNT_ANNUAL_PAISE`, `BILLING_RAZORPAY_ENABLED`, `BILLING_RAZORPAY_ANDROID_ENABLED`, **`BILLING_RAZORPAY_TEST_BYPASS=true`**

**Frontend (EAS):** `EXPO_PUBLIC_BILLING_RAZORPAY_TEST_BYPASS=true` on production / preview / prototype

## Later: restore User Choice

1. Enroll Billing Choice (India) in Play Console.
2. Create subscription products `premium_monthly` / `premium_annual`.
3. Set bypass flags to `false` and rebuild.

See [DEPLOY.md](../DEPLOY.md) §6 for full setup.

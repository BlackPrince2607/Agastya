# Razorpay-only billing (feature/razorpay-only)

Android India: Google Play User Choice → Razorpay or Google Play subscriptions.

## Flow

1. User taps **Unlock Premium** on paywall.
2. Google Play User Choice dialog (mandatory).
3. **Alternative billing:** Razorpay Payment Link → webhook → `is_premium=true` → ExternalTransactions report.
4. **Google Play:** purchase acknowledged natively → `POST /billing/google-play/verify-purchase` → RTDN for renewals/cancellations.

## Env checklist

**Backend:** `RAZORPAY_*`, `BILLING_RAZORPAY_ENABLED`, `BILLING_RAZORPAY_ANDROID_ENABLED`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `GOOGLE_PLAY_RTDN_VERIFICATION_TOKEN`, `CHECKOUT_ALLOWED_RETURN_ORIGINS`

**Frontend:** `EXPO_PUBLIC_PLAY_PRODUCT_MONTHLY`, `EXPO_PUBLIC_PLAY_PRODUCT_ANNUAL`

## Play Console

1. Enroll in Billing Choice (India).
2. Create subscription products matching env SKUs.
3. Configure RTDN Pub/Sub → `POST /v1/webhooks/google-play?token=...`

See [DEPLOY.md](../DEPLOY.md) §6 for full setup.

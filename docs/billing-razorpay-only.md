# Razorpay + Play User Choice (one-time Premium)

Android India: Google Play User Choice → **Razorpay Payment Link** (focus) or **Google Play** one-time INAPP.

## Flow

1. User taps **Unlock Premium** on paywall (single lifetime price).
2. Google Play User Choice dialog (mandatory on production builds).
3. **Alternative billing:** Razorpay hosted Payment Link webpage → webhook / confirm → `is_premium=true`, `premium_expires_at=null` → ExternalTransactions report.
4. **Google Play:** one-time product `premium_unlock` acknowledged natively → `POST /v1/billing/google-play/verify-purchase` → RTDN for one-time / voided purchases.

## Env checklist

**Backend:** `RAZORPAY_*`, `RAZORPAY_AMOUNT_PREMIUM_PAISE`, `BILLING_RAZORPAY_ENABLED`, `BILLING_RAZORPAY_ANDROID_ENABLED`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `GOOGLE_PLAY_RTDN_VERIFICATION_TOKEN`, `CHECKOUT_ALLOWED_RETURN_ORIGINS`

**Frontend:** `EXPO_PUBLIC_PLAY_PRODUCT_ID=premium_unlock`

## Play Console

1. Enroll in Billing Choice (India).
2. Create managed product **`premium_unlock`** (one-time).
3. Configure RTDN Pub/Sub → `POST /v1/webhooks/google-play?token=...`

See [DEPLOY.md](../DEPLOY.md) §6 for full setup.

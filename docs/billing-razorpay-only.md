# Razorpay + Google Play User Choice (monthly / annual)

## Modes

| Mode | App flag | Backend flag | Behavior |
|------|----------|--------------|----------|
| **Play User Choice (production)** | `EXPO_PUBLIC_BILLING_RAZORPAY_TEST_BYPASS=false` | `BILLING_RAZORPAY_TEST_BYPASS=false` | Google choice sheet → Play Billing **or** Razorpay |
| **Razorpay-direct (sideloaded APK)** | `…_TEST_BYPASS=true` | `…_TEST_BYPASS=true` | Payment Link only (no Play sheet) |

`eas.json` **production** uses bypass `false`. **prototype** / **preview** keep bypass `true` so sideloaded APKs can still charge via Razorpay.

## Prices (INR)

| Plan | Amount | Paise env | Play product ID |
|------|--------|-----------|-----------------|
| Monthly | ₹149 | `RAZORPAY_AMOUNT_MONTHLY_PAISE=14900` | `premium_monthly` |
| Annual | ₹349 | `RAZORPAY_AMOUNT_ANNUAL_PAISE=34900` | `premium_annual` |

Play Console base-plan prices for those SKUs should match.

## Production flow (User Choice)

1. User picks monthly/yearly → **Unlock Premium**.
2. Google User Choice dialog.
3. **Google Play:** native purchase → `POST /v1/billing/google-play/verify-purchase` → premium.
4. **Alternative (Razorpay):** Payment Link → webhook/confirm → ExternalTransactions report → premium.

## Env checklist — production Play billing

**Frontend (EAS production):** product IDs + `EXPO_PUBLIC_BILLING_RAZORPAY_TEST_BYPASS=false` (already in `eas.json`).

**Backend (Railway):**

- `BILLING_RAZORPAY_ENABLED=true`, `BILLING_RAZORPAY_ANDROID_ENABLED=true`
- `BILLING_RAZORPAY_TEST_BYPASS=false` (require User Choice token for Razorpay)
- `RAZORPAY_*` + monthly/annual paise amounts
- `PLAY_PACKAGE_NAME=com.agastya.app`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` (Android Publisher API)
- `GOOGLE_PLAY_RTDN_VERIFICATION_TOKEN` + Pub/Sub → webhook

**Play Console:** User Choice Billing (India) enrolled; subscriptions `premium_monthly` / `premium_annual` live; license testers for Closed Testing.

See [DEPLOY.md](../DEPLOY.md) §6.

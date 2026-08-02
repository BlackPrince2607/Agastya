# Railway Option B — Razorpay live E2E checklist

App already uses: `https://agastya-production-b395.up.railway.app`

## 1. Deploy this branch’s backend to Railway

Railway must run the **feature/razorpay-only** (or merged) backend that has:

- `POST /v1/billing/razorpay/create-payment-link`
- `BILLING_RAZORPAY_TEST_BYPASS` support
- Fixed `agastya://` return-URL allowlist

If Railway is still on old `main`, checkout/paywall will fail even with correct keys.

## 2. Set these variables in Railway Dashboard → Variables

Copy values from local `backend/.env` (do not commit them):

```
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
# RAZORPAY_AMOUNT_PREMIUM_PAISE=499900
# (legacy test amounts still work as fallback)
# RAZORPAY_AMOUNT_MONTHLY_PAISE=100
# RAZORPAY_AMOUNT_ANNUAL_PAISE=200
RAZORPAY_AMOUNT_ANNUAL_PAISE=200
BILLING_RAZORPAY_ENABLED=true
BILLING_RAZORPAY_ANDROID_ENABLED=true
BILLING_RAZORPAY_COUNTRIES=IN
BILLING_FORCE_COUNTRY=IN
BILLING_RAZORPAY_TEST_BYPASS=true
CHECKOUT_ALLOWED_RETURN_ORIGINS=agastya://,exp://,https://agastya.app
# Optional but recommended on Railway so Razorpay callbacks are always HTTPS:
PUBLIC_API_BASE_URL=https://agastya-production-b395.up.railway.app
PLAY_PACKAGE_NAME=com.agastya.app
```

Checkout requires a signed-in Supabase user (`supabaseUserId` on the session). After payment, the app confirms via `POST /v1/billing/razorpay/confirm-payment` (does not wait only on webhooks) and enters the main app when already signed in.

For Expo Go / no Play User Choice during this first live ₹1 test, also temporarily set:

```
DEBUG=true
```

(`BILLING_RAZORPAY_TEST_BYPASS` only works when `DEBUG=true`.)

After validation, set `DEBUG=false` and `BILLING_RAZORPAY_TEST_BYPASS=false` again.

Redeploy after changing variables (Railway usually redeploys automatically).

## 3. Razorpay Live webhook

1. Dashboard → toggle **Live Mode** ON  
2. Account & Settings → Webhooks → Add  
3. URL:

```
https://agastya-production-b395.up.railway.app/v1/webhooks/razorpay
```

4. Events: `payment.captured`, `payment_link.paid`, `payment_link.expired`, `refund.processed`, `payment.dispute.created`, `payment.dispute.won`  
5. Copy signing secret → Railway `RAZORPAY_WEBHOOK_SECRET` (must match)

## 4. App (already OK for Option B)

Root `.env`:

```
EXPO_PUBLIC_AGASTYA_API_URL=https://agastya-production-b395.up.railway.app
EXPO_PUBLIC_BILLING_RAZORPAY_TEST_BYPASS=true
```

Restart Expo: `npx expo start -c`

## 5. Smoke checks after Railway redeploy

```powershell
curl https://agastya-production-b395.up.railway.app/v1/health
curl "https://agastya-production-b395.up.railway.app/v1/billing/config?platform=android"
```

Config JSON should include `"id":"razorpay"` with `"enabled":true`.

## 6. Paywall E2E (₹1 live charge)

1. Open app → paywall → Unlock Premium  
2. Razorpay hosted page opens  
3. Pay ₹1 with real UPI/card  
4. Webhook sets `is_premium`  
5. App returns / polls → report + chat unlock  

Refund the ₹1 in Razorpay Dashboard if desired.

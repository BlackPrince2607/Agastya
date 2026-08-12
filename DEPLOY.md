# Agastya — Production Deploy Checklist

All code changes from the SaaS readiness pass are in place. This document covers the manual steps you need to complete before the app is live.

---

## 1. App icons

Icons live in `assets/images/` (`icon.png`, `splash-icon.png`, `adaptive-icon.png`, `favicon.png`), generated from `screen.png` via `scripts/generate_app_icons.py`. Re-run that script after replacing the source logo.

---

## 2. EAS Project Setup

```bash
# Login to Expo account
npx eas-cli login

# Register the project (generates projectId)
npx eas-cli project:init

# Replace the placeholder in app.json:
# "projectId": "REPLACE_WITH_EAS_PROJECT_ID"
# with the ID printed by eas project:init

# Configure credentials (Apple + Google signing)
npx eas-cli credentials
```

---

## 3. Fill in Environment Variables

### Frontend (`env.example` → `.env`)
```bash
cp env.example .env
```
Fill in:
- `EXPO_PUBLIC_AGASTYA_API_URL` — your deployed backend URL (e.g. `https://api.agastya.app`)
- `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` — from Supabase Dashboard → Project Settings → API
- `EXPO_PUBLIC_PLAY_PRODUCT_MONTHLY` / `EXPO_PUBLIC_PLAY_PRODUCT_ANNUAL` — Play subscription SKUs (`premium_monthly` / `premium_annual`)
- `EXPO_PUBLIC_SENTRY_DSN` — from Sentry → React Native project → Client Keys
- `EXPO_PUBLIC_MIXPANEL_TOKEN` — optional analytics provider
- `EXPO_PUBLIC_FACEBOOK_APP_ID` + `EXPO_PUBLIC_FACEBOOK_CLIENT_TOKEN` — Meta App Events (ads measurement). Set the same on EAS Environment Variables. Requires a **new EAS native build** (not Expo Go). After install, confirm ActivateApp + funnel events in Meta Events Manager → Test Events.

### Backend (`backend/.env.example` → `backend/.env`)
```bash
cp backend/.env.example backend/.env
```
Fill in:
- `OPENROUTER_API_KEY` — from [openrouter.ai/keys](https://openrouter.ai/keys)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — from Supabase (user JWTs verified via JWKS)
- `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` — Razorpay billing (see §6)
- `SENTRY_DSN` — from Sentry → Python project → Client Keys

---

## 4. Apply Supabase Database Migrations

```bash
# Link to your Supabase project
npx supabase link --project-ref YOUR_PROJECT_REF

# Apply all pending migrations
npx supabase db push
```

Migrations to apply (in order):
1. `supabase/migrations/20260518120000_agastya_sessions.sql`
2. `supabase/migrations/20260520120000_agastya_palms_mime_expand.sql`
3. `supabase/migrations/20260606120000_agastya_predictions.sql`
4. `supabase/migrations/20260606130000_agastya_premium.sql` — `is_premium` column
5. `supabase/migrations/20260716010000_agastya_life_context.sql` — `user_memory`, `daily_context`
6. `supabase/migrations/20260716020000_agastya_weekly_context.sql` — `weekly_context`
7. `supabase/migrations/20260716030000_agastya_sessions_revoke_client_update.sql` — revoke client UPDATE (premium lock)

You can also run them directly in the Supabase SQL editor.

**RLS smoke check (after migration 7):** with the anon key + a user access token, `PATCH /rest/v1/agastya_sessions?supabase_user_id=eq.<uid>` setting `{"is_premium": true}` must fail (permission denied / RLS). Writes are service-role only.

---

## 5. Supabase Auth Configuration

### Client env (`.env` in repo root)

```env
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
# Optional: EXPO_PUBLIC_EMAIL_SIGNIN=false hides magic-link option (email/password stays on)
EXPO_PUBLIC_BYPASS_AUTH=false
```

Restart Metro with cache clear: `npx expo start -c`.

### Backend env (`backend/.env`)

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

User access tokens are verified via JWKS at `{SUPABASE_URL}/auth/v1/.well-known/jwks.json` (ES256 signing keys). Ensure `SUPABASE_URL` matches your project; the backend must be able to reach that JWKS endpoint.

### Supabase Dashboard → Authentication → URL Configuration

Add to **Redirect URLs**:

- `agastya://**` — standalone / dev builds
- `http://**` — Expo Go OAuth via Metro (`http://<lan>:8081/auth/callback`)
- `exp://**` — Expo Go deep links / magic links
- `https://agastya.app/**` — web / universal links

### Google OAuth

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → Create OAuth client ID → **Web application**.
2. Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
3. Copy Client ID + Secret into Supabase → Authentication → Providers → **Google** → Enable.

### Apple OAuth

Configure Sign in with Apple in Apple Developer and add credentials to Supabase → Providers → Apple.

### Email provider (magic link + password)

1. Supabase → Authentication → Providers → **Email** → Enable.
2. Enable **Email signups**.
3. **Confirm email**: recommended ON for password sign-up; magic links still work.
4. **Custom SMTP** (Resend, SendGrid, etc.) — required for reliable delivery; free-tier Supabase email limits are very low.
5. Email sign-in is on when Supabase env vars are set. Set `EXPO_PUBLIC_EMAIL_SIGNIN=false` only to hide the magic-link option.

Password reset links use the same redirect URI and land on `/auth/reset-password`.

### Auth QA checklist

Test with `EXPO_PUBLIC_BYPASS_AUTH=false`:

| Flow | Platform | Expected |
|------|----------|----------|
| Google OAuth | iOS, Android, Web | Browser closes → signed in → merge → cloud restore → correct resume route |
| Apple OAuth | iOS | Same as Google |
| Magic link email | All | Email link → `/auth/callback` → session + merge |
| Password sign-in | All | Email + password → merge → enter app |
| Password sign-up | All | Create account → confirm email if enabled → sign in → merge |
| Forgot password | All | Reset email → `/auth/reset-password` → set password → merge |
| Skip account | Onboarding | Ritual continues anonymously |
| Sign in from Profile | Main app | Opens account screen; merge preserves reading |
| Sign out | Profile | Clears Supabase; local ritual data kept |
| Reinstall + sign in | Native | Cloud reading + premium restored from server bootstrap |
| Merge failure | All | Sign-in OK but sync notice if backend JWT secret wrong |

### Auth routing (anonymous-first)

Login is **optional** — users complete the ritual without signing in.

| Entry point | Route |
|-------------|-------|
| Welcome “Sign in” | `/onboarding/account` (or resume if already signed in) |
| Onboarding account step | `/onboarding/account` |
| Profile → Sign in | `/onboarding/account` |
| Paywall → Save & sign in | `/onboarding/account` |

| Gate | Checks | Does not require login |
|------|--------|------------------------|
| Main tabs `/(main)/*` | `hasEnteredMain` (finished onboarding) | Supabase session |
| Premium features | Server `isPremium` + client store | Login |
| Cloud sync | Supabase sign-in + merge API | Anonymous ritual works offline |

**Public before login:** `/welcome`, `/onboarding/*`, `/report`, `/task/[id]`. **Requires ritual progress:** main app tabs.

---

## 6. Billing — Razorpay + Google Play User Choice (Android India)

This branch uses **Razorpay-only** alternative billing with **direct Google Play** for the Play-choice path. RevenueCat and Stripe are removed.

### Architecture

1. Paywall → **Unlock Premium** → Google User Choice dialog.
2. **Alternative billing:** `POST /v1/billing/razorpay/create-payment-link` → Razorpay hosted page → webhook → `is_premium=true` → ExternalTransactions report.
3. **Google Play:** native purchase → `POST /v1/billing/google-play/verify-purchase` → RTDN webhook for lifecycle.

See [`docs/billing-razorpay-only.md`](docs/billing-razorpay-only.md).

### Play Console (required)

1. Enroll in **Billing Choice / User Choice Billing — India**.
2. Create **subscription** products `premium_monthly` (₹149) and `premium_annual` (₹349) matching `EXPO_PUBLIC_PLAY_PRODUCT_*`.
3. Configure **Real-Time Developer Notifications** (Pub/Sub) → `POST https://YOUR-API/v1/webhooks/google-play?token=YOUR_RTDN_TOKEN` (subscriptions + voided purchases).
4. Service account with Android Publisher API access → `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`.
5. Add license testers for Closed Testing.

### Backend env

| Variable | Purpose |
|----------|---------|
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Razorpay Payment Links + webhooks |
| `RAZORPAY_AMOUNT_MONTHLY_PAISE`, `RAZORPAY_AMOUNT_ANNUAL_PAISE` | Alt-billing INR (14900 / 34900) |
| `BILLING_RAZORPAY_ENABLED`, `BILLING_RAZORPAY_ANDROID_ENABLED` | Feature flags |
| `BILLING_RAZORPAY_TEST_BYPASS` | `false` for User Choice; `true` only for sideloaded Razorpay-direct |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `PLAY_PACKAGE_NAME` | Play verify + ExternalTransactions |
| `GOOGLE_PLAY_RTDN_VERIFICATION_TOKEN` | RTDN webhook auth |
| `CHECKOUT_ALLOWED_RETURN_ORIGINS` | Include `agastya://` for deep links |

Webhooks:
- Razorpay: `https://api.agastya.app/v1/webhooks/razorpay` — `payment.captured`, `payment_link.paid`, refunds
- Google Play RTDN: `https://api.agastya.app/v1/webhooks/google-play?token=...`

### Monitoring

- Razorpay webhook 401s / grant failures in logs / Sentry
- Play report pending: `python -m scripts.retry_play_reports` (cron)
- Unlock pending rate (paywall "Check premium status" after checkout)

### Closed Testing submit

```bash
npx eas-cli build --platform android --profile production
npx eas-cli submit --platform android --profile closed-testing --latest
```

`eas.json` submit profile `closed-testing` uses track `internal` (upload AAB for Closed/Internal testing — not production). Place the Play service account JSON at `./google-play-key.json` (gitignored).

---

## 7. Deploy Backend

### Option A: Fly.io
```bash
# Install flyctl: https://fly.io/docs/hands-on/install-flyctl/
fly auth login
fly launch --no-deploy --config fly.toml
fly secrets set \
  OPENROUTER_API_KEY=sk-or-v1-... \
  SUPABASE_URL=https://xxx.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=ey... \
  RAZORPAY_WEBHOOK_SECRET=... \
  GOOGLE_PLAY_RTDN_VERIFICATION_TOKEN=... \
  SENTRY_DSN=https://... \
  DEBUG=false \
  CORS_ORIGINS=https://agastya.app
fly deploy --config fly.toml
```

### Option B: Railway

**Via GitHub (recommended)**

1. Push repo to GitHub
2. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** → select this repo
3. Railway uses `railway.toml` + `backend/Dockerfile` automatically
4. Set variables from `railway.env.example` in **Railway Dashboard → Variables**
5. **Settings → Networking → Generate Domain** → copy the public HTTPS URL
6. Verify: `curl https://YOUR-APP.up.railway.app/v1/health`
7. Set `EXPO_PUBLIC_AGASTYA_API_URL` to that URL for the APK build

Pushes to `main` that touch `backend/**` auto-redeploy.

**Via GitHub Actions** (alternative): add `RAILWAY_TOKEN` to GitHub Secrets; `.github/workflows/backend-deploy.yml` deploys on push.

**Via CLI:** `railway login && railway init && npm run deploy:railway`

Required Railway variables: `OPENROUTER_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DEBUG=false`, `PALM_ANALYSIS_MODE=vision`, `RAZORPAY_*` (when billing enabled), non-wildcard `CORS_ORIGINS`. Recommended: `REDIS_URL`, `SENTRY_DSN`, `CRON_SECRET`, `NOTIFICATIONS_ENABLED=true`.

**Palm scan (reliability path):** the app captures once, shows staged analysis progress, then builds the Life Blueprint. Line overlays are not required. Redeploy Railway after backend palm-pipeline changes; confirm `OPENROUTER_API_KEY` and `PALM_ANALYSIS_MODE=vision`. Without the key, analyze returns **503**.

**Push notifications (Expo Push):** apply migration `supabase/migrations/20260805120000_agastya_push_tokens.sql`. Remote pushes require a **native EAS build** (not Expo Go). Register tokens via `POST /v1/notifications/register-token`. For re-engagement cron, schedule an hourly HTTP call:

```bash
curl -X POST "https://YOUR-API/v1/notifications/cron/dispatch" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Set `CRON_SECRET` and keep `NOTIFICATIONS_ENABLED=true` (or `false` as a kill switch). Event catalog: reading ready, full report ready, premium unlocked, payment pending, compatibility ready, onboarding incomplete, unsigned preview, streak at risk, weekly guidance, re-engage 3/7/14d. Daily tasks + evening reflection remain **local** scheduled notifications.

**Production must run with `DEBUG=false`.** When `DEBUG=true`, webhook signature checks and startup secret validation are skipped — never ship beta that way.

**Proxy / rate limits:** set `X-Real-IP` (or equivalent) on the reverse proxy so clients cannot spoof `X-Forwarded-For` alone.

### Post-deploy smoke

| Check | Expected |
|-------|----------|
| `GET /v1/health` | 200 |
| Anonymous `GET /v1/sessions/bootstrap` with matching `deviceInstallId` | Profile + slim guidance only; **no** palm/reports/`chatTail` |
| Authenticated bootstrap (Bearer JWT) | Full reading when linked |
| `PATCH` own `agastya_sessions` with anon key + user JWT setting `is_premium` | Denied |
| Purchase / restore → main | Server `isPremium` and full report present |

If deploy crashes on startup, open **Deploy Logs** — missing `OPENROUTER_API_KEY` or Supabase keys is the usual cause.

---

## 8. Universal Links (Apple App Site Association)

Once your domain is live, host this file at `https://agastya.app/.well-known/apple-app-site-association`:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "APPLE_TEAM_ID.com.agastya.app",
        "paths": ["/*"]
      }
    ]
  },
  "webcredentials": {
    "apps": ["APPLE_TEAM_ID.com.agastya.app"]
  }
}
```

And for Android App Links at `https://agastya.app/.well-known/assetlinks.json`:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.agastya.app",
    "sha256_cert_fingerprints": ["YOUR_PLAY_APP_SIGNING_CERT_SHA256", "YOUR_UPLOAD_CERT_SHA256"]
  }
}]
```

**Important:** `package_name` must be exactly `com.agastya.app` (not `com.app.agastya`). Fingerprints come from Play Console → App integrity → App signing. Custom scheme `agastya://` works for auth/Razorpay return without verified App Links. Legal pages live on **sharvo.online**, not on this host.

---

## 9. Legal Pages

Deploy the static site in `legal/` to **sharvo.online** (see `legal/README.md`):

- `legal/privacy.html` → `https://sharvo.online/privacy`
- `legal/terms.html` → `https://sharvo.online/terms`
- `legal/support.html` → `https://sharvo.online/support`
- `legal/delete-account.html` → `https://sharvo.online/delete-account`

Play Console account deletion URL: `https://sharvo.online/delete-account`. Data Safety answers: `docs/play-console-data-safety.md`.

---

## 10. GitHub Actions Secrets

Add these secrets in GitHub → Settings → Secrets → Actions:

| Secret | Value |
|---|---|
| `EXPO_TOKEN` | From expo.dev → Account Settings → Access Tokens |
| `EXPO_PUBLIC_AGASTYA_API_URL` | Your deployed backend URL |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `EXPO_PUBLIC_PLAY_PRODUCT_MONTHLY` / `_ANNUAL` | Play SKUs (`premium_monthly` / `premium_annual`) |
| `EXPO_PUBLIC_SENTRY_DSN` | Sentry client DSN |
| `EXPO_PUBLIC_FACEBOOK_APP_ID` | Meta Developers → App ID (optional; ads measurement) |
| `EXPO_PUBLIC_FACEBOOK_CLIENT_TOKEN` | Meta Developers → Client Token |
| `RAILWAY_TOKEN` | Railway → Account Settings → Tokens (only if using GitHub Actions deploy; not needed for Railway native GitHub integration) |
| `FLY_API_TOKEN` | Optional — only if using Fly.io instead of Railway |

---

## 11. First Build

```bash
# Development build (for testing on device with Expo Go replacement)
npx eas-cli build --platform all --profile development

# Production build + submit to stores
npx eas-cli build --platform all --profile production
npx eas-cli submit --platform all --profile production
```

**Meta App Events:** after an EAS build with Facebook App ID + Client Token set, open the app on a test device and check [Events Manager → Test Events](https://www.facebook.com/events_manager2) for ActivateApp and funnel events (registration, paywall, checkout, purchase). Expo Go will not emit Meta events.

---

## 0. Install dependencies (do this first)

New packages were added to `package.json`. Install them before building:

```bash
cd D:/Agastya
npm install
# or for exact Expo SDK 54 compat versions:
npx expo install expo-notifications expo-updates @sentry/react-native
```

---

## Post-launch

- Monitor crashes in Sentry
- Monitor events in Mixpanel (and Firebase Analytics via native setup)
- Monitor Razorpay webhooks and Google Play RTDN in backend logs / Sentry
- Set up Fly.io or Railway auto-scaling as user base grows

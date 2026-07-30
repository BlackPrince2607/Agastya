# Agastya — Prototype APK (share with testers)

Installable `.apk` for Android (WhatsApp / Drive / email). No Play Store required.

## Prerequisites (already set in this repo)

| Item | Status |
|------|--------|
| Expo account | Logged in as `anish26` / team `anish26s-team` |
| EAS project ID | `e734e717-48c7-49ec-8e5a-8810cfed0fa4` in `app.json` |
| Icons / splash | `assets/images/*` |
| API URL | Railway in `eas.json` + EAS preview env |
| Supabase | EAS **preview** env has `EXPO_PUBLIC_SUPABASE_URL` + `ANON_KEY` |

## Build command

```powershell
cd D:\Agastya
npm run build:apk
```

Uses profile **`prototype`** → Android **APK**, internal distribution, API → Railway.

- First build: let EAS generate the Android keystore.
- ~10–20 min in the cloud → download from [expo.dev](https://expo.dev) → Builds.

Local APK (needs Android SDK):

```powershell
npm run build:apk:local
```

## What the APK includes

- Palm scan, preview, chat, home (API + Supabase)
- Sign-in via `agastya://` deep links
- Billing: Razorpay + Play User Choice module  
  - **Sideloaded prototype/preview APK:** `EXPO_PUBLIC_BILLING_RAZORPAY_TEST_BYPASS=true` is baked in → Razorpay opens directly (sign in first)  
  - **Play-enrolled / production:** full User Choice → Razorpay or Play Billing  
  - Railway must keep `DEBUG=true` + `BILLING_RAZORPAY_TEST_BYPASS=true` while testing this path

## Before you build (checklist)

1. Railway API healthy: `curl https://agastya-production-b395.up.railway.app/v1/health`
2. Supabase → Auth → Redirect URLs include:
   - `agastya://**`
   - `agastya://auth/callback`
3. Railway `CHECKOUT_ALLOWED_RETURN_ORIGINS` includes `agastya://`
4. EAS preview env (already present):
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_AGASTYA_API_URL`

Optional extras on expo.dev → Environment variables → **preview**:

```text
EXPO_PUBLIC_SENTRY_DSN=...
EXPO_PUBLIC_POSTHOG_KEY=...
EXPO_PUBLIC_PREMIUM_EMAIL_ALLOWLIST=sohambhalotia@gmail.com
```

## Share with testers

1. Send the `.apk`
2. Enable **Install unknown apps** for the browser/Files app
3. Install and open

Grant premium for a tester without Play billing: Supabase `agastya_sessions.is_premium = true` for their session/user, or add their email to `EXPO_PUBLIC_PREMIUM_EMAIL_ALLOWLIST` / backend `PREMIUM_EMAIL_ALLOWLIST`.

## Quick commands

| Command | Purpose |
|---------|---------|
| `npm run doctor` | Expo health check |
| `npm run export:android` | JS bundle sanity check (no APK) |
| `npm run build:apk` | Cloud APK |
| `npm run build:apk:local` | Local APK |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| API fails on phone | Must be HTTPS Railway URL, not localhost |
| Sign-in redirect fails | Add `agastya://**` to Supabase redirect URLs |
| Sentry upload fails build | `SENTRY_DISABLE_AUTO_UPLOAD=true` already in prototype profile |
| Paywall “billing not available” | Rebuild prototype APK after enabling `EXPO_PUBLIC_BILLING_RAZORPAY_TEST_BYPASS=true` in `eas.json`, or use Expo Go with that flag in `.env` |
| Install blocked | Enable unknown sources |

## Play Store later

```powershell
npx eas-cli build --platform android --profile production
```

Produces an **AAB** for Play Console (see `DEPLOY.md`).

# Agastya — Production Deploy Checklist

All code changes from the SaaS readiness pass are in place. This document covers the manual steps you need to complete before the app is live.

---

## 1. Copy App Icons (generated, need to move)

The branded icons were generated and are at:
```
C:\Users\user\.cursor\projects\d-Agastya\assets\icon.png         → assets/images/icon.png
C:\Users\user\.cursor\projects\d-Agastya\assets\splash-icon.png  → assets/images/splash-icon.png
C:\Users\user\.cursor\projects\d-Agastya\assets\adaptive-icon.png → assets/images/adaptive-icon.png
C:\Users\user\.cursor\projects\d-Agastya\assets\notification-icon.png → assets/images/notification-icon.png
```

Copy them into your repo's `assets/images/` folder. If you want custom icons instead, replace with 1024×1024 PNGs.

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
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` and `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` — from RevenueCat Dashboard
- `EXPO_PUBLIC_SENTRY_DSN` — from Sentry → React Native project → Client Keys
- `EXPO_PUBLIC_POSTHOG_KEY` or `EXPO_PUBLIC_MIXPANEL_TOKEN` — from your analytics provider

### Backend (`backend/.env.example` → `backend/.env`)
```bash
cp backend/.env.example backend/.env
```
Fill in:
- `GROQ_API_KEY` — from console.groq.com
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` — from Supabase
- `REVENUECAT_WEBHOOK_SECRET` — from RevenueCat → Integrations → Webhooks → Authorization header value
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
4. `supabase/migrations/20260606130000_agastya_premium.sql` ← new: `is_premium` column

You can also run them directly in the Supabase SQL editor.

---

## 5. Supabase Auth Configuration

In Supabase Dashboard → Authentication → URL Configuration:
- Add to **Redirect URLs**: `agastya://**`
- Add to **Redirect URLs**: `https://agastya.app/**` (for universal links)

For Google OAuth: create an OAuth app in Google Cloud Console and add the Client ID/Secret to Supabase Auth → Providers → Google.

For Apple OAuth: configure Sign in with Apple in your Apple Developer account and add to Supabase Auth → Providers → Apple.

---

## 6. RevenueCat Setup

1. Create two apps in RevenueCat Dashboard (iOS + Android)
2. Create an entitlement named `premium`
3. Create monthly ($9.99) and annual ($59.99) products in App Store Connect and Google Play Console, then map them to offerings in RevenueCat
4. Under **Integrations → Webhooks**, add your backend URL: `https://api.agastya.app/v1/webhooks/revenuecat`
   - Set the Authorization header to a secret string, then set `REVENUECAT_WEBHOOK_SECRET` in your backend `.env`

---

## 7. Deploy Backend

### Option A: Fly.io
```bash
# Install flyctl: https://fly.io/docs/hands-on/install-flyctl/
fly auth login
fly launch --no-deploy --config fly.toml
fly secrets set \
  GROQ_API_KEY=sk-... \
  SUPABASE_URL=https://xxx.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=ey... \
  SUPABASE_JWT_SECRET=... \
  REVENUECAT_WEBHOOK_SECRET=... \
  SENTRY_DSN=https://... \
  DEBUG=false \
  CORS_ORIGINS=https://agastya.app
fly deploy --config fly.toml
```

### Option B: Railway
```bash
# Install Railway CLI: https://railway.app/
railway login
railway up
# Set env vars in Railway Dashboard → Variables
```

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
    "sha256_cert_fingerprints": ["YOUR_SIGNING_CERT_SHA256"]
  }
}]
```

---

## 9. Legal Pages

Deploy the HTML files in `legal/` to your domain:
- `legal/terms.html` → `https://agastya.app/terms`
- `legal/privacy.html` → `https://agastya.app/privacy`

---

## 10. GitHub Actions Secrets

Add these secrets in GitHub → Settings → Secrets → Actions:

| Secret | Value |
|---|---|
| `EXPO_TOKEN` | From expo.dev → Account Settings → Access Tokens |
| `EXPO_PUBLIC_AGASTYA_API_URL` | Your deployed backend URL |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | RevenueCat iOS key |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` | RevenueCat Android key |
| `EXPO_PUBLIC_SENTRY_DSN` | Sentry client DSN |
| `EXPO_PUBLIC_POSTHOG_KEY` | PostHog key (optional) |
| `FLY_API_TOKEN` | From fly.io → Account → Access Tokens (for backend deploy) |

---

## 11. First Build

```bash
# Development build (for testing on device with Expo Go replacement)
npx eas-cli build --platform all --profile development

# Production build + submit to stores
npx eas-cli build --platform all --profile production
npx eas-cli submit --platform all --profile production
```

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
- Monitor events in PostHog / Mixpanel
- Monitor subscription events in RevenueCat Dashboard
- Set up Fly.io or Railway auto-scaling as user base grows

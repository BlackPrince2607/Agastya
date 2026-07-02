# Agastya — Prototype APK (share with testers)

Use this guide to build an **installable `.apk`** you can send to Android phones (WhatsApp, Drive, email). No Play Store required.

---

## What you need

| Item | Status in your repo | Action |
|------|---------------------|--------|
| Expo account (free) | Not logged in yet | `npx eas-cli login` |
| EAS project ID | Placeholder in `app.json` | `npx eas-cli project:init` |
| App icons | Present in `assets/images/` | None |
| JS bundle builds | Verified (`expo export --platform android`) | None |
| **Public API URL** | `.env` still points at local/LAN | Deploy backend (step 2) |
| Supabase | Set in `.env` | Add redirect URL `agastya://**` |
| RevenueCat | Empty | Optional for prototype |

---

## Step 1 — One-time EAS setup

```powershell
cd D:\Agastya
npx eas-cli login
npx eas-cli project:init
```

`project:init` prints a **project ID**. Put it in `app.json`:

```json
"extra": {
  "eas": {
    "projectId": "YOUR-UUID-HERE"
  }
}
```

Also update `updates.url` in `app.json` to `https://u.expo.dev/YOUR-UUID-HERE` (same ID).

---

## Step 2 — Deploy the backend (required)

APK builds bake in `EXPO_PUBLIC_AGASTYA_API_URL`. Testers’ phones **cannot** reach `localhost` or your PC’s LAN IP.

### Option A: Railway via GitHub (recommended)

1. Push this repo to GitHub (if not already)
2. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
3. Set variables from `railway.env.example` in Railway Dashboard → **Variables**
4. **Settings → Networking → Generate Domain**
5. Verify: `curl https://YOUR-APP.up.railway.app/v1/health`

Use that URL as `EXPO_PUBLIC_AGASTYA_API_URL` in EAS secrets.

### Option B: Fly.io

```powershell
fly auth login
fly launch --no-deploy --config fly.toml
fly secrets set GROQ_API_KEY=sk-... SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=eyJ... DEBUG=false CORS_ORIGINS=https://agastya.app
fly deploy --config fly.toml
```

Note the URL (e.g. `https://agastya-api.fly.dev`). Verify:

```powershell
curl https://YOUR-API/v1/health
```

Apply Supabase migrations (`npx supabase db push` or SQL editor) — see `DEPLOY.md` §4.

---

## Step 3 — Configure build environment variables

EAS cloud builds **do not** read your local `.env`. Set secrets once:

```powershell
npx eas-cli secret:create --scope project --name EXPO_PUBLIC_AGASTYA_API_URL --value https://YOUR-API.fly.dev
npx eas-cli secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value https://YOUR-PROJECT.supabase.co
npx eas-cli secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value YOUR_ANON_KEY
```

Optional (prototype can skip):

```powershell
npx eas-cli secret:create --scope project --name EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY --value ...
npx eas-cli secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value ...
```

See `env.prototype.example` for the full list.

### Supabase auth for the APK

Supabase Dashboard → **Authentication → URL configuration → Redirect URLs**, add:

- `agastya://**`
- `agastya://auth/callback`

---

## Step 4 — Build the APK

```powershell
cd D:\Agastya
npm run build:apk
```

This runs `eas build --platform android --profile prototype` (APK, internal distribution).

- First build: EAS may ask to generate an Android keystore — choose **Let EAS handle it**.
- Build runs in the cloud (~10–20 min). Watch progress at [expo.dev](https://expo.dev) or in the terminal.

When finished, download the `.apk` from the Expo dashboard **Builds** page.

---

## Step 5 — Share with testers

1. Send the `.apk` file (Drive, Telegram, email, etc.).
2. Testers enable **Install from unknown sources** for that app/browser.
3. Open the APK and install.

**Prototype limitations without RevenueCat:** onboarding, palm scan, chat, and free-tier features work; in-app purchase / premium unlock will not until you add `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`.

To grant premium manually for demos, set `is_premium = true` on the user’s row in Supabase (`agastya_sessions`).

---

## Quick commands

| Command | Purpose |
|---------|---------|
| `npm run doctor` | Expo health check |
| `npm run export:android` | Local JS bundle sanity check (no APK) |
| `npm run build:apk` | Cloud APK for testers |
| `npm run build:apk:local` | Build APK on your PC (needs Android SDK) |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| API calls fail on phone | `EXPO_PUBLIC_AGASTYA_API_URL` must be HTTPS public URL, not localhost |
| Sign-in redirect fails | Add `agastya://**` to Supabase redirect URLs |
| Build fails on Sentry plugin | Set `EXPO_PUBLIC_SENTRY_DSN` secret or remove Sentry plugin from `app.json` for prototype |
| `REPLACE_WITH_EAS_PROJECT_ID` | Run `eas project:init` and update `app.json` |
| Install blocked | Enable unknown sources; some corporate phones block sideloading |

---

## After the prototype

For Play Store release, switch to the `production` profile (AAB format) and complete `DEPLOY.md` (RevenueCat, legal pages, store listings).

```powershell
npx eas-cli build --platform android --profile production
```

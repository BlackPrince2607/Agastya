# Agastya

**AI palm reading & daily guidance** — Expo (React Native) app for iOS, Android, and web, backed by a FastAPI API.

Users complete a guided onboarding ritual (profile, goals, palm scan, analysis, report preview), then use the main app for chat with an AI guide, palm reports, daily rituals, and optional premium features.

---

## Tech stack

| Layer | Stack |
|-------|--------|
| **Mobile / web** | Expo SDK 54, React Native, Expo Router, NativeWind, Zustand |
| **Backend** | FastAPI, OpenRouter (vision + chat), Supabase (auth, DB, storage) |
| **Billing** | RevenueCat (iOS/Android), Stripe (web) |
| **Observability** | Sentry, PostHog / Mixpanel (optional) |

---

## Prerequisites

- **Node.js** 18+
- **Python** 3.11+ (for the API)
- **Expo Go** or a dev build (for device testing)
- Accounts (as needed): [OpenRouter](https://openrouter.ai), [Supabase](https://supabase.com), [Expo](https://expo.dev)

---

## Quick start (local dev)

### 1. Install dependencies

```powershell
cd D:\Agastya
npm install
```

### 2. Configure environment

```powershell
copy env.example .env
copy backend\.env.example backend\.env
```

Fill in at minimum:

- **Frontend** (`.env`): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- **Backend** (`backend/.env`): `OPENROUTER_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

See `env.example` and `backend/.env.example` for the full list.

### 3. Apply database migrations

```powershell
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Or run the SQL files in `supabase/migrations/` from the Supabase SQL editor.

### 4. Run the API

```powershell
npm run api
```

API listens on `http://localhost:8000`. Health check: `GET /v1/health`.

On Windows, if a physical device cannot reach the API:

```powershell
npm run api:firewall
```

### 5. Run the app

```powershell
npm start
```

| Command | Use case |
|---------|----------|
| `npm run start:lan` | Phone on same Wi‑Fi (auto LAN API URL in dev) |
| `npm run start:tunnel` | Remote device / restrictive network |
| `npm run android` / `npm run ios` / `npm run web` | Platform-specific |

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Expo dev server |
| `npm run api` | FastAPI backend (reload on port 8000) |
| `npm run doctor` | Expo health check |
| `npm run export:android` | Local Android bundle sanity check |
| `npm run build:apk` | Cloud APK build (prototype profile) |
| `npm run build:web` | Export static web bundle |
| `npm run deploy:vercel` | Deploy web to Vercel |
| `npm run deploy:railway` | Deploy backend to Railway |

---

## Project structure

```
Agastya/
├── app/                  # Expo Router screens (onboarding, main tabs, auth, report)
├── components/           # UI primitives, layout, report cards, onboarding
├── services/             # API client, auth, Supabase, RevenueCat, analytics
├── hooks/                # Shared React hooks
├── constants/            # Theme, onboarding copy
├── utils/                # Navigation flow, local predictions, helpers
├── backend/              # FastAPI API (palm, chat, billing, webhooks)
│   ├── app/routes/       # HTTP endpoints
│   ├── app/services/     # Business logic (palm pipeline, OpenRouter, storage)
│   └── tests/            # pytest suite
├── supabase/migrations/  # Postgres schema
├── legal/                # Terms & privacy HTML
├── assets/images/        # App icon, splash, adaptive icon
├── DEPLOY.md             # Production deploy checklist
└── PROTOTYPE_APK.md      # Shareable Android APK guide
```

---

## Auth model

Login is **optional**. Users can complete the full onboarding ritual anonymously.

- **Anonymous**: local ritual data in `AsyncStorage`
- **Signed in**: Supabase OAuth (Google, Apple) or email/password; session merge syncs cloud data
- **Premium**: server `is_premium` flag + RevenueCat (mobile) or Stripe (web)

Redirect URLs for auth must include `agastya://**` (native) and your web origin. Details in `DEPLOY.md` §5.

---

## Building & sharing

| Goal | Guide |
|------|--------|
| **Prototype APK** (sideload to testers) | [PROTOTYPE_APK.md](./PROTOTYPE_APK.md) |
| **Production** (stores, billing, legal) | [DEPLOY.md](./DEPLOY.md) |
| **Store listings** | [store-assets/metadata.md](./store-assets/metadata.md) |

---

## Backend tests

```powershell
cd backend
pip install -r requirements.txt
pytest
```

---

## Disclaimer

Agastya is for entertainment and self-reflection. It is not medical, legal, or financial advice.

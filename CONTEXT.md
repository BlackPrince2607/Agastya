# Agastya App Context

Last updated: 2026-07-04

This document is a whole-app context map for developers and AI agents working in this repo. It complements `README.md` with runtime flow, key files, data contracts, and integration notes.

## Product Summary

Agastya is an Expo React Native app for iOS, Android, and web. Users complete a guided palm-reading onboarding ritual, receive a report preview, then enter the main app for an AI guide chat, reports, daily tasks, predictions, profile management, and premium unlocks.

The app is entertainment/self-reflection only. User-facing copy repeatedly clarifies that readings are not medical, legal, or financial advice.

## Stack

- Frontend: Expo SDK 54, React 19, React Native 0.81, Expo Router, NativeWind, Zustand.
- Backend: FastAPI, Pydantic, Uvicorn, optional OpenRouter inference, optional Supabase persistence/storage/auth, optional Redis rate limiting.
- Auth: Supabase client on the app, Supabase JWT verification on the backend.
- Billing: RevenueCat on native, Stripe Checkout on web, server-side premium flags.
- Observability: Sentry on frontend and backend, optional PostHog/Mixpanel analytics.

## Important Commands

- `npm start`: start Expo.
- `npm run start:lan`: start Expo for a physical phone on the same Wi-Fi.
- `npm run start:tunnel`: start Expo tunnel for JS bundle access.
- `npm run api`: run FastAPI from `backend/` on port `8000`.
- `npm run api:firewall`: Windows helper for exposing local API to a phone.
- `npm run doctor`: Expo health check.
- `npm run build:web`: Expo static web export.
- `npm run build:apk`: EAS Android prototype build.
- Backend tests: `cd backend && pytest`.

## Repository Map

- `app/`: Expo Router routes and screen groups.
- `components/`: reusable UI, layout, onboarding, report, chat, task, profile, and navigation components.
- `services/`: frontend integration layer for API calls, auth, Supabase, billing, analytics, Sentry, notifications, persistence, and session restore.
- `store/`: Zustand stores for session, chat, and tasks.
- `utils/`: navigation gates, router helpers, local task/report helpers, palm landmarks.
- `types/`: frontend DTO and view-model types.
- `constants/`: theme, layout, user copy, welcome/onboarding copy.
- `backend/app/`: FastAPI app, routes, services, schemas, middleware, auth utilities, prompts.
- `backend/tests/`: pytest coverage for auth, merge, webhooks, premium gates, rate limits, palm analysis, and account deletion.
- `supabase/migrations/`: `agastya_sessions` table, premium flag, predictions cache, and private palm storage bucket.
- `assets/`, `legal/`, `store-assets/`: images, policy pages, and store metadata.

## Frontend Runtime Flow

### Root Initialization

`app/_layout.tsx` is the app root. It:

- Loads Inter, Noto Serif, Space Grotesk, and FontAwesome fonts.
- Sets the dark cosmic navigation theme.
- Initializes Sentry and notification handling.
- Subscribes to auth deep links and Supabase session merge events.
- Bootstraps device/session identity and links RevenueCat to the session.
- Registers notification response handling for deep links.
- Defines the root stack: `index`, `welcome`, `auth/*`, `onboarding`, `(main)`, `report`, and `task/[id]`.

### Cold Start Gate

`app/index.tsx` waits for persisted Zustand hydration via `usePersistHydration()`, calls `prepareReturningUser()`, and redirects to the correct screen.

Routing depends on:

- Whether a local or restored palm reading exists.
- Whether Supabase is configured and therefore sign-in is required.
- Whether the user has already entered the main app.
- Whether a cloud restore should be awaited.

The central navigation policy lives in `utils/navigationFlow.ts`.

### Welcome and Onboarding

`app/welcome.tsx` is the public landing screen. It can start anonymous onboarding or route to sign-in.

Onboarding screens are under `app/onboarding/`:

- `index.tsx`: trust / intro step.
- `profile.tsx`: profile basics.
- `goals.tsx`: focus topics.
- `palm-scan.tsx` and `palm-scan.web.tsx`: palm capture or web-specific fallback.
- `analysis.tsx`: analysis/loading step.
- `report-preview.tsx`: preview report gate before main app.
- `paywall.tsx`: premium unlock.
- `account.tsx` and `account-email.tsx`: Supabase OAuth/email/password sign-in.

`resolveOnboardingHref()` resumes incomplete onboarding in this order: intro/profile, gender/profile details, goals, palm scan, then report preview if reading data exists.

### Main App

`app/(main)/_layout.tsx` defines the tabs:

- `home`: dashboard and entry point to reports/predictions.
- `chat`: AI guide conversation.
- `tasks`: daily rituals/tasks.
- `profile`: account, premium, and local reset actions.
- `edit-profile`: hidden tab route for profile editing.

The tab shell blocks access when hydration is not ready, ritual data is missing, or Supabase sign-in is required but absent.

### Report and Task Routes

- `app/report/index.tsx`: main report view.
- `app/report/compatibility.tsx`: compatibility view.
- `app/report/partner-palm-scan*.tsx`: partner palm capture flow.
- `app/report/partner-palm-analysis.tsx`: partner analysis.
- `app/task/[id].tsx`: daily task detail.

## Frontend State

### `store/sessionStore.ts`

This is the main persisted app state under storage key `agastya-session-v3`.

It stores:

- Identity: `sessionId`, `deviceInstallId`, `supabaseUserId`, `identityReady`.
- Access: `hasUnlockedPremium`, `hasEnteredMain`.
- Profile: display name, gender, focus topics, billing period.
- Palm and report data: local captures, palm analysis, partner palm analysis, preview/full reports, predictions.
- Restore flags: `syncNotice`, `dismissedUpgradeCard`, `skipCloudRestore`.

Only selected fields are persisted. Raw palm capture images are not persisted by this store; analysis/report data is.

### `store/chatStore.ts`

In-memory chat state for guide messages, suggestions, typing state, and free-tier message count. Server chat tails can hydrate this store after cloud restore.

### `store/taskStore.ts`

Persisted daily task state under `agastya-tasks-v1`: generated tasks, completed IDs, date, variant, streak, and completion history.

## Frontend Services

### API Client

`services/agastyaApi.ts` maps frontend calls to backend endpoints. It adds JSON headers, optional bearer auth, timeout handling, ngrok warning bypass headers, and user-friendly error mapping.

Key calls:

- `fetchApiHealth()` -> `GET /v1/health`.
- `registerSession()` -> `POST /v1/sessions/register`.
- `fetchSessionBootstrap()` -> `GET /v1/sessions/bootstrap`.
- `fetchAuthenticatedSessionBootstrap()` -> `GET /v1/sessions/bootstrap/authenticated`.
- `patchSessionProfile()` -> `PATCH /v1/sessions/profile`.
- `mergeSessions()` -> `POST /v1/sessions/merge`.
- `analyzePalm()` -> `POST /v1/palm/analyze`.
- `generateReport()` -> `POST /v1/reports/generate`.
- `chatWithGuide()` -> `POST /v1/chat`.
- `fetchDailyTasks()` -> `POST /v1/tasks/daily`.
- `fetchPredictions()` -> `POST /v1/predictions/generate`.
- `createStripeCheckoutSession()` -> `POST /v1/billing/checkout`.
- `deleteAccountFromServer()` -> `POST /v1/auth/delete-account`.

### API URL Resolution

`services/env.ts` resolves `AGASTYA_API_ROOT`.

- Web/dev simulators can use `EXPO_PUBLIC_AGASTYA_API_URL=http://localhost:8000`.
- Android emulator falls back to `http://10.0.2.2:8000`.
- Physical native devices prefer `EXPO_PUBLIC_AGASTYA_API_LAN_URL` or a LAN URL injected by `app.config.js`.
- Production native builds disable API calls if no production URL is configured.

`app.config.js` injects `extra.agastyaApiUrl` and `extra.agastyaApiLanUrl`; EAS/CI defaults to the Railway production API if no explicit API URL is set.

### Identity and Restore

`services/identity.ts` ensures every user has:

- `sessionId`: generated UUID for anonymous/session-scoped backend state.
- `deviceInstallId`: Android ID, iOS vendor ID, web localStorage UUID, or generated fallback.

`bootstrapIdentity()` creates local IDs, links RevenueCat, checks `/v1/health`, and optionally restores cloud data.

`services/sessionRestore.ts` pulls saved profile, palm analysis, reports, premium status, and chat tail from the backend when needed. It prefers authenticated restore when sign-in is active and forced.

### Supabase Auth

`services/supabase.ts` lazily creates the Supabase client using:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Auth uses persisted storage, PKCE, auto-refresh, and no URL session detection. `isSupabaseEnabled` is true when both frontend keys exist.

`services/authConfig.ts` currently treats Supabase being configured as requiring sign-in for main-app entry. Email/password is enabled when Supabase is enabled. Magic links and OAuth can be hidden with:

- `EXPO_PUBLIC_EMAIL_SIGNIN=false`
- `EXPO_PUBLIC_OAUTH_SIGNIN=false`

Auth and session orchestration lives in:

- `services/authSession.ts`: read session, sync auth user to store, sign out/reset/delete account.
- `services/authCallback.ts`: parse deep links and complete OAuth/magic-link sessions.
- `services/authMerge.ts`: merge anonymous session with Supabase user after sign-in.
- `services/authEmail.ts`: email/password, sign-up, magic link, password reset.
- `services/authRedirect.ts`: redirect URI helpers.

### Billing

`services/revenuecat.ts` handles native RevenueCat setup and entitlement checks. The default entitlement is `premium`, configurable with `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT`.

`services/stripeBilling.ts` starts Stripe Checkout for web when `EXPO_PUBLIC_STRIPE_CHECKOUT_ENABLED=true` and the API is configured.

`services/premiumUnlock.ts` coordinates purchase/restore/finalize flows and updates local premium state after successful native or web unlock.

Server-side premium is authoritative for protected backend features.

### Notifications, Analytics, Errors

- `services/notifications.ts`: foreground behavior, permission request, daily reminders, ready notifications, notification deep links.
- `services/analytics.ts`: optional PostHog/Mixpanel event forwarding.
- `services/sentry.ts`: frontend Sentry init and helpers.
- `services/apiErrors.ts`, `services/authErrors.ts`, `services/authErrorUtils.ts`: user-facing error mapping.

## Backend Runtime

`backend/app/main.py` creates the FastAPI app. It:

- Loads `Settings` from `backend/.env` and environment variables.
- Validates production settings when `DEBUG=false`.
- Initializes Sentry if configured.
- Adds trusted-host, security-header, max-body-size, and CORS middleware.
- Includes routers under `settings.api_v1_prefix` (default `/v1`).
- Logs availability for Supabase, OpenRouter, Redis, and billing webhooks.

### Backend Settings

`backend/app/config.py` defines settings:

- App/CORS: `DEBUG`, `API_V1_PREFIX`, `CORS_ORIGINS`, `CORS_ORIGIN_REGEX`, `TRUSTED_HOSTS`.
- Palm/AI: `PALM_ANALYSIS_MODE`, `OPENROUTER_API_KEY`, `OPENROUTER_CHAT_MODEL`, `OPENROUTER_VISION_MODEL`, timeout values.
- Supabase: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, optional `SUPABASE_JWT_SECRET`, `SUPABASE_JWKS_CACHE_SECONDS`, `SUPABASE_PALM_BUCKET`.
- Rate limiting: `REDIS_URL`.
- Billing: `REVENUECAT_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`.
- Sentry: `SENTRY_DSN`, `SENTRY_ENVIRONMENT`.

In production, `OPENROUTER_API_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` are required.

### Backend Routes

`backend/app/routes/health.py`:

- `GET /v1/health`: process liveness and, in debug, Supabase/LLM/palm-vision availability.

`backend/app/routes/agastya.py`:

- `POST /v1/sessions/register`: create/update session metadata.
- `GET /v1/sessions/bootstrap`: restore session by `sessionId` and optional `deviceInstallId`.
- `GET /v1/sessions/bootstrap/authenticated`: restore richest saved session for the bearer Supabase user.
- `GET /v1/sessions/profile`: read profile metadata.
- `PATCH /v1/sessions/profile`: update profile metadata with device binding.
- `POST /v1/sessions/merge`: link anonymous session to Supabase user after token verification.
- `POST /v1/palm/analyze`: run palm pipeline, upload capture if configured, persist analysis.
- `POST /v1/reports/generate`: generate preview/full report; full requires premium.
- `POST /v1/chat`: generate guide reply; free tier is capped server-side.
- `POST /v1/tasks/daily`: generate daily tasks.
- `POST /v1/predictions/generate`: generate period predictions; 3-month/year require premium.

`backend/app/routes/auth.py`:

- `POST /v1/auth/check-email`: check Supabase auth user existence when admin access is configured.
- `POST /v1/auth/delete-account`: verify bearer token, delete palm captures, delete sessions, delete Supabase auth user.

`backend/app/routes/billing.py`:

- `POST /v1/billing/checkout`: create Stripe subscription Checkout session for web.

`backend/app/routes/webhooks.py`:

- `POST /v1/webhooks/revenuecat`: verify RevenueCat authorization and update premium by session or Supabase user.
- `POST /v1/webhooks/stripe`: verify Stripe signature and update premium on checkout/subscription events.

### Backend Services

- `services/session_repository.py`: Supabase REST persistence for `agastya_sessions`.
- `services/bucket_store.py`: in-process session buckets and Supabase-user aliases.
- `services/palm_pipeline.py`: palm analysis selection and fallback logic.
- `services/palm_ai.py`: OpenRouter vision palm reading.
- `services/palm_cv.py`: merge client landmarks into palm analysis.
- `services/palm_dummy.py`: deterministic fallback palm analysis.
- `services/report_engine.py`: deterministic report plus optional OpenRouter JSON enrichment.
- `services/ai_interactions.py`: guide chat and daily tasks with deterministic fallbacks.
- `services/predictions_engine.py`: deterministic predictions plus optional OpenRouter JSON enrichment.
- `services/palm_storage.py`: private Supabase Storage upload/delete for palm captures.
- `services/auth_admin.py`: Supabase admin auth helpers.
- `services/supabase_rest.py`: REST client using service role.
- `services/llm_health.py`, `services/llm_client.py`: OpenRouter availability and OpenAI-compatible client.

## Data Model

### Frontend DTOs

`types/palmAnalysis.ts` defines `PalmAnalysisDto`:

- Core fields: `life_line`, `heart_line`, `head_line`, `personality`, `traits`.
- Optional fields: dominant hand, hand shape, image quality, confidence, source, warnings, line details, mounts, fate line, line geometry.

`types/report.ts` defines the normalized report shape:

- Hero fields, archetype/headline copy, insight sections, bold prediction, metrics, and aura profile.

### Supabase Schema

`supabase/migrations/20260518120000_agastya_sessions.sql` creates `public.agastya_sessions`:

- `session_id` primary key.
- Device/user/profile fields.
- `palm_storage_path`.
- JSONB fields for `palm_analysis`, `preview_report`, `full_report`, `chat_tail`.
- Timestamps and RLS policies for authenticated users to read/update their own rows.

It also creates a private `palms` storage bucket for FastAPI service-role uploads.

Additional migrations:

- `20260520120000_agastya_palms_mime_expand.sql`: expands allowed palm image MIME types and file size.
- `20260606120000_agastya_predictions.sql`: adds `predictions` JSONB.
- `20260606130000_agastya_premium.sql`: adds authoritative `is_premium`.

## Key User Flows

### Anonymous Onboarding

1. User starts at `welcome`.
2. App creates local `sessionId` and `deviceInstallId`.
3. User enters profile basics and focus topics.
4. User scans/uploads palm.
5. Frontend calls `/v1/palm/analyze`.
6. Frontend calls `/v1/reports/generate` in preview mode.
7. User can proceed to account/paywall/main depending on gates.

### Sign-In and Merge

1. User signs in through Supabase OAuth, email/password, or magic link.
2. Callback code creates/restores the Supabase session.
3. `authMerge` calls `/v1/sessions/merge` with bearer token.
4. Backend verifies the token and binds the anonymous `sessionId` to `supabase_user_id`.
5. Restore logic can pull the richest saved session for that user.

### Main App Guide Chat

1. `chat` screen sends local conversation, palm analysis, and profile summary through `requestGuideReply()`.
2. Backend hydrates the session, refreshes premium from Supabase, and calls OpenRouter if available.
3. Free users are capped server-side after the preview message limit.
4. Backend stores the last 40 turns in `chat_tail`.

### Premium

Native:

1. Frontend configures RevenueCat with `sessionId` or user ID.
2. Purchase/restore checks the `premium` entitlement.
3. RevenueCat webhook updates `agastya_sessions.is_premium`.

Web:

1. Frontend calls `/v1/billing/checkout`.
2. Backend creates a Stripe subscription checkout session with session/user metadata.
3. Stripe webhook updates `is_premium`.

Backend gates full reports and long-range predictions with server-side `is_premium`.

## Environment Checklist

Frontend `.env` commonly includes:

- `EXPO_PUBLIC_AGASTYA_API_URL`
- `EXPO_PUBLIC_AGASTYA_API_LAN_URL` for physical-device dev when needed.
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_EMAIL_SIGNIN=false` to hide magic links.
- `EXPO_PUBLIC_OAUTH_SIGNIN=false` to hide OAuth.
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT`
- `EXPO_PUBLIC_STRIPE_CHECKOUT_ENABLED=true`
- `EXPO_PUBLIC_SENTRY_DSN`
- `EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_POSTHOG_HOST`, or `EXPO_PUBLIC_MIXPANEL_TOKEN`.

Backend `backend/.env` commonly includes:

- `DEBUG`
- `CORS_ORIGINS`
- `CORS_ORIGIN_REGEX`
- `PALM_ANALYSIS_MODE`
- `OPENROUTER_API_KEY`
- `OPENROUTER_CHAT_MODEL`
- `OPENROUTER_VISION_MODEL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_PALM_BUCKET`
- `REDIS_URL`
- `REVENUECAT_WEBHOOK_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_MONTHLY`
- `STRIPE_PRICE_ANNUAL`
- `SENTRY_DSN`
- `SENTRY_ENVIRONMENT`

Never commit real `.env` files or service-role secrets.

## Testing and Quality Notes

- Backend tests live in `backend/tests/`.
- Existing test coverage focuses on auth/JWT, session merge, premium gates, webhooks, rate limiting, palm analysis, email checks, and account deletion.
- There is no obvious frontend test runner script in `package.json`; use TypeScript/lint/build checks where available.
- `tsconfig.json` has `strict: true` and path alias `@/*`.
- Expo typed routes are enabled through `app.json`.

## Working Tree Caveats

- This repo may have a dirty working tree with many untracked and modified files. Check `git status` before committing.
- Some file listings in the current workspace show duplicate-looking slash/backslash paths, especially under `app/`, `services/`, `backend/app/`, and `components/`. Verify actual paths and avoid creating duplicate route files.
- `.expo/types/router.d.ts`, `node_modules/react-native-css-interop/.cache/*`, and `tsc-out.txt` look generated and should usually not be committed unless intentionally tracked.
- Backend production startup fails fast when required secrets are missing and `DEBUG=false`.
- Expo tunnel only exposes the JS bundle. A physical phone still needs to reach the FastAPI API over LAN or a hosted URL.

## High-Value Files to Read First

- `README.md`: quick start and repo overview.
- `DEPLOY.md`: production auth, billing, deploy, and environment checklist.
- `app/_layout.tsx`: app initialization.
- `app/index.tsx`: cold-start routing gate.
- `utils/navigationFlow.ts`: route gating and restore policy.
- `store/sessionStore.ts`: persisted frontend state model.
- `services/agastyaApi.ts`: frontend API contract.
- `services/identity.ts`: session/device identity bootstrap.
- `services/sessionRestore.ts`: cloud restore behavior.
- `services/authSession.ts`: sign-in, sign-out, reset, account deletion.
- `backend/app/main.py`: FastAPI setup.
- `backend/app/config.py`: backend settings and production validation.
- `backend/app/routes/agastya.py`: main API surface.
- `backend/app/services/session_repository.py`: Supabase persistence shape.
- `supabase/migrations/20260518120000_agastya_sessions.sql`: database/storage base schema.

# Google Play Data Safety — Agastya (answer sheet)

Use this when filling **Play Console → App content → Data safety**. Aligns with `legal/privacy.html` (sharvo.online).

## App overview

- Collects user data: **Yes**
- Data encrypted in transit: **Yes** (HTTPS)
- Users can request deletion: **Yes** (in-app + https://sharvo.online/delete-account)

## Data types collected

| Category | Data type | Collected | Shared | Required / Optional | Purpose |
|----------|-----------|-----------|--------|---------------------|---------|
| Personal info | Email address | Yes (if signed in) | Yes (auth/provider) | Optional | App functionality, Account management |
| Personal info | Name | Yes (display name) | Yes (backend/DB) | Optional | App functionality |
| Photos | Photos | Yes (palm images) | Yes (backend storage + AI provider) | Required for palm reading | App functionality |
| App activity | App interactions | Yes (analytics events) | Yes (Firebase Analytics and/or Mixpanel if enabled; Meta App Events when configured) | Optional | Analytics; Advertising or marketing |
| App info & performance | Crash logs | Yes | Yes (Sentry) | Optional | Analytics / stability |
| App info & performance | Diagnostics | Yes | Yes (Sentry) | Optional | Analytics / stability |
| Device or other IDs | Device or other IDs | Yes (device install ID, session ID; advertising ID when Meta ads measurement is enabled and permitted) | Yes (backend; Meta when configured) | Required for sync / Optional for ads | App functionality; Advertising or marketing |
| Financial info | Purchase history | Yes (premium flag / provider metadata) | Yes (Razorpay / Google Play) | Optional | App functionality |

## Sharing destinations (declare as applicable)

- **Supabase** — account, session, palm storage
- **OpenRouter** — palm image / text for AI inference
- **Razorpay** — checkout when user chooses alternative billing
- **Google Play** — billing / User Choice / External Transactions
- **Sentry** — crashes
- **Firebase Analytics and/or Mixpanel** — analytics (only if configured)
- **Meta (Facebook) App Events** — advertising measurement / campaign optimization (only if `EXPO_PUBLIC_FACEBOOK_APP_ID` + client token are set on the EAS build)

## Not collected

- Precise location, contacts, SMS, microphone audio, health data, political/religious beliefs as dedicated types (beyond optional gender/focus topics as app content).

## Ephemeral / processing notes

- Palm photos are processed to produce a reading and may be stored up to ~90 days.
- Analytics must not include palm images or chat message bodies (current client implementation).

## Account deletion URL

`https://sharvo.online/delete-account`

## Privacy policy URL

`https://sharvo.online/privacy`

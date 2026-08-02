# Agastya — RC1 Manual QA Checklist

| Field | Value |
|-------|-------|
| **Product** | Agastya: Palm Reading & AI Guide |
| **Release** | Release Candidate **RC1** |
| **Version** | `1.0.0` (Android `versionCode` 1) |
| **Package** | `com.agastya.app` |
| **Scheme** | `agastya://` |
| **Primary platform** | Android (Play internal / RC1 APK) |
| **Secondary** | iOS (Apple Sign In; no Razorpay purchase), Web (gallery palm; no local notifications) |
| **Build ID** | ________________ |
| **API base URL** | ________________ |
| **Supabase project** | ________________ |
| **Billing mode** | ☐ Live ☐ Test bypass (`BILLING_RAZORPAY_TEST_BYPASS`) |
| **Tester** | ________________ |
| **Date** | ________________ |
| **Device(s)** | ________________ |

**Related docs:** [DEPLOY.md](../DEPLOY.md) (auth + post-deploy smoke), [billing-railway-e2e.md](billing-railway-e2e.md), [billing-razorpay-only.md](billing-razorpay-only.md).

---

## 1. RC1 Sign-off Summary

| Metric | Count |
|--------|------:|
| Total executed | ____ |
| Pass | ____ |
| Fail | ____ |
| Blocked | ____ |
| N/A | ____ |

| Role | Name | Verdict | Date | Signature |
|------|------|---------|------|-----------|
| QA lead | | ☐ Ready ☐ Not ready | | |
| Product | | ☐ Ready ☐ Not ready | | |
| Engineering | | ☐ Ready ☐ Not ready | | |

**Release rule:** No open **Blocker** or **Critical** fails. Majors require documented waiver.

---

## 2. Environment & Credentials

| Item | Value / status |
|------|----------------|
| RC1 build installed (fresh or upgrade as noted per case) | ☐ |
| `GET {API}/v1/health` (or equivalent) returns healthy | ☐ |
| Supabase Auth: Google / Apple / email enabled as intended | ☐ |
| Camera + notifications available on device | ☐ |
| Test account — free (signed-in, ritual complete, not Pro) | ________________ |
| Test account — Pro (entitled) | ________________ |
| Test account — premium email allowlist (if used) | ________________ |
| Razorpay test amount / plan (monthly / annual) | ________________ |
| Network tools (airplane mode, throttling) available | ☐ |

---

## 3. Severity Guide (use in Notes)

| Severity | Meaning |
|----------|---------|
| **Blocker** | Crash, data loss, cannot complete core ritual, cannot purchase/entitlement, auth broken |
| **Critical** | Core feature unusable (palm, report, paywall, sign-in) with no workaround |
| **Major** | Important path broken; workaround exists |
| **Minor** | Cosmetic, copy, non-blocking UX |

**Pass/Fail values:** `Pass` · `Fail` · `Blocked` · `N/A`

---

## 4. Product gates (tester reference)

| Surface | Free (signed-in, ritual done) | Pro |
|---------|------------------------------|-----|
| Onboarding ritual + report **Preview** | Yes | — |
| Home + **Today's Guidance** | Yes | Yes |
| Full report `/report` | No → preview / paywall | Yes |
| Predictions 3-month / 1-year | Locked | Unlocked |
| Chat (Guide) | **Guide is a Pro feature** | Yes |
| Tasks (Daily rituals) | **Daily rituals are a Pro feature** | Yes |
| Compatibility | **Compatibility is a Pro feature** | Yes |

When Supabase is configured, **sign-in is required** to enter main tabs (`need_sign_in`). Anonymous users can complete the ritual through preview.

**Guest** in this checklist = **anonymous local session** (no labeled “Continue as guest”).

**Settings** live on **Profile** (no separate Settings screen).

**Push** = local notifications only (`expo-notifications`); disabled on Web / Expo Go.

---

## 5. Test Cases

---

### 5.1 Installation (`INST`)

#### INST-001 — Fresh install cold launch
| Field | Detail |
|-------|--------|
| **Preconditions** | App not installed; RC1 build available. |
| **Steps** | 1. Install RC1 APK / Play internal build. 2. Launch app. 3. Observe splash and first screen. |
| **Expected Result** | Splash shows; app reaches **Welcome** (`Agastya` / **Your palm. Your guide.**) or restore loader then Welcome if no prior data. No crash. |
| **Pass/Fail** | |
| **Notes** | |

#### INST-002 — App icon and splash branding
| Field | Detail |
|-------|--------|
| **Preconditions** | Fresh install. |
| **Steps** | 1. Confirm launcher icon. 2. Cold-launch and watch splash. |
| **Expected Result** | Icon and splash match RC1 branding (`#05020a` splash field); name **Agastya**. |
| **Pass/Fail** | |
| **Notes** | |

#### INST-003 — Camera permission prompt (first palm)
| Field | Detail |
|-------|--------|
| **Preconditions** | Fresh install; permissions never granted. |
| **Steps** | 1. **Get started** through onboarding to palm scan. 2. Allow or deny camera when prompted. |
| **Expected Result** | System camera permission dialog appears with Agastya usage copy. Allow → camera usable; Deny → graceful message / gallery path without crash. |
| **Pass/Fail** | |
| **Notes** | |

#### INST-004 — Notification permission (enter main)
| Field | Detail |
|-------|--------|
| **Preconditions** | Signed-in user completing first entry to main; notifications not yet decided. |
| **Steps** | 1. Complete ritual + sign-in + **Enter Agastya**. 2. Observe notification permission prompt (Android 13+). |
| **Expected Result** | Permission requested without crash. Deny still allows app use; grant enables local reminders later. |
| **Pass/Fail** | |
| **Notes** | N/A on Web / Expo Go. |

#### INST-005 — Uninstall removes local session
| Field | Detail |
|-------|--------|
| **Preconditions** | Device has local reading from prior anonymous or signed-out session. |
| **Steps** | 1. Uninstall app. 2. Reinstall RC1. 3. Launch. |
| **Expected Result** | Local `agastya-session-v3` gone; Welcome / fresh path. Cloud data only returns after sign-in (see RET / AUTH). |
| **Pass/Fail** | |
| **Notes** | |

---

### 5.2 Fresh user (`FRESH`)

#### FRESH-001 — Full happy-path ritual (anonymous → preview)
| Field | Detail |
|-------|--------|
| **Preconditions** | Fresh install; network online; Supabase configured. |
| **Steps** | 1. Tap **Get started**. 2. Trust screen → **Continue**. 3. Enter name + gender → **Continue**. 4. Select focus topics → continue. 5. Capture palm. 6. Wait for analysis. 7. Land on report preview. |
| **Expected Result** | Each step advances; analysis stages visible; preview shows **Preview** badge and partial chapters (e.g. 2 of 4). No crash. |
| **Pass/Fail** | |
| **Notes** | |

#### FRESH-002 — Welcome Sign in entry
| Field | Detail |
|-------|--------|
| **Preconditions** | Fresh install; not signed in. |
| **Steps** | 1. On Welcome, tap **Sign in**. |
| **Expected Result** | Navigates to account screen (`Sign in to your account` / save reading context as designed). |
| **Pass/Fail** | |
| **Notes** | |

#### FRESH-003 — Goals selection required
| Field | Detail |
|-------|--------|
| **Preconditions** | On goals step. |
| **Steps** | 1. Attempt to continue with no topics selected (if UI allows). 2. Select at least one topic (Love / Career / Money / Growth / Compatibility) and continue. |
| **Expected Result** | Cannot proceed empty if validated; with selection, advances to palm scan. |
| **Pass/Fail** | |
| **Notes** | |

#### FRESH-004 — Preview CTAs for unsigned user
| Field | Detail |
|-------|--------|
| **Preconditions** | Anonymous user on report preview. |
| **Steps** | 1. Observe CTAs. 2. Tap **Save & sign in** (or **Save & sign in to continue**). 3. Optionally tap **Unlock Premium**. |
| **Expected Result** | Sign-in route opens; Unlock routes toward paywall / account with paywall intent. Preview content readable. |
| **Pass/Fail** | |
| **Notes** | |

#### FRESH-005 — Enter main after first sign-in
| Field | Detail |
|-------|--------|
| **Preconditions** | Ritual complete; signed in; not necessarily Pro. |
| **Steps** | 1. From preview or account, tap **Enter Agastya**. 2. Open Home tab. |
| **Expected Result** | Main tabs: **Home · Chat · Tasks · Profile**. Home loads; Chat/Tasks show Pro locks if free. |
| **Pass/Fail** | |
| **Notes** | |

---

### 5.3 Returning user (`RET`)

#### RET-001 — Cold start restore (signed-in, ritual done)
| Field | Detail |
|-------|--------|
| **Preconditions** | Signed-in user with completed ritual; kill app. |
| **Steps** | 1. Cold launch. 2. Observe loading copy. |
| **Expected Result** | Shows **Restoring your reading…** then lands on **Home** (not Welcome). |
| **Pass/Fail** | |
| **Notes** | |

#### RET-002 — Incomplete ritual resume
| Field | Detail |
|-------|--------|
| **Preconditions** | User stopped after profile or goals; not finished palm. |
| **Steps** | 1. Kill app. 2. Relaunch. |
| **Expected Result** | Resumes correct onboarding step (name → profile; gender → profile; topics → goals; else palm-scan) — not blank Welcome if progress exists. |
| **Pass/Fail** | |
| **Notes** | |

#### RET-003 — Signed-in without reading
| Field | Detail |
|-------|--------|
| **Preconditions** | Account signed in; no palm reading on session. |
| **Steps** | 1. Cold launch / open app. |
| **Expected Result** | Routes toward account / setup — does not dump into empty main incorrectly; user can continue ritual. |
| **Pass/Fail** | |
| **Notes** | |

#### RET-004 — OAuth return + session merge
| Field | Detail |
|-------|--------|
| **Preconditions** | Anonymous ritual with preview exists; Google (or Apple) available. |
| **Steps** | 1. From account, **Continue with Google** (or Apple on iOS). 2. Complete OAuth. 3. Return to app. |
| **Expected Result** | Session merges; reading preserved; user can **Enter Agastya** / reach Home. No duplicate wipe of local preview. |
| **Pass/Fail** | |
| **Notes** | |

#### RET-005 — Reinstall + sign-in cloud restore
| Field | Detail |
|-------|--------|
| **Preconditions** | Pro or free account with cloud reading; uninstall wiped local store. |
| **Steps** | 1. Reinstall. 2. Sign in with same account. 3. Enter app. |
| **Expected Result** | Bootstrap restores reading / premium entitlement from server. Home usable. |
| **Pass/Fail** | |
| **Notes** | Aligns with DEPLOY Auth QA. |

---

### 5.4 Guest / anonymous flow (`GUEST`)

#### GUEST-001 — Anonymous ritual without account
| Field | Detail |
|-------|--------|
| **Preconditions** | Fresh install; do not sign in. |
| **Steps** | 1. Complete Get started → preview entirely anonymously. |
| **Expected Result** | Ritual works offline-capable where designed; preview available; no forced account mid-palm if skip/account is later. |
| **Pass/Fail** | |
| **Notes** | |

#### GUEST-002 — Anonymous blocked from main tabs (Supabase on)
| Field | Detail |
|-------|--------|
| **Preconditions** | Supabase configured (`requiresSupabaseSignIn`); anonymous with preview. |
| **Steps** | 1. Attempt **Enter Agastya** / deep-link to `/(main)/home` without signing in. |
| **Expected Result** | Redirected to `/onboarding/account` (need sign-in). Cannot use Chat/Tasks/Profile tabs unsigned. |
| **Pass/Fail** | |
| **Notes** | |

#### GUEST-003 — Anonymous local persistence across restart
| Field | Detail |
|-------|--------|
| **Preconditions** | Anonymous user mid-onboarding or on preview. |
| **Steps** | 1. Force-stop app. 2. Relaunch. |
| **Expected Result** | Local session restored; progress / preview still present until wipe or Start fresh. |
| **Pass/Fail** | |
| **Notes** | |

#### GUEST-004 — Light anonymous bootstrap
| Field | Detail |
|-------|--------|
| **Preconditions** | Online anonymous session. |
| **Steps** | 1. Progress through onboarding with network on. 2. Observe no full chat/report cloud restore as if signed-in. |
| **Expected Result** | App remains usable; no crash if bootstrap limited; unsigned user not treated as Pro. |
| **Pass/Fail** | |
| **Notes** | |

---

### 5.5 Authentication (`AUTH`)

#### AUTH-001 — Google OAuth sign-in
| Field | Detail |
|-------|--------|
| **Preconditions** | OAuth enabled; Android/iOS/Web as applicable. |
| **Steps** | 1. Open account screen. 2. Tap **Continue with Google**. 3. Complete Google consent. 4. Return to app. |
| **Expected Result** | Busy state **Signing in...** / restore copy; signed-in; merge; correct resume route. |
| **Pass/Fail** | |
| **Notes** | |

#### AUTH-002 — Apple OAuth (iOS only)
| Field | Detail |
|-------|--------|
| **Preconditions** | iOS device; OAuth enabled. |
| **Steps** | 1. Tap **Continue with Apple**. 2. Complete Apple sheet. |
| **Expected Result** | Signed in; merge; resume. Button hidden/N/A on Android. |
| **Pass/Fail** | |
| **Notes** | Mark N/A on Android RC1 if iOS not in scope. |

#### AUTH-003 — Email + password sign-up
| Field | Detail |
|-------|--------|
| **Preconditions** | Email auth enabled. |
| **Steps** | 1. **Continue with Email**. 2. Create account with new email/password. 3. Confirm email if required. 4. Sign in. |
| **Expected Result** | Account created; session established; merge; enter app path works. |
| **Pass/Fail** | |
| **Notes** | |

#### AUTH-004 — Email + password sign-in
| Field | Detail |
|-------|--------|
| **Preconditions** | Existing password account. |
| **Steps** | 1. Sign in with email/password from account-email screen. |
| **Expected Result** | Success → merge → correct route. Invalid credentials show clear error (no crash). |
| **Pass/Fail** | |
| **Notes** | |

#### AUTH-005 — Magic link
| Field | Detail |
|-------|--------|
| **Preconditions** | `EXPO_PUBLIC_EMAIL_SIGNIN` not false; magic link enabled. |
| **Steps** | 1. Request email sign-in link. 2. Open link on device. 3. Land on `/auth/callback`. |
| **Expected Result** | Session created; merge; app resumes correctly. |
| **Pass/Fail** | |
| **Notes** | N/A if magic link disabled for RC1. |

#### AUTH-006 — Forgot / reset password
| Field | Detail |
|-------|--------|
| **Preconditions** | Password account exists. |
| **Steps** | 1. Start reset from email screen. 2. Open reset email. 3. Set new password on `/auth/reset-password`. 4. Sign in with new password. |
| **Expected Result** | Password updated; sign-in works; old password fails. |
| **Pass/Fail** | |
| **Notes** | |

#### AUTH-007 — Sign in from Profile
| Field | Detail |
|-------|--------|
| **Preconditions** | Can reach Profile signed out locally or via Start over path that leaves sign-in CTA; or use account with `fromProfile`. |
| **Steps** | 1. Profile → **Sign in**. 2. Complete auth. |
| **Expected Result** | Account headline **Sign in to your account**; reading preserved after merge. |
| **Pass/Fail** | |
| **Notes** | |

#### AUTH-008 — Sign in from paywall intent
| Field | Detail |
|-------|--------|
| **Preconditions** | Unsigned or needs auth before purchase. |
| **Steps** | 1. From paywall, trigger **Sign in to unlock** / account with `toPaywall=1`. 2. Sign in. |
| **Expected Result** | Headline **Sign in to unlock Premium**; returns toward paywall / unlock flow. |
| **Pass/Fail** | |
| **Notes** | |

#### AUTH-009 — OAuth cancel / fail
| Field | Detail |
|-------|--------|
| **Preconditions** | Account screen. |
| **Steps** | 1. Start Google sign-in. 2. Cancel in browser/sheet. |
| **Expected Result** | Returns to account; no stuck spinner; user can retry. |
| **Pass/Fail** | |
| **Notes** | |

#### AUTH-010 — Merge failure soft notice
| Field | Detail |
|-------|--------|
| **Preconditions** | Can simulate backend JWT/merge failure (staging) OR observe sync notice if known bad config. |
| **Steps** | 1. Sign in successfully at Supabase. 2. If merge fails, continue in app. |
| **Expected Result** | Sign-in OK; user may see sync notice (**You're viewing what's saved on this device.**); no hard crash. |
| **Pass/Fail** | |
| **Notes** | Blocked if cannot simulate — note env. |

---

### 5.6 Palm Scan (`PALM`)

#### PALM-001 — Camera capture happy path
| Field | Detail |
|-------|--------|
| **Preconditions** | Camera permission granted; on palm-scan. |
| **Steps** | 1. Read tips (Good light / Open palm / Fill frame / Hold steady). 2. Tap **Capture palm**. 3. Wait for capture. |
| **Expected Result** | Captures image; navigates to analysis with seed. Coaching / guide overlays visible. |
| **Pass/Fail** | |
| **Notes** | |

#### PALM-002 — Upload from gallery
| Field | Detail |
|-------|--------|
| **Preconditions** | Photo library permission; clear palm photo available. |
| **Steps** | 1. Tap **Upload from gallery** (or web equivalent). 2. Pick JPG/PNG of open palm. |
| **Expected Result** | Image accepted; proceeds to analysis. Bad file shows alert (e.g. upload failed) without crash. |
| **Pass/Fail** | |
| **Notes** | Primary path on Web. |

#### PALM-003 — Camera permission denied
| Field | Detail |
|-------|--------|
| **Preconditions** | Deny camera (or revoke in system settings). |
| **Steps** | 1. Open palm-scan. 2. Attempt capture. |
| **Expected Result** | Clear guidance to enable camera or use gallery; no freeze/crash. |
| **Pass/Fail** | |
| **Notes** | |

#### PALM-004 — Soft quality gate
| Field | Detail |
|-------|--------|
| **Preconditions** | Capture a deliberately dark/blurry palm if gate triggers. |
| **Steps** | 1. Capture weak image. 2. Respond to quality alert (proceed or retake). |
| **Expected Result** | Soft gate alert appears when applicable; user can retake or continue; no silent failure. |
| **Pass/Fail** | |
| **Notes** | |

#### PALM-005 — Retake banner after analysis reject
| Field | Detail |
|-------|--------|
| **Preconditions** | Analysis returned unreadable / retake. |
| **Steps** | 1. From analysis retry, tap **Retake photo**. 2. Land on palm-scan. |
| **Expected Result** | Retake notice/banner about prior photo clarity; can capture again. |
| **Pass/Fail** | |
| **Notes** | |

#### PALM-006 — Capture failure message
| Field | Detail |
|-------|--------|
| **Preconditions** | Force capture failure if possible (interrupt camera). |
| **Steps** | 1. Attempt capture under failure conditions. |
| **Expected Result** | User-facing failure copy (couldn’t capture / try better light); retry available. |
| **Pass/Fail** | |
| **Notes** | |

---

### 5.7 AI Analysis (`AI`)

#### AI-001 — Analysis stage progression
| Field | Detail |
|-------|--------|
| **Preconditions** | Valid palm just captured; API online. |
| **Steps** | 1. Observe analysis screen until complete. |
| **Expected Result** | Stages progress through **Uploading image…** → **Analyzing palm…** → **Identifying major features…** → **Generating Life Blueprint…** → **Preparing your report…** then preview. |
| **Pass/Fail** | |
| **Notes** | |

#### AI-002 — Success navigates to preview + ready notification
| Field | Detail |
|-------|--------|
| **Preconditions** | Notifications permitted (native build). |
| **Steps** | 1. Complete live analysis. 2. Wait ~3s after success. |
| **Expected Result** | Lands on report preview; local notification **Your palm reading is ready** / **Tap to open your report.** may appear. |
| **Pass/Fail** | |
| **Notes** | N/A Web / Expo Go for notification. |

#### AI-003 — Unreadable palm retry UI
| Field | Detail |
|-------|--------|
| **Preconditions** | Upload image that fails quality / unreadable response. |
| **Steps** | 1. Run analysis. 2. Observe retry UI. |
| **Expected Result** | Title **We couldn't clearly analyze your palm**; reasons listed; CTA **Retake photo** returns to scan. |
| **Pass/Fail** | |
| **Notes** | |

#### AI-004 — Offline / unavailable → provisional reading
| Field | Detail |
|-------|--------|
| **Preconditions** | Airplane mode or API unreachable after capture (or no API). |
| **Steps** | 1. Enter analysis offline. |
| **Expected Result** | Simulated/provisional path; may show provisional badge; still reaches preview without crash. |
| **Pass/Fail** | |
| **Notes** | |

#### AI-005 — Report generation failure after palm OK
| Field | Detail |
|-------|--------|
| **Preconditions** | Staging can fail `reports/generate` while analyze succeeds (or observe mapped error). |
| **Steps** | 1. Run analysis when report gen fails. |
| **Expected Result** | Clear message that palm was read but Life Blueprint couldn’t be built; retry/retake path; no blank hang. |
| **Pass/Fail** | |
| **Notes** | Blocked if cannot induce. |

#### AI-006 — Lost photo / session error
| Field | Detail |
|-------|--------|
| **Preconditions** | Force missing palm payload if testable (dev) OR rapid kill mid-handoff. |
| **Steps** | 1. Open analysis without valid photo. |
| **Expected Result** | Error copy about session/photo lost; recover to retake; no crash loop. |
| **Pass/Fail** | |
| **Notes** | |

---

### 5.8 Report (`RPT`)

#### RPT-001 — Preview content (free)
| Field | Detail |
|-------|--------|
| **Preconditions** | Analysis success; on report-preview. |
| **Steps** | 1. Scroll preview. 2. Note locked sections / metrics teaser. |
| **Expected Result** | **Preview** badge; limited chapters (e.g. 2 of 4); upgrade messaging for full scores / aura / predictions. |
| **Pass/Fail** | |
| **Notes** | |

#### RPT-002 — Full report gated for free user
| Field | Detail |
|-------|--------|
| **Preconditions** | Signed-in free user; try open `/report` (Profile → Palm report or deep link). |
| **Steps** | 1. Navigate to full report. |
| **Expected Result** | Redirect to preview / lock — not full Pro report. |
| **Pass/Fail** | |
| **Notes** | |

#### RPT-003 — Full report tabs (Pro)
| Field | Detail |
|-------|--------|
| **Preconditions** | Pro user with reading. |
| **Steps** | 1. Open full report. 2. Switch **Overview / Lines / Persona / Predictions**. |
| **Expected Result** | All tabs load content; no empty crash. Loading may show **Restoring your reading…** / shaping forecast briefly. |
| **Pass/Fail** | |
| **Notes** | |

#### RPT-004 — Predictions horizon locks
| Field | Detail |
|-------|--------|
| **Preconditions** | On Predictions tab (Pro for full report; verify 3m/1y locks as designed). |
| **Steps** | 1. View month prediction. 2. Attempt 3-month and 1-year. |
| **Expected Result** | Month available in full report; longer horizons require Pro unlock copy if not entitled. |
| **Pass/Fail** | |
| **Notes** | |

#### RPT-005 — Empty report state
| Field | Detail |
|-------|--------|
| **Preconditions** | Signed-in user without ready reading (if reachable). |
| **Steps** | 1. Open report. |
| **Expected Result** | Empty copy (**Your palm report isn’t ready yet**) with CTA to start palm scan. |
| **Pass/Fail** | |
| **Notes** | |

#### RPT-006 — Open reading from Home
| Field | Detail |
|-------|--------|
| **Preconditions** | Home with guidance card; reading exists. |
| **Steps** | 1. Tap **Open your reading** / **Begin your reading**. |
| **Expected Result** | Navigates to preview or full report per entitlement. |
| **Pass/Fail** | |
| **Notes** | |

---

### 5.9 Premium (`PREM`)

#### PREM-001 — Paywall copy and CTAs
| Field | Detail |
|-------|--------|
| **Preconditions** | Reach `/onboarding/paywall` (from preview Unlock Premium). |
| **Steps** | 1. Read headline and body. 2. Note plan options if shown. |
| **Expected Result** | Headline **Unlock your full Life Blueprint**; CTA **Unlock Premium** or **Sign in to unlock** / **Processing...** when busy. Guidance remains described as free where copy states. |
| **Pass/Fail** | |
| **Notes** | |

#### PREM-002 — Purchase requires sign-in
| Field | Detail |
|-------|--------|
| **Preconditions** | Unsigned on paywall. |
| **Steps** | 1. Tap unlock. |
| **Expected Result** | Redirects to account with paywall intent; no charge without sign-in. |
| **Pass/Fail** | |
| **Notes** | |

#### PREM-003 — Chat lock gate (free)
| Field | Detail |
|-------|--------|
| **Preconditions** | Free signed-in user on main. |
| **Steps** | 1. Open **Chat** tab. |
| **Expected Result** | **Guide is a Pro feature**; **Unlock full access** / **Back to Home**. |
| **Pass/Fail** | |
| **Notes** | |

#### PREM-004 — Tasks lock gate (free)
| Field | Detail |
|-------|--------|
| **Preconditions** | Free signed-in user. |
| **Steps** | 1. Open **Tasks** tab. |
| **Expected Result** | **Daily rituals are a Pro feature** with unlock / back actions. |
| **Pass/Fail** | |
| **Notes** | |

#### PREM-005 — Compatibility lock gate (free)
| Field | Detail |
|-------|--------|
| **Preconditions** | Free user; open Compatibility from Profile/Reading. |
| **Steps** | 1. Open Compatibility. |
| **Expected Result** | **Compatibility is a Pro feature**. |
| **Pass/Fail** | |
| **Notes** | |

#### PREM-006 — Already premium messaging
| Field | Detail |
|-------|--------|
| **Preconditions** | Entitled Pro user opens paywall. |
| **Steps** | 1. Open paywall. |
| **Expected Result** | Indicates full access already on device; can **Enter Agastya**. |
| **Pass/Fail** | |
| **Notes** | |

#### PREM-007 — Check subscription status
| Field | Detail |
|-------|--------|
| **Preconditions** | Profile; purchase may be pending webhook. |
| **Steps** | 1. Profile → **Check subscription status**. |
| **Expected Result** | Refreshes entitlement from server; unlocks Pro surfaces if paid. |
| **Pass/Fail** | |
| **Notes** | |

#### PREM-008 — Email allowlist Pro (if configured)
| Field | Detail |
|-------|--------|
| **Preconditions** | Account email on `PREMIUM_EMAIL_ALLOWLIST`. |
| **Steps** | 1. Sign in with allowlisted email. 2. Open Chat/Tasks/Report. |
| **Expected Result** | Pro access without payment. |
| **Pass/Fail** | |
| **Notes** | N/A if allowlist unused in RC1. |

#### PREM-009 — Home upgrade teaser (free)
| Field | Detail |
|-------|--------|
| **Preconditions** | Free user on Home. |
| **Steps** | 1. Find upgrade card **Unlock your full Life Blueprint**. 2. Dismiss if dismissible. |
| **Expected Result** | Teaser shown for free; hidden for Pro; dismiss works without breaking Home. |
| **Pass/Fail** | |
| **Notes** | |

#### PREM-010 — Non-Android purchase messaging
| Field | Detail |
|-------|--------|
| **Preconditions** | iOS or Web build (if tested). |
| **Steps** | 1. Attempt Unlock Premium purchase. |
| **Expected Result** | Clear message that Premium purchase is available on Android (India) / continue with free preview — no broken checkout. |
| **Pass/Fail** | |
| **Notes** | N/A if RC1 Android-only. |

---

### 5.10 Razorpay (`RZ`)

> Deep env setup: [billing-railway-e2e.md](billing-railway-e2e.md), [billing-razorpay-only.md](billing-razorpay-only.md).

#### RZ-001 — Create payment link (signed-in Android IN)
| Field | Detail |
|-------|--------|
| **Preconditions** | Signed-in; Android; India / forced country; billing enabled. |
| **Steps** | 1. Paywall → **Unlock Premium**. 2. Complete Play User Choice if shown (alternative billing path). |
| **Expected Result** | Payment link opens in browser; amount/plan match config. |
| **Pass/Fail** | |
| **Notes** | |

#### RZ-002 — Successful payment → entitlement
| Field | Detail |
|-------|--------|
| **Preconditions** | RZ-001 path; test or live ₹ amount as configured. |
| **Steps** | 1. Complete Razorpay payment. 2. Return via success deep link to paywall. 3. Wait for confirm/bootstrap. |
| **Expected Result** | Entitlement `is_premium`; Pro features unlock; may generate full report; can enter main. |
| **Pass/Fail** | |
| **Notes** | |

#### RZ-003 — Checkout cancelled
| Field | Detail |
|-------|--------|
| **Preconditions** | Payment link open. |
| **Steps** | 1. Cancel checkout / return cancel URL. |
| **Expected Result** | Alert **Checkout cancelled** / **No charge was completed. You can try again when ready.**; still free. |
| **Pass/Fail** | |
| **Notes** | |

#### RZ-004 — Purchase pending / confirm lag
| Field | Detail |
|-------|--------|
| **Preconditions** | Payment succeeded but confirm slow (or kill during confirm). |
| **Steps** | 1. Return from payment before confirm settles. 2. Use **Check subscription status** if needed. |
| **Expected Result** | **Purchase pending** messaging if unconfirmed; retry/check eventually entitles; no permanent false free if paid. |
| **Pass/Fail** | |
| **Notes** | |

#### RZ-005 — Google Play Billing path (User Choice → Play)
| Field | Detail |
|-------|--------|
| **Preconditions** | Production-like build with Play Billing; User Choice offers Play. |
| **Steps** | 1. Choose Play Billing. 2. Complete native purchase. |
| **Expected Result** | Purchase verifies via Google Play verify endpoint; premium unlocks. |
| **Pass/Fail** | |
| **Notes** | N/A if RC1 uses Razorpay bypass only. |

#### RZ-006 — Test bypass path (debug builds only)
| Field | Detail |
|-------|--------|
| **Preconditions** | `BILLING_RAZORPAY_TEST_BYPASS` + `DEBUG` as documented for internal RC. |
| **Steps** | 1. Unlock Premium. 2. Confirm bypass opens Razorpay without full User Choice if configured. |
| **Expected Result** | Checkout reachable for QA; document that production RC must disable bypass. |
| **Pass/Fail** | |
| **Notes** | Must be **Fail** for store RC if bypass left on in production binary. |

#### RZ-007 — Webhook + client confirm dual path
| Field | Detail |
|-------|--------|
| **Preconditions** | Live/test webhook configured. |
| **Steps** | 1. Complete payment. 2. Confirm client `confirm-payment` and/or webhook marks premium in DB. |
| **Expected Result** | Server `is_premium` true; app bootstrap reflects Pro within retry window (~0–5s). |
| **Pass/Fail** | |
| **Notes** | |

---

### 5.11 Chat (`CHAT`)

#### CHAT-001 — Pro chat happy path
| Field | Detail |
|-------|--------|
| **Preconditions** | Pro user; reading exists. |
| **Steps** | 1. Open Chat. 2. Send a follow-up about the reading. |
| **Expected Result** | Intro greets with name; typing indicator; reply bubble; suggestion chips; composer placeholder **Ask about your reading…** / follow-up. |
| **Pass/Fail** | |
| **Notes** | |

#### CHAT-002 — Chat error + Try again
| Field | Detail |
|-------|--------|
| **Preconditions** | Pro; induce API failure (offline mid-send or 5xx). |
| **Steps** | 1. Send message while API failing. 2. Tap **Try again** on InlineError. |
| **Expected Result** | InlineError shown; retry works when API recovers; no stuck typing forever. |
| **Pass/Fail** | |
| **Notes** | |

#### CHAT-003 — Empty send blocked
| Field | Detail |
|-------|--------|
| **Preconditions** | Pro on Chat. |
| **Steps** | 1. Attempt send with empty composer. |
| **Expected Result** | Send disabled or no empty message posted. |
| **Pass/Fail** | |
| **Notes** | |

#### CHAT-004 — Free user cannot bypass gate
| Field | Detail |
|-------|--------|
| **Preconditions** | Free user. |
| **Steps** | 1. Open Chat. 2. Confirm no composer behind lock. |
| **Expected Result** | Only PremiumLockGate; no free unlimited chat in UI. |
| **Pass/Fail** | |
| **Notes** | |

---

### 5.12 Daily Guidance (`DG`)

#### DG-001 — Today's Guidance on Home
| Field | Detail |
|-------|--------|
| **Preconditions** | Signed-in; ritual done; online. |
| **Steps** | 1. Open Home. 2. Locate guidance card. |
| **Expected Result** | Eyebrow **Today's Guidance**; content loads (may briefly show **Gathering today’s guidance…**). |
| **Pass/Fail** | |
| **Notes** | Free feature. |

#### DG-002 — Cache-first / offline fallback
| Field | Detail |
|-------|--------|
| **Preconditions** | Previously loaded guidance; then go offline. |
| **Steps** | 1. Airplane mode. 2. Relaunch or refresh Home. |
| **Expected Result** | Shows cached or palm-based fallback; soft error like couldn’t refresh — not a hard blank crash. |
| **Pass/Fail** | |
| **Notes** | |

#### DG-003 — No palm fallback still shows card
| Field | Detail |
|-------|--------|
| **Preconditions** | Signed-in user without palm if reachable, or new account path. |
| **Steps** | 1. View Home guidance area. |
| **Expected Result** | Fallback insight / CTA to begin reading; no crash. |
| **Pass/Fail** | |
| **Notes** | |

#### DG-004 — Weekly guidance card (weekend window)
| Field | Detail |
|-------|--------|
| **Preconditions** | Test on weekend window when weekly card appears. |
| **Steps** | 1. Open Home. |
| **Expected Result** | **This Week's Guidance** (or writing state) appears in window; outside window mark N/A. |
| **Pass/Fail** | |
| **Notes** | |

---

### 5.13 Tasks (`TASK`)

#### TASK-001 — Pro rituals list
| Field | Detail |
|-------|--------|
| **Preconditions** | Pro; reading exists. |
| **Steps** | 1. Open Tasks. 2. Open a ritual detail `/task/[id]`. 3. Complete reflection if prompted. |
| **Expected Result** | **Today’s Rituals** list; detail opens; progress updates; completion copy when all done. |
| **Pass/Fail** | |
| **Notes** | |

#### TASK-002 — Free user locked
| Field | Detail |
|-------|--------|
| **Preconditions** | Free user. |
| **Steps** | 1. Open Tasks. |
| **Expected Result** | Pro lock gate only. |
| **Pass/Fail** | |
| **Notes** | |

#### TASK-003 — No reading state (Pro)
| Field | Detail |
|-------|--------|
| **Preconditions** | Pro without palm reading if possible. |
| **Steps** | 1. Open Tasks. |
| **Expected Result** | **Rituals unlock after your reading** / **Continue setup**. |
| **Pass/Fail** | |
| **Notes** | |

#### TASK-004 — API failure → local fallback
| Field | Detail |
|-------|--------|
| **Preconditions** | Pro; API down. |
| **Steps** | 1. Open Tasks offline / API fail. |
| **Expected Result** | Local/fallback rituals list; reflection sync failure notice if saving while offline; no crash. |
| **Pass/Fail** | |
| **Notes** | |

#### TASK-005 — All complete cancels daily reminder
| Field | Detail |
|-------|--------|
| **Preconditions** | Pro; notifications granted; incomplete rituals earlier scheduled reminder. |
| **Steps** | 1. Complete all rituals. |
| **Expected Result** | Completion message; daily reminder cancelled (no further **Your daily tasks** for that schedule until new day/tasks). |
| **Pass/Fail** | |
| **Notes** | Hard to fully verify timing — note evidence. |

---

### 5.14 Compatibility (`COMP`)

#### COMP-001 — Pro compatibility happy path
| Field | Detail |
|-------|--------|
| **Preconditions** | Pro; own reading exists. |
| **Steps** | 1. Open Compatibility. 2. Add partner via camera or gallery. 3. Complete partner analysis. |
| **Expected Result** | Affinity score, dimensions, summary; privacy note about matching-only analysis; optional Guide entry. |
| **Pass/Fail** | |
| **Notes** | |

#### COMP-002 — Partner analysis failure / retake
| Field | Detail |
|-------|--------|
| **Preconditions** | Pro; bad partner photo. |
| **Steps** | 1. Submit unreadable partner palm. |
| **Expected Result** | Same retake pattern as onboarding; can retry. |
| **Pass/Fail** | |
| **Notes** | |

#### COMP-003 — Free user locked
| Field | Detail |
|-------|--------|
| **Preconditions** | Free user. |
| **Steps** | 1. Open Compatibility. |
| **Expected Result** | **Compatibility is a Pro feature**. |
| **Pass/Fail** | |
| **Notes** | |

---

### 5.15 Profile (`PROF`)

#### PROF-001 — Profile hero and membership
| Field | Detail |
|-------|--------|
| **Preconditions** | Signed-in free or Pro. |
| **Steps** | 1. Open Profile. 2. Verify name, email, Signed in state, membership card. |
| **Expected Result** | Correct identity; Free/Pro membership; stats (streak, reports, chats, plan) render. |
| **Pass/Fail** | |
| **Notes** | |

#### PROF-002 — Journey / timeline
| Field | Detail |
|-------|--------|
| **Preconditions** | Online; signed-in with history if any. |
| **Steps** | 1. Scroll Journey section. |
| **Expected Result** | Weekly chapter / timeline loads or empty gracefully. |
| **Pass/Fail** | |
| **Notes** | |

#### PROF-003 — Reading shortcuts
| Field | Detail |
|-------|--------|
| **Preconditions** | Profile. |
| **Steps** | 1. Tap **Palm report**. 2. Tap **Compatibility** (Pro). |
| **Expected Result** | Routes to correct screens with gates applied. |
| **Pass/Fail** | |
| **Notes** | |

#### PROF-004 — About: legal and version
| Field | Detail |
|-------|--------|
| **Preconditions** | Profile. |
| **Steps** | 1. Open **Privacy policy**. 2. Open **Terms of use**. 3. Confirm **Version** shows `1.0.0` (or RC1 build string). |
| **Expected Result** | Legal pages open; version accurate for RC1. |
| **Pass/Fail** | |
| **Notes** | |

#### PROF-005 — Share
| Field | Detail |
|-------|--------|
| **Preconditions** | Profile. |
| **Steps** | 1. Tap **Share**. |
| **Expected Result** | System share sheet opens; cancel safe. |
| **Pass/Fail** | |
| **Notes** | |

#### PROF-006 — Cloud backup row (signed-in)
| Field | Detail |
|-------|--------|
| **Preconditions** | Signed-in. |
| **Steps** | 1. Locate **Cloud backup** row / action. 2. Trigger if actionable. |
| **Expected Result** | Indicates backup state or triggers sync without crash. |
| **Pass/Fail** | |
| **Notes** | |

---

### 5.16 Settings via Profile (`SET`)

#### SET-001 — Edit profile
| Field | Detail |
|-------|--------|
| **Preconditions** | Signed-in. |
| **Steps** | 1. Profile → **Edit profile**. 2. Change name and/or gender and focus topics. 3. Save. 4. Return to Profile / Home. |
| **Expected Result** | Changes persist locally and sync via profile PATCH when online; hero updates. |
| **Pass/Fail** | |
| **Notes** | |

#### SET-002 — Manage subscription
| Field | Detail |
|-------|--------|
| **Preconditions** | Profile; Android with Play. |
| **Steps** | 1. Tap **Manage subscription**. |
| **Expected Result** | Opens Play subscription management (or appropriate store UI); returns safely. |
| **Pass/Fail** | |
| **Notes** | |

#### SET-003 — Check subscription status (settings path)
| Field | Detail |
|-------|--------|
| **Preconditions** | Same as PREM-007. |
| **Steps** | 1. Profile → **Check subscription status**. |
| **Expected Result** | Status refresh completes; UI reflects Free/Pro accurately. |
| **Pass/Fail** | |
| **Notes** | Duplicate intentional for settings section coverage. |

#### SET-004 — Start over — Replay setup
| Field | Detail |
|-------|--------|
| **Preconditions** | Signed-in with reading. |
| **Steps** | 1. Profile → **Start over**. 2. Choose **Replay setup**. |
| **Expected Result** | Alert **Start over?**; replay clears ritual progress but keeps profile; returns toward palm-scan (or earlier). |
| **Pass/Fail** | |
| **Notes** | |

#### SET-005 — Start over — Start fresh
| Field | Detail |
|-------|--------|
| **Preconditions** | Device with local data. |
| **Steps** | 1. **Start over** → **Start fresh**. |
| **Expected Result** | Signs out, wipes local demo/session/chat, new identity, lands **Welcome**. |
| **Pass/Fail** | |
| **Notes** | Destructive — use throwaway account/device data. |

---

### 5.17 Logout (`LOUT`)

#### LOUT-001 — Sign out keeps local reading
| Field | Detail |
|-------|--------|
| **Preconditions** | Signed-in with local reading. |
| **Steps** | 1. Profile → **Sign out**. 2. Confirm **Sign out?** dialog. 3. Note copy about reading staying on device. |
| **Expected Result** | Supabase session cleared; navigates to **Welcome**; `hasEnteredMain` false; local reading still on device (not full wipe). |
| **Pass/Fail** | |
| **Notes** | |

#### LOUT-002 — Re-sign-in after logout
| Field | Detail |
|-------|--------|
| **Preconditions** | After LOUT-001. |
| **Steps** | 1. Sign in again with same account. |
| **Expected Result** | Merge/restore; can re-enter main; reading available. |
| **Pass/Fail** | |
| **Notes** | |

---

### 5.18 Delete Account (`DEL`)

#### DEL-001 — Delete account confirmation
| Field | Detail |
|-------|--------|
| **Preconditions** | Signed-in disposable test account. |
| **Steps** | 1. Profile → **Delete account**. 2. Read **Delete account?** warning. 3. Cancel once. 4. Confirm delete. |
| **Expected Result** | Cancel aborts; confirm calls server delete, wipes local stores, new identity, **Welcome**. |
| **Pass/Fail** | |
| **Notes** | **Destructive.** |

#### DEL-002 — Server data removed
| Field | Detail |
|-------|--------|
| **Preconditions** | After DEL-001; know prior user id / email. |
| **Steps** | 1. Attempt sign-in with deleted account. 2. If signup allowed, create new account same email only if Auth allows. |
| **Expected Result** | Old auth user gone or cannot restore prior sessions/palms; new user does not see old reading. |
| **Pass/Fail** | |
| **Notes** | Verify via app + optional backend/admin. |

#### DEL-003 — Delete not available when signed out
| Field | Detail |
|-------|--------|
| **Preconditions** | Signed-out / Welcome. |
| **Steps** | 1. Confirm Delete account is not offered without session (only after sign-in on Profile). |
| **Expected Result** | Delete is signed-in-only. |
| **Pass/Fail** | |
| **Notes** | |

---

### 5.19 Offline Mode (`OFF`)

#### OFF-001 — Airplane mode on Home
| Field | Detail |
|-------|--------|
| **Preconditions** | Signed-in; previously online. |
| **Steps** | 1. Enable airplane mode. 2. Use Home. |
| **Expected Result** | Guidance fallback/cache; no crash; sync notice may appear. |
| **Pass/Fail** | |
| **Notes** | |

#### OFF-002 — Offline chat (Pro)
| Field | Detail |
|-------|--------|
| **Preconditions** | Pro; airplane mode. |
| **Steps** | 1. Send chat message. |
| **Expected Result** | Error + Try again; no freeze. |
| **Pass/Fail** | |
| **Notes** | |

#### OFF-003 — Offline analysis path
| Field | Detail |
|-------|--------|
| **Preconditions** | Capture palm then go offline before/during analysis (or entire offline). |
| **Steps** | 1. Run analysis offline. |
| **Expected Result** | Provisional/simulated reading path; preview reachable; no crash. |
| **Pass/Fail** | |
| **Notes** | |

#### OFF-004 — Offline tasks fallback (Pro)
| Field | Detail |
|-------|--------|
| **Preconditions** | Pro; offline. |
| **Steps** | 1. Open Tasks. |
| **Expected Result** | Local fallback list; sync failure on reflection if attempted. |
| **Pass/Fail** | |
| **Notes** | |

#### OFF-005 — Offline paywall / purchase
| Field | Detail |
|-------|--------|
| **Preconditions** | Signed-in free; offline. |
| **Steps** | 1. Attempt Unlock Premium. |
| **Expected Result** | Clear network error; no false entitlement. |
| **Pass/Fail** | |
| **Notes** | |

---

### 5.20 Slow Network (`SLOW`)

#### SLOW-001 — Throttled analysis
| Field | Detail |
|-------|--------|
| **Preconditions** | Network throttled (e.g. Slow 3G via proxy). |
| **Steps** | 1. Run palm analysis. |
| **Expected Result** | Stages remain responsive; eventually succeed or show timeout/mapped error with retry — no ANR/crash. |
| **Pass/Fail** | |
| **Notes** | |

#### SLOW-002 — Throttled chat
| Field | Detail |
|-------|--------|
| **Preconditions** | Pro; slow network. |
| **Steps** | 1. Send message. |
| **Expected Result** | Typing indicator; reply or timeout copy; recoverable. |
| **Pass/Fail** | |
| **Notes** | |

#### SLOW-003 — Paywall confirm under latency
| Field | Detail |
|-------|--------|
| **Preconditions** | After payment return; slow network. |
| **Steps** | 1. Observe confirm retries. |
| **Expected Result** | Processing state; pending alert if needed; eventual entitlement or actionable check status — no silent unlock failure without message. |
| **Pass/Fail** | |
| **Notes** | |

---

### 5.21 API Failure (`API`)

#### API-001 — Unreachable API host
| Field | Detail |
|-------|--------|
| **Preconditions** | Point to dead host or block domain (staging). |
| **Steps** | 1. Use Home, Chat, Tasks. |
| **Expected Result** | Mapped network errors; device-saved notice where applicable; app navigable. |
| **Pass/Fail** | |
| **Notes** | |

#### API-002 — HTTP 5xx on guidance
| Field | Detail |
|-------|--------|
| **Preconditions** | Can stub 502/503 or use failing staging. |
| **Steps** | 1. Refresh Home guidance. |
| **Expected Result** | Retry once where implemented; fallback content; soft error. |
| **Pass/Fail** | |
| **Notes** | |

#### API-003 — Auth token rejected
| Field | Detail |
|-------|--------|
| **Preconditions** | Expired/invalid session if simulatable. |
| **Steps** | 1. Trigger authenticated API call. |
| **Expected Result** | Auth error handling; user can re-sign-in; no crash loop. |
| **Pass/Fail** | |
| **Notes** | |

#### API-004 — Rate limit messaging
| Field | Detail |
|-------|--------|
| **Preconditions** | Hit rate limit on palm/chat if staging allows. |
| **Steps** | 1. Trigger limited endpoint repeatedly. |
| **Expected Result** | User-facing rate limit copy; recover after window. |
| **Pass/Fail** | |
| **Notes** | Blocked if cannot induce. |

---

### 5.22 AI Failure (`AIF`)

#### AIF-001 — Palm AI unreadable (duplicate critical path)
| Field | Detail |
|-------|--------|
| **Preconditions** | Blurry palm. |
| **Steps** | 1. Analyze. |
| **Expected Result** | Retry UI with **Retake photo** — same as AI-003. |
| **Pass/Fail** | |
| **Notes** | Regression guard for RC1. |

#### AIF-002 — Chat model / upstream timeout
| Field | Detail |
|-------|--------|
| **Preconditions** | Pro; force long timeout (slow or staging). |
| **Steps** | 1. Send message that times out. |
| **Expected Result** | Guide timeout / mapped API error; Try again; composer usable. |
| **Pass/Fail** | |
| **Notes** | |

#### AIF-003 — Predictions AI failure offline fallback
| Field | Detail |
|-------|--------|
| **Preconditions** | Pro on Predictions; API fail. |
| **Steps** | 1. Load predictions while API failing. |
| **Expected Result** | Local/deterministic fallback or clear error — no blank crash. |
| **Pass/Fail** | |
| **Notes** | |

---

### 5.23 App Restart (`RST`)

#### RST-001 — Restart mid-onboarding
| Field | Detail |
|-------|--------|
| **Preconditions** | On goals or palm-scan. |
| **Steps** | 1. Force stop. 2. Relaunch. |
| **Expected Result** | Resumes appropriate onboarding step; data retained. |
| **Pass/Fail** | |
| **Notes** | |

#### RST-002 — Restart mid-analysis
| Field | Detail |
|-------|--------|
| **Preconditions** | Analysis in progress. |
| **Steps** | 1. Force stop during analyzing. 2. Relaunch. |
| **Expected Result** | Recovers to safe screen (palm-scan / preview / resume); no corrupt stuck state. |
| **Pass/Fail** | |
| **Notes** | |

#### RST-003 — Restart mid-chat
| Field | Detail |
|-------|--------|
| **Preconditions** | Pro; chat history present. |
| **Steps** | 1. Force stop. 2. Relaunch → Chat. |
| **Expected Result** | Returns to main; chat history restored per persistence rules. |
| **Pass/Fail** | |
| **Notes** | |

#### RST-004 — Restart during purchase pending
| Field | Detail |
|-------|--------|
| **Preconditions** | Paid but confirm pending. |
| **Steps** | 1. Kill app. 2. Relaunch. 3. Check subscription / paywall. |
| **Expected Result** | Can recover entitlement via confirm/check status; no double charge required. |
| **Pass/Fail** | |
| **Notes** | |

---

### 5.24 App Upgrade (`UPG`)

#### UPG-001 — Upgrade over prior install
| Field | Detail |
|-------|--------|
| **Preconditions** | Older build installed with signed-in session + reading (if available); RC1 APK ready. |
| **Steps** | 1. Install RC1 over existing app (do not uninstall). 2. Launch. |
| **Expected Result** | Session store migrates / `agastya-session-v3` retained; user not forced through full wipe; Home or correct resume. |
| **Pass/Fail** | |
| **Notes** | |

#### UPG-002 — Premium entitlement after upgrade
| Field | Detail |
|-------|--------|
| **Preconditions** | Pro on prior build. |
| **Steps** | 1. Upgrade to RC1. 2. Open Chat / full report. |
| **Expected Result** | Still Pro after bootstrap; no false downgrade without expiry. |
| **Pass/Fail** | |
| **Notes** | |

#### UPG-003 — Deep links still resolve
| Field | Detail |
|-------|--------|
| **Preconditions** | RC1 installed. |
| **Steps** | 1. Open `agastya://` auth/billing return style link if testable. |
| **Expected Result** | App opens correct handler (callback / paywall). |
| **Pass/Fail** | |
| **Notes** | |

---

### 5.25 Device Rotation (`ROT`)

> App defaults to portrait (`orientation: portrait`). Record whether rotation is locked.

#### ROT-001 — Palm camera under orientation change
| Field | Detail |
|-------|--------|
| **Preconditions** | On palm-scan; device allows rotate or confirm lock. |
| **Steps** | 1. Attempt landscape. 2. Return portrait. |
| **Expected Result** | If locked: stays portrait. If allowed: camera UI does not crash; capture still works. |
| **Pass/Fail** | |
| **Notes** | |

#### ROT-002 — Chat composer rotation
| Field | Detail |
|-------|--------|
| **Preconditions** | Pro Chat. |
| **Steps** | 1. Rotate if possible. 2. Type and send. |
| **Expected Result** | No layout crash; input usable. |
| **Pass/Fail** | |
| **Notes** | |

#### ROT-003 — Report tabs rotation
| Field | Detail |
|-------|--------|
| **Preconditions** | Full report open (Pro). |
| **Steps** | 1. Switch tabs; rotate if allowed. |
| **Expected Result** | Content remains; no data loss. |
| **Pass/Fail** | |
| **Notes** | |

#### ROT-004 — Paywall rotation
| Field | Detail |
|-------|--------|
| **Preconditions** | Paywall visible. |
| **Steps** | 1. Rotate if allowed. |
| **Expected Result** | CTAs remain tappable; no crash. |
| **Pass/Fail** | |
| **Notes** | |

---

### 5.26 Background / Foreground (`BF`)

#### BF-001 — Camera background resume
| Field | Detail |
|-------|--------|
| **Preconditions** | Palm camera open. |
| **Steps** | 1. Home button / recent apps. 2. Return to Agastya. |
| **Expected Result** | Camera session recovers or prompts retake; no hard freeze. |
| **Pass/Fail** | |
| **Notes** | |

#### BF-002 — OAuth background return
| Field | Detail |
|-------|--------|
| **Preconditions** | Mid Google OAuth in browser. |
| **Steps** | 1. Background app during browser. 2. Complete OAuth. 3. Return. |
| **Expected Result** | Session completes; no stuck Signing in. |
| **Pass/Fail** | |
| **Notes** | |

#### BF-003 — Razorpay browser return
| Field | Detail |
|-------|--------|
| **Preconditions** | Checkout open in browser. |
| **Steps** | 1. Background Agastya. 2. Complete or cancel payment. 3. Return via deep link. |
| **Expected Result** | Paywall handles success/cancel/pending correctly. |
| **Pass/Fail** | |
| **Notes** | |

#### BF-004 — Analysis backgrounded
| Field | Detail |
|-------|--------|
| **Preconditions** | Analysis running. |
| **Steps** | 1. Background for 30s. 2. Foreground. |
| **Expected Result** | Completes or shows recoverable error; not infinite spinner without action. |
| **Pass/Fail** | |
| **Notes** | |

#### BF-005 — Multitasking during chat reply
| Field | Detail |
|-------|--------|
| **Preconditions** | Pro; message in flight. |
| **Steps** | 1. Background while waiting for reply. 2. Foreground. |
| **Expected Result** | Reply appears or error/retry; UI consistent. |
| **Pass/Fail** | |
| **Notes** | |

---

### 5.27 Push Notifications (`PUSH`)

> Local notifications only. **N/A** on Web and Expo Go.

#### PUSH-001 — Permission request
| Field | Detail |
|-------|--------|
| **Preconditions** | Fresh permission state; native RC1 build. |
| **Steps** | 1. Enter main after onboarding. 2. Accept or deny. |
| **Expected Result** | System prompt; deny does not block app. |
| **Pass/Fail** | |
| **Notes** | |

#### PUSH-002 — Reading ready notification tap
| Field | Detail |
|-------|--------|
| **Preconditions** | Notifications allowed; complete analysis. |
| **Steps** | 1. Wait for **Your palm reading is ready**. 2. Tap notification (app backgrounded or killed). |
| **Expected Result** | Opens report route (`/report` deep link data); respects Pro gate (full vs preview). |
| **Pass/Fail** | |
| **Notes** | |

#### PUSH-003 — Daily tasks reminder tap
| Field | Detail |
|-------|--------|
| **Preconditions** | Pro; incomplete rituals; reminder scheduled (~9:00 local) OR trigger via test clock if available. |
| **Steps** | 1. Receive **Your daily tasks** / **You have tasks waiting for today. Tap to open them.** 2. Tap. |
| **Expected Result** | Opens Tasks tab; Pro gate respected if somehow free. |
| **Pass/Fail** | |
| **Notes** | May require waiting until 9:00 or device time change — document method. |

#### PUSH-004 — Foreground notification display
| Field | Detail |
|-------|--------|
| **Preconditions** | Notification fires while app foregrounded. |
| **Steps** | 1. Trigger reading-ready while staying in app. |
| **Expected Result** | Banner/list per handler config; no crash. |
| **Pass/Fail** | |
| **Notes** | |

#### PUSH-005 — Notifications disabled path
| Field | Detail |
|-------|--------|
| **Preconditions** | Deny notifications. |
| **Steps** | 1. Complete analysis and use Tasks. |
| **Expected Result** | App fully usable; reminders simply do not appear. |
| **Pass/Fail** | |
| **Notes** | |

---

## 6. Execution Matrix (optional roll-up)

| Area | IDs | Pass | Fail | Blocked | N/A |
|------|-----|------|------|---------|-----|
| Installation | INST-001–005 | | | | |
| Fresh user | FRESH-001–005 | | | | |
| Returning user | RET-001–005 | | | | |
| Guest / anonymous | GUEST-001–004 | | | | |
| Authentication | AUTH-001–010 | | | | |
| Palm Scan | PALM-001–006 | | | | |
| AI Analysis | AI-001–006 | | | | |
| Report | RPT-001–006 | | | | |
| Premium | PREM-001–010 | | | | |
| Razorpay | RZ-001–007 | | | | |
| Chat | CHAT-001–004 | | | | |
| Daily Guidance | DG-001–004 | | | | |
| Tasks | TASK-001–005 | | | | |
| Compatibility | COMP-001–003 | | | | |
| Profile | PROF-001–006 | | | | |
| Settings | SET-001–005 | | | | |
| Logout | LOUT-001–002 | | | | |
| Delete Account | DEL-001–003 | | | | |
| Offline | OFF-001–005 | | | | |
| Slow Network | SLOW-001–003 | | | | |
| API Failure | API-001–004 | | | | |
| AI Failure | AIF-001–003 | | | | |
| App Restart | RST-001–004 | | | | |
| App Upgrade | UPG-001–003 | | | | |
| Rotation | ROT-001–004 | | | | |
| Background/Foreground | BF-001–005 | | | | |
| Push Notifications | PUSH-001–005 | | | | |
| **Total** | **~120** | | | | |

---

## 7. Known RC1 testing notes

1. **Guest** = anonymous local session through ritual; main tabs require Supabase sign-in when configured.
2. **Premium does not block Home**; it blocks Chat, Tasks, Compatibility, and full report.
3. **Razorpay** is Android (India) primary; validate production builds do **not** ship with test bypass enabled.
4. **Push** is local-only; there is no remote FCM/APNs campaign path in-app for RC1.
5. Portrait lock may make rotation cases mostly “stays portrait” — still record Pass if stable.
6. File bugs with: Test ID, severity, device, build ID, steps, expected vs actual, screenshots/logs.

---

*End of Agastya RC1 Manual QA Checklist*

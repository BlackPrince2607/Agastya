# Track 1.5 — Android Alternative Billing Feasibility Memo

**Status:** PENDING (run on EAS/internal Android build; not Expo Go)

**Date:**  
**Engineer:**  
**Build / track:**  
**Play enrollment:** yes / no / blocked  

## Questions

| # | Question | Answer (evidence) | Pass? |
|---|---|---|---|
| 1 | Can RevenueCat manage Play purchases with User Choice? | | |
| 2 | Coexist without destructive dual BillingClient? | | |
| 3 | BillingManager changes required? | | |
| 4 | Entitlement system unchanged? | | |
| 5 | What can be reused? | | |
| 6 | What must be replaced? | | |

## Runs

### Play choice (repeat ≥3)

| # | Device | BillingResult / outcome | Second sheet? | RC entitled &lt;60s | Server isPremium | Notes |
|---|---|---|---|---|---|---|
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |

### Alternative choice (token only)

| Device | Token received? | Crash? | Notes |
|---|---|---|---|
| | | | |

### Control: normal RC purchase (User Choice not invoked)

| Device | OK? | Notes |
|---|---|---|
| | | |

## Verdict

- [ ] **PASS** — proceed to Track 2 with proven sync/ownership pattern  
- [ ] **FAIL** — do not start Track 2; use alternate (default: Android RC-only, web Razorpay)

## Recommended next step

(Write after runs.)

## Logs / attachments

(Paste key log lines from `app/billing-spike` screen.)

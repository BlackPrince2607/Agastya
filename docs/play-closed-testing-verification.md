# Closed Testing verification checklist

Generated after implementing one-time Premium + Play readiness fixes.

## Automated (done in repo)

| Check | Result |
|-------|--------|
| Backend billing config returns `lifetime` plan | Pass (`test_billing_config_india_android`) |
| Play product verify helper exists | Pass |
| RTDN one-time unknown token ignored | Pass |
| Razorpay create/confirm + webhook tests | Pass |
| Account delete API tests | Pass |
| pytest suite (billing + delete) | **29 passed** |

## Manual / ops (before submit)

| Check | How | Status |
|-------|-----|--------|
| Deploy `legal/` to sharvo.online | See `legal/README.md` | Pending (hosting) |
| Privacy/terms/support/delete-account return 200 | `curl -I https://sharvo.online/...` | Pending |
| Fix live `assetlinks.json` package → `com.agastya.app` | Host example from `docs/assetlinks.json.example` | Pending |
| Create Play subscriptions `premium_monthly` / `premium_annual` | Play Console | Pending |
| Enroll User Choice Billing (India) | Play Console | Pending |
| Set Railway monthly/annual paise + `BILLING_RAZORPAY_TEST_BYPASS=false` | Railway env | Pending |
| Set Railway `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` + RTDN token | Railway env | Pending |
| Capture phone screenshots into `store-assets/play/screenshots/` | Device / emulator | Pending |
| Fill Data Safety from `docs/play-console-data-safety.md` | Play Console | Pending |
| EAS production AAB with bypass **false** | `eas build -p android --profile production` | Pending |
| Submit to internal/closed track | `eas submit -p android --profile closed-testing` | Pending |
| Paywall: one price + User Choice | Physical Android build | Pending |
| Razorpay path opens Payment Link webpage | Sign-in → Unlock → Alternative | Pending |
| Play path grants lifetime premium | Unlock → Play → verify | Pending |

## Code / config snapshots

- Product IDs: `EXPO_PUBLIC_PLAY_PRODUCT_MONTHLY=premium_monthly`, `…_ANNUAL=premium_annual`
- Production bypass: `EXPO_PUBLIC_BILLING_RAZORPAY_TEST_BYPASS=false` in `eas.json` production
- Submit track for CT: `eas.json` → `submit.closed-testing.android.track = internal`
- Legal URLs: `constants/legal.ts` → sharvo.online
- Listing art: `store-assets/play/feature-graphic-1024x500.png`, `icon-512.png`

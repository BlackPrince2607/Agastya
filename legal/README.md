# Agastya legal / support static site (sharvo.online)

Deploy this `legal/` folder as a **separate** static project (Vercel, Cloudflare Pages, or Netlify) pointed at **sharvo.online**.

## In-app vs Play Console

- **In the app:** Profile → Privacy / Terms / Support open `/legal/[doc]` screens (copy in `constants/legalContent.ts`).
- **Play Console:** use public URLs below after hosting on Railway (custom domain) or Vercel.

When you update your Google Doc, paste the same text into `constants/legalContent.ts` **and** `legal/*.html` so app and web stay aligned.

## Required URLs

| Path | File |
|------|------|
| https://sharvo.online/privacy | privacy.html |
| https://sharvo.online/terms | terms.html |
| https://sharvo.online/support | support.html |
| https://sharvo.online/delete-account | delete-account.html |

`vercel.json` provides clean URL rewrites on Vercel. `.htaccess` does the same on Apache/cPanel (GoDaddy Linux hosting).

**Play Console account deletion URL:** `https://sharvo.online/delete-account`

## Option A — Vercel (recommended)

```bash
cd legal
npx vercel --prod
```

Then assign the production domain `sharvo.online` (and `www` if needed) in the Vercel project settings.

## Option B — GoDaddy Linux / cPanel

Upload the contents of this `legal/` folder to `public_html/` (include `.htaccess` and all `*.html` files). Do **not** use GoDaddy Website Builder — it cannot serve custom paths like `/delete-account`.

## Option C — Railway backend (already in repo)

The FastAPI backend serves the same pages at the site root (no `/v1` prefix):

- `/delete-account`
- `/privacy`
- `/terms`
- `/support`

After deploy, either add **sharvo.online** as a custom domain on Railway (Settings → Networking), or temporarily use your Railway URL in Play Console until DNS is moved off GoDaddy Website Builder.

## Cloudflare Pages

- Build command: none
- Output directory: `.` (this folder)
- Add redirects for `/privacy` → `/privacy.html` (or enable pretty URLs)

## Verify before Play Console

```bash
curl -I https://sharvo.online/privacy
curl -I https://sharvo.online/terms
curl -I https://sharvo.online/support
curl -I https://sharvo.online/delete-account
```

All should return **200**.

## Play Console fields

- Privacy policy: `https://sharvo.online/privacy`
- Account deletion URL: `https://sharvo.online/delete-account`
- Support URL: `https://sharvo.online/support`

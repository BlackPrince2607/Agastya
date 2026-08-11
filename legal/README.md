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

- `/` (index)
- `/delete-account`
- `/privacy`
- `/terms`
- `/support`

The **root** `Dockerfile` (used by `railway.toml`) must `COPY legal/ /app/legal/`. After changing that, **redeploy** the Railway service so production stops returning `503 Legal pages are not available on this host`.

### GoDaddy DNS → Railway (required for Play Console URLs)

Play Console uses **apex** URLs (`https://sharvo.online/...`), not `www`.

1. **Railway → Settings → Networking → Custom Domains**
   - Add both `sharvo.online` **and** `www.sharvo.online`.
   - Copy the exact DNS targets Railway shows (CNAME host for `www`, and A/ALIAS or CNAME instructions for `@`).
2. **GoDaddy → DNS → Manage DNS** for `sharvo.online`
   - **Remove / disable Website Builder** DNS for `@` (today apex still points at GoDaddy DPS `Server: DPS/2.0.0` — that is why `/delete-account` 404s).
   - Set `www` **CNAME** → the Railway target (e.g. `xxxx.up.railway.app`).
   - Set apex (`@`) per Railway’s panel (A records or forwarding). Do **not** leave Website Builder A records (`13.248.x` / `76.223.x`).
   - Optional shortcut: GoDaddy **Domain Forwarding** `sharvo.online` → `https://www.sharvo.online` (301) **only if** `www` has a valid Railway TLS cert and you also update Play Console / `constants/legal.ts` to `www` — prefer fixing apex DNS instead.
3. Wait for Railway to show **Certificate active** for both hosts (TLS errors like “wrong principal” mean the cert is not ready or the hostname was not added).
4. Verify:

```powershell
curl.exe -sI https://sharvo.online/delete-account
curl.exe -sI https://www.sharvo.online/delete-account
curl.exe -sI https://agastya-production-b395.up.railway.app/delete-account
```

All should return **200** with `Server: railway-hikari` (not `DPS`).

If you enable `TRUSTED_HOSTS` in Railway variables, include:

`agastya-production-b395.up.railway.app,sharvo.online,www.sharvo.online`

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

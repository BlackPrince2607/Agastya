# Agastya legal / support static site (sharvo.online)

Deploy this `legal/` folder as a **separate** static project (Vercel, Cloudflare Pages, or Netlify) pointed at **sharvo.online**.

## Required URLs

| Path | File |
|------|------|
| https://sharvo.online/privacy | privacy.html |
| https://sharvo.online/terms | terms.html |
| https://sharvo.online/support | support.html |
| https://sharvo.online/delete-account | delete-account.html |

`vercel.json` in this folder provides clean URL rewrites for Vercel.

## Vercel (recommended)

```bash
cd legal
npx vercel --prod
```

Then assign the production domain `sharvo.online` (and `www` if needed) in the Vercel project settings.

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

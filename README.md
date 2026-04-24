# RoadCommand App

**Deploy URL:** app.roadcommand.co  
**Marketing site:** roadcommand.co (separate Netlify site — do not touch)

---

## File Structure

```
roadcommand-app/
  index.html        ← app shell (HTML only, no inline JS or CSS)
  app.js            ← all application JavaScript
  auth.js           ← Supabase authentication
  style.css         ← all CSS
  manifest.json     ← PWA manifest
  netlify.toml      ← Netlify config (subdomain, redirects, headers)
  .gitignore
  README.md
```

---

## Deployment Sequence

### ✅ Phase 1 — GitHub + Netlify (DO THIS NOW)

1. Push this repo to GitHub (already done if you're reading this)
2. Go to app.netlify.com → "Add new site" → "Import from Git"
3. Select your `roadcommand-app` repo
4. Build settings: leave blank (no build command, publish dir = `.`)
5. Deploy
6. In Netlify Site Settings → Domain Management → Add custom domain: `app.roadcommand.co`
7. In your DNS (wherever roadcommand.co is managed): add CNAME `app` → your Netlify URL

### 🔲 Phase 2 — Supabase Auth

1. Go to supabase.com → New Project → name it `roadcommand`
2. Copy your Project URL and anon key from: Project Settings → API
3. Open `auth.js` and replace:
   - `YOUR_PROJECT_ID` with your actual project ID
   - `YOUR_SUPABASE_ANON_KEY` with your actual anon key
4. In Supabase: Authentication → URL Configuration → set Site URL to `https://app.roadcommand.co`
5. Push changes → Netlify auto-deploys

### 🔲 Phase 3 — Test Full Auth Flow

- Open app.roadcommand.co
- Sign up with your email (levi@roadcommand.co)
- Confirm app loads correctly after login
- Test sign out and sign back in
- Verify tutorial says "Welcome, Levi" (pulls from email prefix until full_name is set)

### 🔲 Phase 4 — Stripe Subscriptions (Next Phase)

Stripe + Netlify Functions — handled separately.

### 🔲 Phase 5 — Truckstop + 123Loadboard APIs

Server-side via Netlify Functions — API keys stored in Netlify environment variables.

### 🔲 Phase 6 — PWA Icons

Replace the inline SVG icons with real PNG files:
- `icons/icon-192.png`
- `icons/icon-512.png`
Use the RC truck logo design already in the original HTML.

---

## Critical Dev Notes

1. **NEVER use apostrophes inside single-quoted JS strings** — causes SyntaxError.
   Use double quotes or avoid the apostrophe entirely.
   
2. **GPS deadhead** uses `window._gpsLat` / `window._gpsLon` set in `app.js` → `startGPS()`

3. **EIA fuel price** uses DEMO_KEY. Get a free key at eia.gov/opendata and add to Netlify env vars.
   Then update `app.js` → `fetchFuelPrice()` to read from `window._EIA_KEY`.

4. **Auth gate**: The app header, main content, and nav are hidden on load.
   `onAuthReady()` in `app.js` shows them after Supabase confirms the session.

5. **Tutorial name**: Pulls from `window._rcUserFirstName` (set in `auth.js` → `onAuthReady()`).

---

## Environment Variables (set in Netlify)

| Variable | Where to get it |
|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API |
| `SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `EIA_API_KEY` | eia.gov/opendata (free) |
| `STRIPE_SECRET_KEY` | stripe.com → Developers → API Keys |
| `TRUCKSTOP_API_KEY` | Truckstop SIA agreement (pending) |
| `LOADBOARD_API_KEY` | 123Loadboard (pending) |

Note: SUPABASE_URL and SUPABASE_ANON_KEY are currently hardcoded in auth.js (the anon key is safe to expose client-side). The others must stay server-side only.

---

## Beta Launch Checklist

- [ ] Netlify deploy live at app.roadcommand.co
- [ ] Supabase project created, keys in auth.js
- [ ] Can sign up and sign in
- [ ] App loads correctly after login
- [ ] Tutorial fires on first login
- [ ] GPS works on mobile
- [ ] Feedback button works
- [ ] Invite 15 beta testers


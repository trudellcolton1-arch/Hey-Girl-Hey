# Hey Girl

**H.E.Y. G.I.R.L.** — Helping Every Young Girl in Real Life.

Nonprofit website for **Hey Girl**, a Dallas–Fort Worth, Texas organization supporting women in domestic abuse situations.

Static site. No build step. Deploys anywhere (GitHub Pages, Netlify, Vercel, Cloudflare Pages).

## Brand

- Colors: pink `#e21b7c`, teal `#1aa3b5`, gold `#d9a21b` (see `:root` in `styles.css`).
- Pillars: Faith · Confidence · Purpose · Godfidence.
- Affirmation: *She is seen. She is loved. She is limitless.*
- Verse: Psalm 46:5.

## Structure

Multi-page static site. Clean URLs via `vercel.json` (`/about` serves `about.html`).

```
index.html            # Home: hero, three-column band, newsletter + contact
about.html            # Purpose, Mission, Vision, Pillars, Scriptures
team.html             # Officers, Board of Directors, S'HEROs (mentors)
get-help.html         # Domestic violence resources + safe browsing
support.html          # Give, Volunteer, Mentor, Pray, Partner
contact.html          # Contact form + info
404.html
assets/css/styles.css # Pink palette, Jost typeface, reference-style layout
assets/js/main.js     # Quick Exit, nav, form + donate placeholders
assets/img/team/      # Headshots: officers/board 4:5 or 1:1 at 800px; S'HEROs 1:1 at 800px
assets/img/           # logo.webp/.jpg, logo-sm.jpg, favicon.svg/.png, apple-touch-icon.png, og-image.jpg
```

Header and footer are duplicated in each page. To change them, edit every `.html` file (a `sed` across `*.html` works).

### Hero photo

The home hero is a pink gradient with the logo. To use a group photo instead, add class `hero--photo` to the `<section class="hero">` and set the image via `style="--hero-img:url('/assets/img/hero.jpg')"`, then allow inline styles in the CSP or move the URL into `styles.css`.

## Safety features (do not remove)

- **Quick Exit button** (fixed, bottom-right, every page) + **double-ESC** keyboard shortcut. Uses `location.replace` so the site is removed from Back history.
- **Hotline in the footer** of every page, plus a crisis bar on Get Help.
- **Safe browsing section** explaining history/incognito/device safety.
- Contact form asks "Is it safe to contact you this way?"
- Form inputs use `autocomplete="off"` to avoid leaving saved data on shared devices.

## PWA (installable app)

The site installs to the home screen on iOS and Android.

- `manifest.webmanifest`: name, icons (`assets/img/icon-*.png`), theme color, and three home-screen shortcuts: **I Need Help Now** (opens the panic sheet via `/?panic=1`), Get Help, Contact Us.
- `sw.js`: service worker. Precaches the shell (home, Get Help, offline page, CSS, JS, logo). HTML is network-first with cache fallback; images cache-first; `/api/*` is never cached. Bump `VERSION` in `sw.js` when you change the precache list.
- `offline.html`: shown for uncached pages with no connection. Call 911 and the hotline still work.
- Install banner (`#install-banner` in every page, logic in `main.js`): Android/Chrome shows an Install button; iOS shows "Tap Share, then Add to Home Screen." Dismissal is remembered in localStorage.
- Test install: Chrome DevTools → Application → Manifest shows no errors; Lighthouse PWA audit passes.

**Discreet mode (recommended for DV safety):** an app named "Hey Girl" with a pink icon is visible to anyone holding the phone. Consider a second manifest with a neutral name and icon (e.g. "Notes") served from a different start URL, so a girl can choose which to install. Not built yet.

## Panic button (home page)

A hot pink **I Need Help Now** button under the hero. Flow: confirm sheet (with Call 911 first) → browser GPS → `POST /api/panic` → the on-call team gets an SMS and email with a Google Maps link, the girl's optional name, phone, and note, and an alert ID. The girl sees the ID, Call 911, and Leave This Site.

- `api/panic.js` is a zero-dependency Vercel serverless function. SMS via Twilio, email via Resend, each enabled only when its env vars are set.
- **Enabled in Production as of 2026-10-17 (email channel). SMS pending Twilio registration.** Until then the button shows "The alert system is not turned on yet. Call 911 now."
- Copy `.env.example` into Vercel → Settings → Environment Variables → Production.
- Rate limit: 3 alerts per device per 10 minutes, 30 per hour site-wide. Durable across instances if Upstash Redis vars are set, otherwise per-instance.
- Origin check: only hghey.org and Vercel preview domains may call the API.
- Audit: each alert is logged to Vercel function logs (no IP) and, if Upstash is configured, kept for 24 hours under `panic:log:<ID>`.
- Geolocation is permitted via `Permissions-Policy: geolocation=(self)` in `vercel.json`. Do not remove.

### Before turning it on

1. **Written response protocol.** Who is on call, what they do when a text arrives, and the rule that nobody approaches a location alone or without police. The alert text itself says "Call 911 if there is immediate danger. Do not approach alone."
2. **On-call list, not everyone.** `ALERT_SMS_TO` should be 2 to 4 trained people on rotation, not the whole mentor roster.
3. **Twilio US SMS registration.** A2P 10DLC (business number) or toll-free verification. Unregistered traffic is filtered by carriers. Start this first; it can take weeks.
4. **Resend domain verification** for hghey.org so alert emails are not marked spam.
5. **Test alert** from a phone off wifi with location on, and one with location denied.
6. **Liability review** with the nonprofit's insurer and counsel. A rescue promise is a duty of care.

## Before launch (TODO)

- [ ] Verify every phone number in the **Local Shelters & Services** block.
- [ ] Replace placeholder phone `(000) 000-0000` and `@hghey.org` emails with real ones.
- [ ] Wire the contact form (Formspree, Netlify Forms, or Supabase Edge Function).
- [ ] Replace the Donate button href with a Stripe Payment Link.
- [ ] Add 501(c)(3) status and EIN to the Donate card once approved.
- [ ] Set real domain in `og:url`, JSON-LD `url`, `sitemap.xml`, `robots.txt`, and all `@hghey.org` emails once mailboxes exist.
- [ ] Write Privacy and Terms pages (footer links are placeholders).
- [ ] Never publish a shelter or safe-house address. Use a PO Box.

## Local preview

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

## Deploy (Vercel)

This repo is Vercel-ready. No framework, no build command.

1. Go to [vercel.com/new](https://vercel.com/new) and import `trudellcolton1-arch/Hey-Girl-Hey`.
2. Framework Preset: **Other**. Build Command: *(leave empty)*. Output Directory: *(leave empty, defaults to root)*.
3. Click **Deploy**. Every push to `master` auto-deploys; every branch gets a preview URL.
4. Add your domain under **Settings → Domains** and point DNS (`A 76.76.21.21` or `CNAME cname.vercel-dns.com`).

`vercel.json` sets:

- **Security headers**: CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Permissions-Policy`.
- **`Referrer-Policy: no-referrer`**: the Quick Exit destination (and any outbound link) never learns a visitor came from this site. Keep this.
- **Caching**: images under `/assets/img/` cached for a year. CSS, JS, and HTML always revalidate, so style changes show up on the next page load. The `?v=` on the stylesheet and script URLs busts any copies cached before this rule existed.
- **Clean URLs**: `/about.html` → `/about` when you add more pages.

### CSP gotcha

The Content-Security-Policy blocks inline `<script>` and any third-party script by default. When you add Stripe, a form backend, or analytics, add their domains to `script-src`, `connect-src`, and `frame-src` in `vercel.json` or they will silently fail. Test on a preview deploy first.

### Privacy note

Think twice before adding Vercel Analytics or any tracker. Visitor data on a domestic-violence site is sensitive. If you add analytics, make it cookieless and say so in the Privacy page.

### Alternative: GitHub Pages / Netlify

Also works with zero config: deploy from `/ (root)`. The headers in `vercel.json` will not apply there.

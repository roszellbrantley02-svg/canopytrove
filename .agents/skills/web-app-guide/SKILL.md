---
name: web-app-guide
description: >
  Comprehensive web app design, development, security, and accessibility guide built from deep
  research. Use this skill whenever working on Canopy Trove's web app (app.canopytrove.com) or
  any web-related task: responsive layout, PWA setup, OWASP security hardening, WCAG accessibility,
  Core Web Vitals performance, forms, navigation, trust signals, or deploying web changes.
  Also trigger when the user mentions "web design", "web app", "PWA", "accessibility", "WCAG",
  "security headers", "OWASP", "responsive", "SEO", "Core Web Vitals", "service worker",
  "passkeys", "WebAuthn", "CORS", "CSRF", "supply chain", "SRI", "observability", "push
  notifications", "cookie consent", "privacy by design", "hreflang", "structured data",
  or any web deployment, hosting, or browser-specific issue.
---

# Web App Guide

A research-backed reference for building, securing, and polishing web applications.
Tailored for Canopy Trove but the principles are universal.

## What a Web App Is

A web app is an application delivered through the browser. If you want it to feel more like an
installable native app, you make it a Progressive Web App (PWA) by adding a web app manifest,
a service worker, and serving over HTTPS.

## How to Build One — The Practical Order

1. **Build the frontend.** HTML/CSS/JS or a framework (React, Next.js, Vite). Make it responsive
   for phone and desktop from the start — not as an afterthought.
2. **Build the backend/API.** Auth, database access, business logic, file uploads, notifications.
3. **Put it on HTTPS.** Required for service workers, secure browser APIs, and OWASP baseline.
4. **Make it a PWA** (optional but recommended for app-like install behavior):
   - Add `manifest.json` with icons
   - Register a service worker
   - Define offline/cache behavior
   - Test installability on Android, iPhone, and Desktop
5. **Add analytics and monitoring.** Page views, route views, signup starts, failures, backend errors.

## Responsive Design

Responsive design is not a desktop layout "shrunk down." It's an approach where layout, typography,
media, and interactions adapt to viewport and input method.

- Use mobile-first, content-first layouts
- Build with semantic HTML first, then CSS, then JS
- Test on real devices, not just browser resizing

→ For deeper guidance: `references/accessibility-and-design.md`

## Security — OWASP Baseline

Use OWASP as the security foundation. Every web app needs these:

### The Non-Negotiables

- **HTTPS everywhere.** No exceptions, even for "low-security" pages.
- **Secure cookies.** `Secure`, `HttpOnly`, appropriate `SameSite` settings for session cookies.
- **Server-managed sessions.** Prefer server-managed sessions or secure auth flows over exposing
  long-lived tokens in the browser.
- **Per-resource authorization.** Enforce authorization per object/resource, not just "is logged in."
- **XSS defense.** Output encoding + a real Content Security Policy (CSP).
- **Security headers.** Helmet.js or equivalent. Set CSP, HSTS, X-Content-Type-Options,
  X-Frame-Options, Referrer-Policy.
- **Secrets off the client.** Anything in frontend code is public. Use backend gateway patterns.
- **Server-side validation.** Validate uploads, file types, and API payloads on the server.
- **Rate limiting.** Login, signup, password reset, and abuse-prone endpoints.
- **Dependency hygiene.** Keep dependencies patched, scan regularly.
- **Logging.** Log security-relevant events and alert on failures.

→ For the full checklist with OWASP source links: `references/security-checklist.md`

#### Canopy Trove Specifics

Canopy Trove already implements several of these patterns:

- Custom security headers (HSTS, CSP `default-src 'none'`, X-Frame-Options DENY, Permissions-Policy)
- Backend gateway pattern for API keys (Google Maps, GIPHY)
- Firebase Auth with JWT token verification
- Custom input validation with prototype pollution protection
- Structured JSON logging with Pino
- `expo-secure-store` for tokens on native
- Timing-safe API key comparison (crypto.timingSafeEqual)
- IP-based brute force detection (10 failures → 30 min block)
- Content-type enforcement on mutation endpoints
- Rate limiting: 600/min reads, 180/min writes, 10/10min admin
- HTML sanitization and null-byte stripping on stored content

Gaps to watch: passkey/WebAuthn support, SRI on external scripts, service worker for PWA,
CI dependency auditing, frontend CSP for Firebase Hosting, web-vitals field measurement.

## Accessibility — WCAG 2.2

Accessibility is core design work, not polish added at the end. WCAG 2.2 is the current baseline.

### Key Requirements

- **Contrast:** At least 4.5:1 for normal text
- **Touch targets:** 24×24 CSS px minimum with spacing (W3C guidance), Canopy Trove uses 48dp
- **Keyboard access:** Every control must be keyboard-accessible and visibly focusable
- **Semantic HTML:** Use real headings, links, buttons, forms, and landmarks before ARIA
- **ARIA is for gaps:** Only use ARIA when native HTML can't cover it. ARIA doesn't create
  accessibility by itself.
- **Motion:** Honor `prefers-reduced-motion`. Non-essential animation should be skippable.
- **Focus visibility:** Clear focus indicators on interactive elements
- **Accessible authentication:** Avoid flows that depend on cognitive puzzles or memory-heavy steps
- **Redundant entry:** Don't make users re-enter information they already provided

→ Full accessibility guide: `references/accessibility-and-design.md`

## Performance — Core Web Vitals

Performance is a design quality, not just an engineering concern.

### The Three Metrics

- **LCP (Largest Contentful Paint):** How fast the main content appears
- **INP (Interaction to Next Paint):** How responsive the app feels to taps/clicks
- **CLS (Cumulative Layout Shift):** How stable the layout is during load

### Practical Rules

- Don't lazy-load hero/LCP images
- Use responsive images with explicit dimensions
- Minimize JS bundles — code-split aggressively
- Use `useNativeDriver: true` for animations on native; skip animations on web when they cause jitter
- FlatList optimization: `initialNumToRender`, `maxToRenderPerBatch`, `windowSize`, `removeClippedSubviews`
- Use Set-based lookups (O(1)) instead of Array.includes (O(n)) in render paths

### Canopy Trove Performance Wins Already Applied

- MotionInView bypasses animations entirely on web (was causing 374 instances of JS-thread jitter)
- ScreenShell skips entrance animation on web
- Tab transitions simplified to opacity-only crossfade (200ms)
- Lazy tab loading enabled
- Set-based visited storefront lookups

## Navigation and Information Architecture

- Navigation labels should be literal and descriptive
- Avoid hover-only interaction patterns (they don't work on touch)
- Large tap targets, consistent layout, consistent navigation locations
- Fewer deep cascading menus — flat is usually better
- `navigation.canGoBack()` check on web before calling `goBack()` (browsers have no guaranteed history stack)

## Forms and Conversion UX

Research consistently shows the number of form fields matters more than the number of steps.

- Keep forms short, labeled, and forgiving
- Preserve user input after validation errors
- Inline validation reduces friction when done correctly
- Required vs optional fields should be visually clear
- On web, don't break the browser's user gesture chain with async permission checks before
  file input clicks (this is what broke the photo picker on Canopy Trove's web app)

## Trust and Credibility

Stanford's Web Credibility Project research still holds:

- Professional visual design builds trust
- Clear contact information and real company details
- Fast load times signal competence
- Consistent branding across pages
- Privacy policy and terms accessible
- No broken links or error states left visible to users

## PWA Checklist

If making the web app installable:

- [ ] `manifest.json` with name, short_name, icons, start_url, display, theme_color, background_color
- [ ] Icons at multiple sizes (192×192 and 512×512 minimum)
- [ ] Service worker registered with appropriate cache strategy
- [ ] Offline fallback page
- [ ] HTTPS
- [ ] Tested installability on Android Chrome, iOS Safari, Desktop Chrome
- [ ] `<meta name="theme-color">` in HTML head

## Content Design

Bad wording is often a design failure, not just a writing failure.

- Use plain language
- Write for scanning, not reading
- Labels should describe what happens, not what the thing is called
- Error messages should say what went wrong and what to do about it

## Best Build Stack (2026)

| Layer | Recommended |
|-------|-------------|
| Frontend | React/Next.js, Vite, or Expo Web |
| Backend | Node/Express, Next API routes |
| Auth | Managed auth (Firebase, Auth0) or hardened custom |
| Database | Postgres, Firestore, or similar |
| Hosting | HTTPS-first platform (Firebase Hosting, Vercel, Cloudflare) |
| PWA | Optional layer for installability |

## Safest Launch Baseline

Before going live, verify:

1. HTTPS everywhere
2. Cookie/session hardening
3. Auth + authorization review
4. CSP + security headers
5. Server-side validation
6. Monitoring + analytics
7. Backups and secret management

## Identity and Authentication Design

Modern web auth goes beyond username/password. Consider the full identity surface:

- **Passkeys/WebAuthn** are now mature and give phishing resistance that passwords and SMS cannot.
  They eliminate password reuse, credential stuffing, and phishing attacks entirely.
- **Password recovery** is a major attack path. Return consistent responses for existing and
  non-existing accounts, use single-use expiring tokens, and avoid security questions as primary recovery.
- **MFA quality matters.** Not all MFA is equal. TOTP is better than SMS. Passkeys/WebAuthn
  are better than TOTP. Phishing-resistant methods should be preferred.

→ Deep dive: `references/identity-and-sessions.md`

## Session and Browser Storage

- Session IDs must be unpredictable, server-generated, and invalidated on logout
- Browsers cap localStorage tightly and vary on quota/eviction — use storage deliberately
- Cross-site storage is increasingly constrained (state partitioning, Storage Access API)
- If your app uses federated login or cross-site widgets, understand these constraints

→ Deep dive: `references/identity-and-sessions.md`

## Supply Chain Security

Third-party scripts and CDN assets are a real attack surface:

- **Subresource Integrity (SRI):** Add `integrity` hashes to external `<script>` and `<link>` tags
  so the browser rejects tampered resources
- **Audit npm dependencies** regularly with `npm audit` or Snyk
- **Pin dependency versions** — avoid `^` ranges for production builds
- **Minimize external scripts** — every CDN script is a trust decision

## Browser Security Policy (Advanced Headers)

Beyond basic security headers, a serious web app should consider:

- **COOP (Cross-Origin-Opener-Policy):** Prevents other windows from getting a reference to yours
- **COEP (Cross-Origin-Embedder-Policy):** Prevents loading cross-origin resources without explicit opt-in
- **CORP (Cross-Origin-Resource-Policy):** Controls which sites can embed your resources
- **Permissions-Policy:** Restricts browser features (camera, mic, geolocation) per-origin

Canopy Trove already sets Permissions-Policy on the backend. Consider adding COOP and CORP.

## CSRF and CORS Discipline

- If the browser sends credentials automatically (cookies), state-changing requests need CSRF defenses
- CORS should be tightly scoped — never use `*` with credentials
- Canopy Trove's backend correctly rejects wildcard CORS origins and uses an explicit allowlist

## File Uploads and Untrusted Input

If users can upload files (review photos, profile images):

- Validate file extensions against an allowlist, not a blocklist
- Don't trust MIME types from the client — verify server-side
- Generate new filenames; never use the client-provided name in storage paths
- Enforce size limits
- Store uploads outside the web root
- Consider malware scanning for user-uploaded content

## Search and Discoverability (SEO)

For a web app, discoverability is part of product design:

- Canonical URLs prevent duplicate content penalties
- Structured data (JSON-LD) enables rich search results — Canopy Trove already has WebApplication schema
- `robots` meta and robots.txt control what gets indexed
- People-first content: write for users, not for search engines
- If targeting multiple regions/languages, `hreflang` and canonical handling become architectural decisions

## PWA Lifecycle and Updates

Service workers are powerful, but update strategy is part of UX:

- Don't delay render while checking for service worker updates
- Use stale-while-revalidate for appropriate cache strategies
- Workbox simplifies service worker implementation with proven patterns
- Push notifications should only be requested from user gestures — browsers punish spammy flows
- On mobile, push notifications require a service worker

## Observability and Field Measurement

Good web projects instrument field performance, not just lab tests:

- **web-vitals library** is the direct route for field Core Web Vitals measurement
- **Reporting API** surfaces browser-detected issues (CSP violations, deprecations, crashes)
- **NEL (Network Error Logging)** captures network failures the client sees but the server doesn't
- **Sentry** for runtime error tracking (Canopy Trove already integrated)
- **Cloud Logging** for backend observability (Canopy Trove already configured)

## Privacy Architecture

Privacy is both a legal requirement and a trust signal:

- **Privacy by design:** Collect only what you need, explain why, and let users control their data
- **Consent UX:** Cookie-consent burden is real. Design consent flows that are honest and not dark-patterned.
  Research shows interface choices directly affect user behavior.
- **Plain-language disclosures:** Regulators push informed choices — not 30-page legalese

## Threat Modeling

Both NIST and OWASP treat threat modeling as part of the engineering process, not an afterthought:

- Identify assets (user data, API keys, session tokens)
- Map trust boundaries (client vs server, authenticated vs anonymous)
- Enumerate threats per boundary (STRIDE or LINDDUN frameworks)
- Prioritize by impact × likelihood
- Review threats on every significant architecture change

## OWASP Top 10:2025

The 2025 edition (released January 2026) introduced two new categories and significant reshuffling:

- **A03: Software Supply Chain Failures** — NEW standalone category covering compromised npm packages,
  missing dependency auditing, unpinned versions, and build pipeline integrity
- **A10: Mishandling of Exceptional Conditions** — NEW category covering stack trace leakage, unhandled
  rejections, and silent failures
- Security Misconfiguration moved up to #2; SSRF consolidated into Broken Access Control

Canopy Trove is strong on most categories but has gaps in supply chain (no CI audit step, `^` version
ranges, no SRI on self-hosted scripts).

→ Full analysis with Canopy Trove status per category: `references/owasp-2025-and-compliance.md`

## Browser APIs and Interop 2026

The Interop 2026 initiative (Apple/Google/Igalia/Microsoft/Mozilla) targets 20 focus areas for
cross-browser alignment. Key APIs relevant to web apps:

- **View Transitions API** — Hardware-accelerated page transitions; cross-document support shipped
  in Safari 18.2. Not directly applicable to SPA but useful with Expo Router static rendering.
- **Popover API** — Now Baseline across all browsers. Native popover/dialog with CSS Anchor
  Positioning. Low priority for Canopy Trove (React Native Modal covers this).
- **Speculation Rules API** — Browser preloads/prerenders likely next pages. Requires multi-page
  architecture.
- **CSS contrast-color()** — Auto-selects accessible text color against dynamic backgrounds.
- **Scroll-Driven Animations** — CSS-only scroll-triggered animations without JavaScript.

Safari-specific: LCP and INP metrics coming in 2026, Declarative Web Push in Safari 18.4,
iOS 26 defaults Home Screen sites to web app mode.

→ Full details and gap analysis: `references/browser-apis-2026.md`

## PWA and Expo Web Optimization

### Service Workers and Caching

Workbox is the standard service worker library (54% of mobile sites). Recommended strategy
for Canopy Trove:

- **Cache-First** for static assets (CSS, JS, images) — 2-3x faster repeat loads
- **Network-First** for API responses — data freshness with offline fallback
- **Stale-While-Revalidate** for HTML shell — quick loads with background updates

### Expo Web Build Optimization

- **Tree shaking**: `EXPO_UNSTABLE_TREE_SHAKING=1` — experimental, test before production
- **Bundle analysis**: `EXPO_UNSTABLE_ATLAS=1` for development visualization
- **React Compiler**: Auto-memoizes components, eliminates manual useMemo/useCallback
- **Hermes v1**: 60% better benchmark perf on native (not applicable to web)

### iOS PWA Status (2025-2026)

Works: Add to Home Screen, Service Worker, Cache API, Web Push (since iOS 16.4, installed only).
Doesn't work: beforeinstallprompt, Background Sync, Badging API.

→ Full PWA checklist with implementation order: `references/pwa-and-expo-web.md`

## Regulatory Compliance Updates

### WCAG 2.2 as ISO Standard

WCAG 2.2 was approved as ISO/IEC 40500:2025 (October 2025). Nine new success criteria including
Focus Not Obscured, Target Size Minimum (24×24 CSS px), Accessible Authentication, and Redundant
Entry. US DOJ requires WCAG 2.1 AA for state/local government sites by April 2026.

### EU Digital Omnibus Package (November 2025)

Proposed revisions to GDPR: universal consent settings via browser/OS preferences, one-click
cookie rejection mandatory, granular consent choices required. Canopy Trove's cookie-free approach
(Firebase Auth uses localStorage, API uses Bearer tokens) is a competitive advantage.

→ Full regulatory details: `references/owasp-2025-and-compliance.md`

## Structured Data for Discovery

Beyond the existing WebApplication schema, consider adding:

- **Organization schema** on the main page
- **FAQ schema** for common dispensary questions (rich search results)
- **LocalBusiness schema** per storefront page (requires SSR or prerendering)

→ Implementation examples: `references/owasp-2025-and-compliance.md`

## Reference Files

For deeper dives on specific topics, read these:

- `references/security-checklist.md` — Full OWASP security checklist with source links
- `references/accessibility-and-design.md` — WCAG 2.2 details, design patterns, common failures
- `references/performance-guide.md` — Core Web Vitals optimization, image handling, bundle strategies
- `references/identity-and-sessions.md` — Passkeys, MFA, session design, browser storage, privacy
- `references/supply-chain-and-hardening.md` — SRI, CSRF, CORS, file uploads, advanced headers, threat modeling
- `references/owasp-2025-and-compliance.md` — OWASP 2025 changes, CSP modernization, WCAG 2.2 ISO, privacy regulations, structured data
- `references/browser-apis-2026.md` — Interop 2026, View Transitions, Popover API, web-vitals, Reporting API/NEL
- `references/pwa-and-expo-web.md` — iOS PWA status, Workbox caching, Expo tree shaking, React Compiler, PWA checklist

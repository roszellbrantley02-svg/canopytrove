# OWASP Top 10:2025 and Regulatory Compliance

Research compiled April 2026 from OWASP, W3C WAI, EU Commission, and MDN.

## OWASP Top 10:2025 (January 2026)

The 2025 edition analyzed 589 CWEs (up from ~400 in 2021) across 175,000+ CVE records.

| Rank | Category                                  | Change from 2021 |
| ---- | ----------------------------------------- | ---------------- |
| A01  | Broken Access Control                     | Stayed #1        |
| A02  | Security Misconfiguration                 | Up from #5       |
| A03  | **Software Supply Chain Failures**        | **NEW**          |
| A04  | Cryptographic Failures                    | Down from #2     |
| A05  | Injection                                 | Down from #3     |
| A06  | Insecure Design                           | Down from #4     |
| A07  | Authentication Failures                   | Down from #7     |
| A08  | Software or Data Integrity Failures       | Stayed #8        |
| A09  | Security Logging and Alerting Failures    | Was #9           |
| A10  | **Mishandling of Exceptional Conditions** | **NEW**          |

### Key Changes

**A03: Software Supply Chain Failures** — Now a standalone category. Covers:

- Compromised npm packages and CDN resources
- Missing dependency auditing (`npm audit`, Snyk)
- Unpinned dependency versions
- Lack of SRI on external scripts
- Build pipeline integrity

**A10: Mishandling of Exceptional Conditions** — Covers:

- Stack traces leaked to clients
- Unhandled promise rejections
- Missing or generic error handlers
- Error messages that reveal system internals
- Silent failures that leave the system in an inconsistent state

**Consolidation**: SSRF (was A10:2021) merged into A01: Broken Access Control.

### Canopy Trove Status Against OWASP 2025

| Category                       | Status  | Notes                                                                      |
| ------------------------------ | ------- | -------------------------------------------------------------------------- |
| A01: Broken Access Control     | Strong  | ensureProfileReadAccess/WriteAccess, per-resource auth                     |
| A02: Security Misconfiguration | Strong  | Custom security headers, restrictive CSP                                   |
| A03: Supply Chain              | Partial | No CI audit step, ^ version ranges, no SRI on self-hosted scripts          |
| A04: Cryptographic Failures    | Strong  | HTTPS everywhere, HSTS with preload                                        |
| A05: Injection                 | Strong  | Zod validation, prototype pollution protection, HTML sanitization          |
| A06: Insecure Design           | Strong  | Backend gateway pattern, timing-safe comparisons                           |
| A07: Authentication Failures   | Strong  | Firebase Auth, brute-force detection, rate limiting                        |
| A08: Integrity Failures        | Good    | Signed URLs, content-type enforcement                                      |
| A09: Logging Failures          | Strong  | Pino structured logging, Sentry, audit log                                 |
| A10: Exception Handling        | Strong  | Global error handler, no stack trace leakage, unhandled rejection catching |

## CSP Modernization: Nonce and strict-dynamic

The current Canopy Trove backend CSP is:

```
Content-Security-Policy: default-src 'none'; frame-ancestors 'none'
```

This is very restrictive and appropriate for an API-only backend. However, the **frontend**
(served by Firebase Hosting) should have its own CSP. Modern best practice:

### Nonce-Based Strict CSP

```
Content-Security-Policy:
  default-src 'self';
  script-src 'nonce-{RANDOM}' 'strict-dynamic';
  style-src 'self' 'unsafe-inline';
  img-src 'self' https: data:;
  connect-src 'self' https://api.canopytrove.com https://*.googleapis.com;
  font-src 'self';
  object-src 'none';
  base-uri 'self';
  frame-ancestors 'none';
```

For Firebase Hosting, CSP can be configured in `firebase.json` under `hosting.headers`.
Since Expo Web generates static HTML, a hash-based approach may be simpler than nonces:
compute the hash of inline scripts and add them to the CSP.

### Implementation Path

1. Start with `Content-Security-Policy-Report-Only` to identify issues
2. Use browser developer tools to find blocked resources
3. Add appropriate nonces or hashes
4. Switch to enforcement mode once clean

## WCAG 2.2 as ISO Standard

WCAG 2.2 was approved as ISO/IEC 40500:2025 in October 2025. Key implications:

- **Legal weight**: ISO recognition strengthens WCAG 2.2 as the baseline for legal compliance
- **US DOJ deadline**: April 2026 requires WCAG 2.1 Level AA for state/local government sites
- **European Accessibility Act (EAA)**: Expected to adopt WCAG 2.2 via EN 301 549
- **Backward compatible**: WCAG 2.2 conformance includes WCAG 2.1 and 2.0

### Nine New Success Criteria in WCAG 2.2

Additions beyond WCAG 2.1:

1. **2.4.11 Focus Not Obscured (Minimum)** — AA: Focus indicator can't be fully hidden by other elements
2. **2.4.12 Focus Not Obscured (Enhanced)** — AAA: No part of the focus indicator can be hidden
3. **2.4.13 Focus Appearance** — AAA: Focus indicator must meet minimum size and contrast
4. **2.5.7 Dragging Movements** — AA: Drag operations must have a single-pointer alternative
5. **2.5.8 Target Size (Minimum)** — AA: Touch targets at least 24x24 CSS pixels (with spacing)
6. **3.2.6 Consistent Help** — A: Help mechanisms in consistent locations across pages
7. **3.3.7 Redundant Entry** — A: Don't require re-entry of previously provided information
8. **3.3.8 Accessible Authentication (Minimum)** — AA: No cognitive function tests for auth
9. **3.3.9 Accessible Authentication (Enhanced)** — AAA: No object or image recognition for auth

### Canopy Trove WCAG 2.2 Status

| Criterion                 | Status       | Notes                                                  |
| ------------------------- | ------------ | ------------------------------------------------------ |
| 2.4.11 Focus Not Obscured | Needs review | Check modals and sticky headers                        |
| 2.5.7 Dragging Movements  | N/A          | No drag operations in current UI                       |
| 2.5.8 Target Size         | Pass         | 48dp minimum throughout                                |
| 3.2.6 Consistent Help     | Needs review | Legal Center is accessible but no persistent help link |
| 3.3.7 Redundant Entry     | Pass         | Forms don't re-ask for provided data                   |
| 3.3.8 Accessible Auth     | Pass         | Standard email/password, no CAPTCHAs                   |

## Privacy Regulation Updates (2025-2026)

### EU Digital Omnibus Package (November 2025)

The European Commission proposed revisions to GDPR and other digital rules:

- **Universal consent settings**: Browser/OS-level preference mechanisms that sites must honor
- **Cookie-consent simplification**: Technical standards for consistent consent across websites
- **One-click rejection**: Mandatory across EU member states for cookie banners

### Global Trends

- Prior opt-in consent required before setting non-essential cookies (GDPR baseline)
- "Accept" and "Reject" must be equally accessible (no dark patterns)
- Granular choices required (analytics, marketing, functional)
- Enforcement increasing across UK, EU, US states, India, Latin America

### Canopy Trove Implications

Canopy Trove doesn't use cookies (Firebase Auth uses localStorage, API uses Bearer tokens),
so cookie consent banners aren't currently needed. If analytics or marketing cookies are added
in the future, consent infrastructure becomes mandatory. The current privacy-preserving approach
(no cookies, sendDefaultPii: false in Sentry, no third-party trackers) is a competitive advantage.

## Structured Data for Dispensary Discovery

### Current State

Canopy Trove has `WebApplication` schema in web/index.html. This is correct for the app itself
but misses the local business discovery angle.

### Recommended Additions

**Organization schema** (on the main app page):

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Canopy Trove LLC",
  "url": "https://canopytrove.com",
  "description": "Licensed dispensary discovery platform for New York.",
  "sameAs": []
}
```

**FAQ schema** (common dispensary questions):

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How do I find a licensed dispensary near me?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Canopy Trove shows verified, licensed dispensaries near your location with live hours, deals, and reviews."
      }
    }
  ]
}
```

**LocalBusiness schema** on individual storefront pages (if server-rendered or prerendered):

- Requires dynamic structured data per storefront
- Best implemented via server-side rendering or prerendering
- Not practical in a client-rendered SPA without SSR

Sources: OWASP Top 10:2025, W3C WAI WCAG 2.2, EU Digital Omnibus Package, MDN CSP Guide,
Schema.org, Google Developers Structured Data

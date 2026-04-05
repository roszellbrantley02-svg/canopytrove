# Canopy Trove SEO Audit Report

**Date:** April 5, 2026
**Domains audited:** canopytrove.com (landing site) + app.canopytrove.com (web app)
**Audit type:** Full site audit

---

## Executive Summary

Canopy Trove has solid on-page SEO foundations on the web app (app.canopytrove.com) — good title tags, meta descriptions, Open Graph tags, structured data, and a sitemap. However, the site is **not indexed by Google at all** (`site:canopytrove.com` returns zero results). This is the single biggest blocker. The most likely causes are: the landing site (canopytrove.com) has **no robots.txt and no sitemap**, Google Search Console has probably never been set up, and the web app's SPA architecture means Google only sees the shell HTML for all routes. Fixing indexation, adding location-specific landing pages, and implementing LocalBusiness structured data will have the highest impact on appearing in "dispensaries near me" searches.

**Biggest strength:** The web app's `index.html` already has strong meta tags, keyword-rich descriptions, and WebApplication JSON-LD schema.

**Top 3 priorities:**

1. Get indexed — add robots.txt + sitemap to canopytrove.com, set up Google Search Console, submit both sitemaps
2. Create crawlable, server-rendered dispensary pages with LocalBusiness schema so Google can index individual storefronts
3. Build location-specific landing pages targeting "dispensary near me" + borough/neighborhood keywords

**Overall assessment:** Strong brand and product, but **critical SEO infrastructure is missing**. The site is invisible to Google right now.

---

## Technical SEO Checklist

| Check                                     | Status  | Details                                                                                                                                                                 |
| ----------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **robots.txt (canopytrove.com)**          | FAIL    | No robots.txt exists in `public-release-pages/`. Google has no crawl directives for the landing site.                                                                   |
| **robots.txt (app.canopytrove.com)**      | PASS    | Present at `public/robots.txt`. Allows all crawling, disallows `/_expo/`, references sitemap.                                                                           |
| **Sitemap (canopytrove.com)**             | FAIL    | No sitemap exists for the landing site. 7+ public pages (about, privacy, terms, support, etc.) are not in any sitemap.                                                  |
| **Sitemap (app.canopytrove.com)**         | WARNING | Sitemap exists with 4 URLs (/, /nearby, /browse, /hot-deals). But these are SPA routes — Google may not render JS content. Individual storefront URLs are not included. |
| **Google Search Console**                 | FAIL    | Site appears completely unindexed. GSC likely not set up or verified.                                                                                                   |
| **HTTPS**                                 | PASS    | Both domains serve over HTTPS via Firebase Hosting.                                                                                                                     |
| **Canonical tags**                        | PASS    | Present on landing site homepage and web app.                                                                                                                           |
| **Mobile-friendliness**                   | PASS    | Viewport meta tags present, responsive CSS.                                                                                                                             |
| **Page speed**                            | WARNING | Landing site is static HTML (fast). Web app is a React SPA requiring full JS bundle to render — slow for crawlers.                                                      |
| **Structured data (canopytrove.com)**     | FAIL    | No JSON-LD or schema markup on the landing site. Missing Organization, WebSite, and LocalBusiness schemas.                                                              |
| **Structured data (app.canopytrove.com)** | WARNING | Has WebApplication schema with SearchAction, but missing LocalBusiness schema for dispensary listings.                                                                  |
| **Meta robots**                           | PASS    | Web app has `<meta name="robots" content="index, follow" />`. Landing site has no robots meta (defaults to index).                                                      |
| **Open Graph / Twitter cards**            | PASS    | Both sites have OG tags. Web app also has `og:image` and `twitter:image`. Landing site is missing `og:image`.                                                           |
| **Security headers**                      | PASS    | CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy all configured in firebase.json.                                                                          |
| **SPA rendering for SEO**                 | FAIL    | The web app uses a catch-all SPA rewrite (`** → /index.html`). Google's crawler may not execute JS to see actual content. No SSR or prerendering in place.              |
| **Individual storefront URLs**            | FAIL    | 627 dispensary storefronts exist in the database, but none have crawlable public URLs with server-rendered content. This is the biggest content gap.                    |

---

## On-Page SEO Issues

| Page                        | Issue                                       | Severity | Fix                                                                                                         |
| --------------------------- | ------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------- |
| canopytrove.com (all pages) | No robots.txt                               | Critical | Create `public-release-pages/robots.txt` with `Allow: /` and sitemap reference                              |
| canopytrove.com (all pages) | No sitemap.xml                              | Critical | Create sitemap listing all 7+ public pages                                                                  |
| canopytrove.com             | No `og:image`                               | Medium   | Add an OG image (1200x630px) showing the app or logo                                                        |
| canopytrove.com             | No structured data                          | High     | Add Organization + WebSite JSON-LD schema                                                                   |
| canopytrove.com             | Title is brand-focused, not keyword-focused | Medium   | Consider: "Licensed Dispensaries Near You — Canopy Trove"                                                   |
| canopytrove.com             | H1 is vague for SEO                         | Medium   | "Find the licensed dispensaries worth choosing" doesn't contain "dispensary near me"                        |
| canopytrove.com/storefronts | Generic deep-link page                      | High     | Instead of a generic "open in app" page, render actual storefront data for crawlers                         |
| app.canopytrove.com         | SPA with no SSR/prerendering                | Critical | Google may not index JS-rendered content. Need server-side rendering or static prerendering for key routes. |
| app.canopytrove.com         | Sitemap only has 4 URLs                     | High     | Should include all browsable dispensary pages                                                               |
| app.canopytrove.com         | No LocalBusiness schema on dispensary pages | High     | Each storefront should have LocalBusiness JSON-LD with name, address, hours, geo coordinates                |
| All pages                   | No `hreflang`                               | Low      | Not critical for single-language site, but good practice                                                    |
| All pages                   | No breadcrumb schema                        | Low      | Add BreadcrumbList JSON-LD for navigation hierarchy                                                         |

---

## Keyword Opportunity Table

| Keyword                          | Difficulty | Opportunity | Current Ranking | Intent        | Recommended Content                                        |
| -------------------------------- | ---------- | ----------- | --------------- | ------------- | ---------------------------------------------------------- |
| dispensary near me               | Hard       | High        | Not indexed     | Transactional | Location landing pages + LocalBusiness schema              |
| dispensaries near me             | Hard       | High        | Not indexed     | Transactional | Same as above                                              |
| dispensary open now              | Moderate   | High        | Not indexed     | Transactional | Real-time hours on crawlable storefront pages              |
| licensed dispensary new york     | Moderate   | High        | Not indexed     | Commercial    | Landing page: "Licensed Dispensaries in New York"          |
| dispensary [borough name]        | Moderate   | High        | Not indexed     | Transactional | Borough-specific landing pages (Manhattan, Brooklyn, etc.) |
| legal dispensary near me         | Moderate   | High        | Not indexed     | Commercial    | Landing page emphasizing licensed/legal status             |
| weed dispensary near me          | Hard       | Medium      | Not indexed     | Transactional | Location pages with natural keyword usage                  |
| cannabis dispensary NYC          | Moderate   | High        | Not indexed     | Transactional | NYC-focused landing page                                   |
| dispensary deals near me         | Easy       | Medium      | Not indexed     | Transactional | Hot deals page with crawlable content                      |
| dispensary reviews               | Moderate   | Medium      | Not indexed     | Informational | Crawlable review content on storefront pages               |
| best dispensary manhattan        | Moderate   | High        | Not indexed     | Commercial    | Manhattan dispensary guide/landing page                    |
| best dispensary brooklyn         | Moderate   | High        | Not indexed     | Commercial    | Brooklyn dispensary guide/landing page                     |
| dispensary hours near me         | Easy       | Medium      | Not indexed     | Transactional | Storefront pages with hours in schema                      |
| new york dispensary map          | Easy       | Medium      | Not indexed     | Navigational  | Map-based browse page with prerendered list                |
| recreational dispensary new york | Moderate   | Medium      | Not indexed     | Informational | Blog post or guide about NY rec market                     |
| dispensary finder app            | Easy       | High        | Not indexed     | Navigational  | App landing page optimized for this term                   |
| how to find licensed dispensary  | Easy       | Medium      | Not indexed     | Informational | Blog post / guide                                          |
| OCM licensed dispensary list     | Easy       | High        | Not indexed     | Informational | Curated page of OCM-verified storefronts                   |
| dispensary queens ny             | Easy       | High        | Not indexed     | Transactional | Queens landing page                                        |
| dispensary bronx ny              | Easy       | High        | Not indexed     | Transactional | Bronx landing page                                         |

---

## Content Gap Analysis

### vs. Leafly

Leafly dominates "dispensary near me" searches with location-specific pages (`/dispensaries/new-york/new-york`, `/dispensaries/new-york/brooklyn`, etc.). Each page has individual dispensary listings with reviews, hours, and structured data. Canopy Trove has zero crawlable dispensary content.

### vs. Weedmaps

Weedmaps has deep location pages, dispensary profiles, and deals pages — all server-rendered and crawlable. They also heavily use LocalBusiness schema.

### vs. cannabis.ny.gov / newyorkstatecannabis.org

These rank for informational queries about NY licensing. Canopy Trove could differentiate by being the consumer-friendly discovery layer that links to official licensing data.

### Missing Content Types

| Gap                                               | Priority | Effort      | Why It Matters                                                                                                                   |
| ------------------------------------------------- | -------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Location landing pages** (borough/neighborhood) | Critical | Moderate    | This is how Leafly/Weedmaps dominate local search. You need pages like `/dispensaries/manhattan`, `/dispensaries/brooklyn`, etc. |
| **Individual storefront pages** (crawlable)       | Critical | Substantial | 627 storefronts = 627 indexable pages with unique content, reviews, hours, and LocalBusiness schema                              |
| **Blog / guides**                                 | Medium   | Moderate    | "How to find a licensed dispensary in NY", "What to look for in a dispensary", etc. drive informational traffic                  |
| **FAQ page**                                      | Medium   | Quick       | Target People Also Ask queries: "Are dispensaries legal in NY?", "How old do you have to be?"                                    |
| **Deals / promotions page** (crawlable)           | Medium   | Quick       | "Dispensary deals near me" is a growing search term                                                                              |

---

## Competitor Comparison

| Dimension                           | Canopy Trove                | Leafly                             | Weedmaps        |
| ----------------------------------- | --------------------------- | ---------------------------------- | --------------- |
| Google indexed pages                | 0                           | 100,000+                           | 100,000+        |
| Location landing pages              | 0                           | Hundreds (state/city/neighborhood) | Hundreds        |
| Individual dispensary pages         | 0 crawlable                 | Thousands                          | Thousands       |
| Structured data (LocalBusiness)     | None                        | Yes                                | Yes             |
| Server-side rendering               | No (SPA only)               | Yes                                | Yes             |
| Google Business Profile integration | No                          | N/A (directory)                    | N/A (directory) |
| Review content (crawlable)          | No                          | Yes                                | Yes             |
| Blog / editorial content            | No                          | Extensive                          | Moderate        |
| Sitemap completeness                | 4 URLs                      | Comprehensive                      | Comprehensive   |
| Mobile experience                   | Strong (native app quality) | Good                               | Good            |
| NY-specific focus                   | Yes (differentiator)        | National                           | National        |
| Licensed-only positioning           | Yes (differentiator)        | Mixed                              | Mixed           |

---

## Prioritized Action Plan

### Quick Wins (Do This Week)

**1. Set up Google Search Console** — Effort: 30 min, Impact: Critical

- Go to search.google.com/search-console
- Add both `canopytrove.com` and `app.canopytrove.com` as properties
- Verify via DNS TXT record or Firebase Hosting file upload
- Submit sitemaps once created

**2. Create robots.txt for canopytrove.com** — Effort: 5 min, Impact: Critical

- Create `public-release-pages/robots.txt`:
  ```
  User-agent: *
  Allow: /
  Sitemap: https://canopytrove.com/sitemap.xml
  ```
- Deploy with `firebase deploy --only hosting:legal`

**3. Create sitemap.xml for canopytrove.com** — Effort: 15 min, Impact: Critical

- Create `public-release-pages/sitemap.xml` listing all public pages:
  - `/` (homepage)
  - `/about`
  - `/privacy`
  - `/terms`
  - `/community-guidelines`
  - `/support`
  - `/account-deletion`

**4. Add Organization + WebSite schema to canopytrove.com** — Effort: 30 min, Impact: High

- Add JSON-LD to the homepage `<head>`:
  ```json
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Canopy Trove",
    "url": "https://canopytrove.com",
    "description": "Licensed dispensary discovery app for New York",
    "sameAs": ["https://app.canopytrove.com"]
  }
  ```
- Add WebSite schema with SearchAction pointing to the web app

**5. Add og:image to canopytrove.com** — Effort: 30 min, Impact: Medium

- Create a 1200x630px Open Graph image showing the app
- Add `<meta property="og:image" content="https://canopytrove.com/media/og-image.png" />`

**6. Optimize title tag and H1 for keywords** — Effort: 15 min, Impact: Medium

- Title: `"Find Licensed Dispensaries Near You | Canopy Trove"` (includes "dispensaries near you")
- H1: `"Find licensed dispensaries near you in New York"` (adds location + keyword)

### Strategic Investments (This Quarter)

**7. Build server-rendered storefront pages** — Effort: Multi-day, Impact: Critical

- This is the single highest-impact investment for SEO
- Create a route like `canopytrove.com/dispensary/[slug]` that serves pre-rendered HTML for each of the 627 storefronts
- Each page should include: dispensary name, address, hours, phone, reviews, photos, and LocalBusiness JSON-LD schema
- Options:
  - **Quick path:** Static site generation — run a build step that generates 627 HTML pages from Firestore data and deploy to Firebase Hosting
  - **Scalable path:** Add a lightweight SSR layer (Next.js, or a simple Express route) that renders storefront pages on the fly
- Include internal links between storefront pages and location pages

**8. Create location landing pages** — Effort: 1-2 days, Impact: High

- Build pages for each NYC borough and major neighborhoods:
  - `/dispensaries/manhattan`
  - `/dispensaries/brooklyn`
  - `/dispensaries/queens`
  - `/dispensaries/bronx`
  - `/dispensaries/staten-island`
  - `/dispensaries/long-island`
  - `/dispensaries/upstate-new-york`
- Each page lists dispensaries in that area with a map, hours, and ratings
- Include H1 like "Licensed Dispensaries in Manhattan, NY"
- Add ItemList schema markup listing the dispensaries

**9. Implement prerendering for the web app** — Effort: 2-3 days, Impact: High

- The SPA catch-all rewrite means Google sees an empty shell for all routes
- Options:
  - Use a prerendering service (Prerender.io, Rendertron) that serves cached HTML to bots
  - Or generate static HTML snapshots for key routes during build
- At minimum, ensure `/nearby`, `/browse`, and `/hot-deals` have crawlable content

**10. Expand the sitemap to include all storefront URLs** — Effort: 1 day, Impact: High

- Generate a dynamic sitemap (or static sitemap at build time) that includes all 627+ storefront URLs
- Update `app.canopytrove.com/sitemap.xml` with these URLs
- Submit updated sitemap to Google Search Console

**11. Start a blog / content hub** — Effort: Ongoing, Impact: Medium

- Target informational queries that build topical authority:
  - "How to tell if a dispensary is licensed in New York"
  - "Best dispensaries in [borough] 2026"
  - "What to expect at a New York dispensary"
  - "Dispensary vs. delivery: what's better?"
- Publish 2-4 articles per month
- Internal link from blog posts to relevant storefront pages

**12. Create a Google Business Profile** — Effort: 30 min, Impact: Medium

- Even though Canopy Trove is an app/platform (not a physical store), a GBP listing as a "Software Company" or "Business Service" helps with branded search visibility
- Ensures "Canopy Trove" branded searches show a knowledge panel

---

## Implementation Priority Order

1. Google Search Console setup + verification (unblocks everything else)
2. robots.txt + sitemap for canopytrove.com (lets Google discover pages)
3. Schema markup on landing site (helps Google understand the business)
4. Title tag + H1 keyword optimization (quick ranking signal improvements)
5. Server-rendered storefront pages with LocalBusiness schema (the big win)
6. Location landing pages (captures "dispensary in [area]" searches)
7. Web app prerendering (makes SPA content crawlable)
8. Expanded sitemap with all storefront URLs
9. Blog / content hub for informational traffic
10. Ongoing content creation + link building

---

## Follow-Up Options

After implementing the quick wins, consider:

- Setting up Google Search Console monitoring to track indexation progress
- Creating content briefs for the top keyword opportunities
- Building a content calendar for the blog
- Running a follow-up audit in 30 days to measure progress

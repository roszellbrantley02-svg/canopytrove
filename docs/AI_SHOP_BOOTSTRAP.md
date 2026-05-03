# AI Shop Bootstrap — Architecture Spec

**Status:** in development (May 3 2026)
**Owner:** rozell + claude
**Branch:** `feat/ai-shop-bootstrap`

## What this is

A new owner-portal flow that lets a dispensary owner paste their existing website URL and get a complete, ready-to-publish Canopy Trove storefront listing in ~60 seconds. The AI reads their website (rendered, including embedded Dutchie/Jane menus) using a headless browser + Claude Sonnet 4.5 vision, extracts everything that maps to a Canopy Trove storefront record, and shows the owner a draft they can edit and publish with one tap.

## Why this matters

Today's onboarding bottleneck: claiming + filling out a Canopy Trove storefront listing manually takes hours (basic info, hours, brands, photos, deals, descriptions). Most dispensary owners give up halfway through. This product collapses that friction to ~60 seconds and reframes the value prop:

> **Old:** "Pay us to be in our directory."
> **New:** "Use us as your website. It's free. We're already sending you traffic. The featured slot is a tiny upgrade."

The free hosted page (`canopytrove.com/shop/{slug}`, Phase 2) becomes a credible replacement for the Squarespace + Dutchie embed most NY dispensaries currently pay $50–$200/mo for.

## Phasing

| Phase | What ships                                                                                                    | Effort     |
| ----- | ------------------------------------------------------------------------------------------------------------- | ---------- |
| **1** | URL → AI draft → owner approves → published Canopy Trove listing. Demo-quality.                               | ~5–7 days  |
| **2** | Public hosted page at `canopytrove.com/shop/{slug}` becomes the owner's free homepage with SEO + social meta. | ~5 days    |
| **3** | Weekly auto-rescrape; AI diff-detects changes; owner approves updates with one tap.                           | ~5 days    |
| **4** | Optional Concierge tier: live POS sync (Jane Roots first), inventory automation, deal generation.             | ~7–10 days |

This doc covers Phase 1 in detail; Phases 2–4 sketched at the end.

## High-level data flow (Phase 1)

```
Owner Portal
   │
   │  POST /owner-portal/shop-bootstrap/start
   │  { websiteUrl, claimedStorefrontId? }
   ▼
canopytrove-api (Express, existing Cloud Run service)
   │
   │  Creates ShopBootstrapDraft doc (status: scraping)
   │  Enqueues Pub/Sub message → pos-bootstrap-scrape topic
   │
   ▼
canopytrove-scraper (NEW separate Cloud Run service)
   │
   │  1. Playwright launches headless Chromium
   │  2. Renders the URL (waits for iframes, JS, images)
   │  3. Captures: full-page screenshot, page text, key DOM landmarks,
   │     iframe contents (Dutchie/Jane menus when present)
   │  4. Stores screenshot to Cloud Storage
   │  5. Returns ScrapedWebsiteContent payload via callback
   │
   ▼
canopytrove-api → aiShopBootstrapService.parseDraft()
   │
   │  Calls Claude Sonnet 4.5 with vision:
   │    - input: screenshot (base64) + page text
   │    - tool: extractStorefrontDraft (structured output schema)
   │  Updates ShopBootstrapDraft doc (status: ready, draft fields populated)
   │
   ▼
Owner Portal polls or subscribes to draft updates
   │
   │  Renders side-by-side: AI suggestion ⇄ editable fields
   │
   ▼  Owner taps Publish
   │
   │  POST /owner-portal/shop-bootstrap/{draftId}/publish
   ▼
canopytrove-api → existing storefront-claim + storefront-detail update pipeline
```

Pub/Sub between the API and the scraper service decouples ingestion from rendering, gives free retry + dead-letter, and lets us scale the scraper independently (Playwright is memory-hungry, the API service should not pay that cost).

## Why a separate Cloud Run service for the scraper

- **Image size:** Playwright + Chromium binary is ~1.5 GB. Bloating `canopytrove-api`'s image hurts cold starts on every endpoint.
- **Memory:** A scrape uses 1–2 GB peak. The API service runs at 512 MB normally.
- **Concurrency:** API handles many small requests; scraper handles few large ones. Different concurrency settings.
- **Deployment cadence:** API deploys frequently; scraper deploys rarely. Decoupling means scraper changes don't risk regressing the API.
- **Base image:** Scraper uses `mcr.microsoft.com/playwright:v1.x-noble` (~700 MB) as base; API stays on `node:22-slim`.

## New Firestore collections

```
shopBootstrapDrafts/{draftId}
  ownerUid: string
  websiteUrl: string
  status: 'scraping' | 'parsing' | 'ready' | 'failed' | 'published'
  scrapedAt: ISO string | null
  parsedAt: ISO string | null
  publishedAt: ISO string | null
  failureReason: string | null
  scrapedScreenshotUrl: string | null  // Cloud Storage gs:// URL
  draft: AiShopBootstrapDraftPayload  // the AI's structured output
  ownerEdits: Partial<AiShopBootstrapDraftPayload> | null
  publishedStorefrontId: string | null
  createdAt: ISO string
  updatedAt: ISO string
```

Add to `backend/src/constants/collections.ts`:

```ts
SHOP_BOOTSTRAP_DRAFTS: 'shopBootstrapDrafts',
```

## Type definitions

`AiShopBootstrapDraftPayload` mirrors the fields of a Canopy Trove storefront listing the AI can populate from a website:

```ts
type AiShopBootstrapDraftPayload = {
  // Identity (cross-checked against OCM cache)
  detectedName: string | null;
  detectedAddress: string | null;
  detectedCity: string | null;
  detectedState: string | null;
  detectedZip: string | null;
  detectedPhone: string | null;
  detectedWebsite: string | null;
  detectedMenuUrl: string | null;
  // OCM cross-reference result
  ocmMatch: {
    licenseNumber: string | null;
    matchConfidence: 'high' | 'medium' | 'low' | 'none';
    matchedDispensaryId: string | null;
  } | null;
  // Hours (one entry per day)
  detectedHours: Array<{ day: string; hours: string }> | null;
  // Brands the AI saw mentioned/displayed
  detectedBrands: string[] | null;
  // Deals/promotions visible on the page
  detectedDeals: Array<{
    title: string;
    description: string;
    discountText?: string;
  }> | null;
  // Owner-supplied or AI-extracted descriptions
  detectedAboutText: string | null;
  // Storefront photos (Cloud Storage URLs after copy from source)
  detectedPhotoUrls: string[] | null;
  // Payment methods accepted (cash / debit / credit signal from page)
  detectedPaymentMethods: {
    acceptsCash: boolean | null;
    acceptsDebit: boolean | null;
    acceptsCredit: boolean | null;
    sourceText: string | null;
  } | null;
  // Quality signal from the AI
  extractionConfidence: 'high' | 'medium' | 'low';
  extractionNotes: string;
};
```

## API surface (Phase 1)

```
POST /owner-portal/shop-bootstrap/start
  Body: { websiteUrl: string, claimedStorefrontId?: string }
  Auth: bearer token (existing owner auth)
  Returns: { draftId, status: 'scraping' }

GET /owner-portal/shop-bootstrap/{draftId}
  Auth: bearer token (must own the draft)
  Returns: { draftId, status, draft, ownerEdits, ... }

PATCH /owner-portal/shop-bootstrap/{draftId}
  Body: { ownerEdits: Partial<AiShopBootstrapDraftPayload> }
  Auth: bearer token (must own the draft)
  Returns: { draftId, status, ... }

POST /owner-portal/shop-bootstrap/{draftId}/publish
  Auth: bearer token (must own the draft)
  Returns: { draftId, status: 'published', publishedStorefrontId }
```

## Frontend (Phase 1)

New screen: `src/screens/OwnerPortalShopBootstrapScreen.tsx`

3-step wizard:

1. **Step 1 — URL input.** Single field, "Paste your dispensary website." Submit triggers `start`. Show progress while scraper runs.
2. **Step 2 — AI draft review.** Side-by-side: AI suggestion / editable field for each section (basic info, hours, brands, photos, deals, payment methods). Owner can edit anything. "Looks good" + "Publish" button.
3. **Step 3 — Published.** Confirmation + link to live storefront page on Canopy Trove + sharing affordances.

CTA on Owner Portal home: **"Set up your shop in 60 seconds — paste your website URL"**.

## Claude Sonnet 4.5 vision tool definition

```ts
{
  name: 'extractStorefrontDraft',
  description: 'Given a screenshot + text content of a NY dispensary website, extract structured fields for a Canopy Trove storefront listing.',
  input_schema: { /* matches AiShopBootstrapDraftPayload shape */ }
}
```

System prompt anchors on:

- "You are reading a NY-licensed cannabis dispensary website."
- "Extract only what is clearly visible. Set fields to null if not certain."
- "For brands: list specific brand names visible (e.g. Curaleaf, Stiiizy, RYTHM, MFNY). Generic words like 'pre-roll' are not brands."
- "For deals: only count active promotions, not past ones. Quote the exact text."
- "Confidence rubric: high = page is well-structured (Dutchie embed, clear hours block, etc.), medium = readable but sparse, low = thin page or mostly placeholder."

## Compliance constraints

- Owner must consent (claim flow already does this — we add a website-bootstrap-specific consent line).
- Don't scrape pages that would violate the site's `robots.txt` (check before fetch).
- Rate-limit ourselves: 1 scrape per shop per 24h max.
- AI-generated text content is reviewed by owner before publishing — no auto-publish.
- Photos: fetch with attribution, store in our Cloud Storage, watermark "via {original site}" if not owner-confirmed as theirs.

## What Phase 1 explicitly does NOT include

- POS connection (Phase 4)
- Public hosted page at `canopytrove.com/shop/{slug}` (Phase 2)
- Weekly auto-rescrape (Phase 3)
- Brand-asset fetching from MSO portals (separate research)
- AI image generation for missing product photos (Flux.1 [schnell] integration — Phase 2)

These are tracked in subsequent phases; Phase 1 ships the magic moment and validates the product hypothesis.

## Cost ceiling per bootstrap (Phase 1)

| Component                                                   | Per-scrape cost |
| ----------------------------------------------------------- | --------------- |
| Cloud Run scraper (Playwright + Chromium, ~30s @ 2 GB)      | ~$0.001         |
| Cloud Storage screenshot                                    | ~$0.0001        |
| Claude Sonnet 4.5 vision (1 image + ~3K input + ~2K output) | ~$0.04          |
| Pub/Sub + Firestore writes                                  | <$0.001         |
| **Total per shop bootstrap**                                | **~$0.05**      |

500 owner bootstraps in a month = $25 in compute + LLM. Trivial.

## Open questions to resolve as we build

1. Do we copy detected photos to Cloud Storage immediately or lazy-copy on publish? (Lean toward lazy.)
2. How do we handle Squarespace/Wix sites that block headless browsers? (Try standard headers first; if blocked, surface "we couldn't read this site, please add manually" — graceful degradation.)
3. What happens if the OCM cross-reference finds the storefront but it's already claimed by another owner? (Block the bootstrap, surface "this shop is already managed by another account; please contact support.")
4. Do we offer the bootstrap to UNCLAIMED storefronts — i.e. let an owner-without-an-account paste their URL on a public marketing page and see the magic before signing up? (Probably yes, post-Phase-1 growth lever.)

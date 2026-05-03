/**
 * AI Shop Bootstrap — types for the website-to-Canopy-Trove-listing flow.
 *
 * Spec: docs/AI_SHOP_BOOTSTRAP.md
 *
 * Lifecycle of a `shopBootstrapDrafts/{draftId}` doc:
 *   1. Owner submits website URL → API creates draft with status: 'scraping'
 *   2. canopytrove-scraper Cloud Run service renders the page via Playwright,
 *      writes screenshot to Cloud Storage, returns ScrapedWebsiteContent
 *   3. API marks status: 'parsing', invokes aiShopBootstrapService with the
 *      screenshot + page text against Claude Sonnet 4.5 vision
 *   4. AI returns AiShopBootstrapDraftPayload, status: 'ready'
 *   5. Owner reviews + edits via PATCH endpoint, then publishes
 *   6. Publish writes through to existing storefront pipelines, status: 'published'
 *
 * Failure paths set status: 'failed' with a `failureReason`. The owner can
 * retry by submitting a new URL (creates a new draft) or by re-running
 * the scrape on the same draft (resets status: 'scraping').
 */

export type ShopBootstrapStatus = 'scraping' | 'parsing' | 'ready' | 'failed' | 'published';

/**
 * Output of the canopytrove-scraper Cloud Run service. The scraper does
 * NOT interpret the page; it just renders it via Playwright + captures
 * everything an LLM might need to extract structured data downstream.
 */
export type ScrapedWebsiteContent = {
  // The URL the scraper actually ended at (may differ from input after
  // redirects).
  finalUrl: string;
  // Cloud Storage gs:// URL for the full-page screenshot (PNG).
  screenshotGcsUrl: string;
  // Total visible text content of the rendered page (post-JS, post-iframe).
  pageText: string;
  // Page title from <title>.
  pageTitle: string;
  // Open Graph + meta description if present.
  metaDescription: string | null;
  ogImage: string | null;
  // Detected embedded menu providers (Dutchie, Jane, Weedmaps, Leafly).
  // Helps the AI know the menu source even if iframe content didn't
  // fully render.
  detectedEmbedProviders: Array<'dutchie' | 'jane' | 'weedmaps' | 'leafly' | 'unknown'>;
  // Image URLs we found on the page (storefront photos, logos, banners).
  // These are source URLs; lazy-copy into our own Cloud Storage on publish.
  detectedImageUrls: string[];
  // Outbound links the AI might want to consider (menu URLs, deal pages).
  outboundLinks: Array<{ href: string; text: string }>;
  // Wall-clock duration of the scrape, ms.
  renderDurationMs: number;
  // robots.txt status — were we permitted to fetch?
  robotsAllowed: boolean;
};

/**
 * Structured output from Claude Sonnet 4.5 vision after parsing
 * ScrapedWebsiteContent. This is the AI's PROPOSED listing — the owner
 * sees it as the "AI suggestion" column in the review wizard and can
 * edit any field before publishing.
 *
 * Every field is nullable to model "the AI couldn't find this with high
 * enough confidence." A null field surfaces in the UI as "please add
 * this manually" rather than guessing.
 */
export type AiShopBootstrapDraftPayload = {
  // Identity
  detectedName: string | null;
  detectedAddress: string | null;
  detectedCity: string | null;
  detectedState: string | null;
  detectedZip: string | null;
  detectedPhone: string | null;
  detectedWebsite: string | null;
  detectedMenuUrl: string | null;

  // OCM cross-reference (computed AFTER the AI extracts identity, by
  // running the detected name+address through the existing OCM license
  // cache).
  ocmMatch: {
    licenseNumber: string | null;
    matchConfidence: 'high' | 'medium' | 'low' | 'none';
    matchedDispensaryId: string | null;
  } | null;

  // Hours
  detectedHours: Array<{ day: string; hours: string }> | null;

  // Brands the AI could see displayed or named on the page
  detectedBrands: string[] | null;

  // Active deals/promotions on the page
  detectedDeals: Array<{
    title: string;
    description: string;
    discountText?: string;
  }> | null;

  // About / story / description block
  detectedAboutText: string | null;

  // Storefront photos (source URLs from the page; we lazy-copy on publish)
  detectedPhotoUrls: string[] | null;

  // Payment methods inferred from page text ("we accept cash and debit", etc.)
  detectedPaymentMethods: {
    acceptsCash: boolean | null;
    acceptsDebit: boolean | null;
    acceptsCredit: boolean | null;
    sourceText: string | null;
  } | null;

  // AI's self-assessment of how confident the extraction is
  extractionConfidence: 'high' | 'medium' | 'low';
  extractionNotes: string;
};

/**
 * Full Firestore doc shape for a shopBootstrapDrafts/{draftId}.
 */
export type ShopBootstrapDraft = {
  draftId: string;
  ownerUid: string;
  websiteUrl: string;
  status: ShopBootstrapStatus;
  scrapedAt: string | null;
  parsedAt: string | null;
  publishedAt: string | null;
  failureReason: string | null;
  scrapedContent: ScrapedWebsiteContent | null;
  draft: AiShopBootstrapDraftPayload | null;
  // Owner-supplied overrides applied on top of `draft` before publish.
  // Stored separately so we can re-run the AI parse without losing the
  // owner's edits.
  ownerEdits: Partial<AiShopBootstrapDraftPayload> | null;
  publishedStorefrontId: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Body of POST /owner-portal/shop-bootstrap/start
 */
export type StartShopBootstrapRequest = {
  websiteUrl: string;
  // If the owner is bootstrapping a storefront they've already claimed
  // in our system, pass its ID so we link the draft to it. Otherwise,
  // we'll attempt to match via OCM cross-reference and let the owner
  // confirm in the review step.
  claimedStorefrontId?: string;
};

/**
 * Body of PATCH /owner-portal/shop-bootstrap/{draftId}
 */
export type UpdateShopBootstrapDraftRequest = {
  ownerEdits: Partial<AiShopBootstrapDraftPayload>;
};

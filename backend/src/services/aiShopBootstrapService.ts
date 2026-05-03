/**
 * AI Shop Bootstrap orchestrator — owns the lifecycle of a
 * shopBootstrapDrafts/{draftId} doc:
 *   1. Persists draft (status: 'scraping')
 *   2. Invokes the scraper service
 *   3. Persists draft (status: 'parsing') with scrapedContent attached
 *   4. Invokes Claude Sonnet 4.5 vision with the screenshot + page text
 *   5. Persists draft (status: 'ready') with the AI's structured output
 *   6. On owner publish, writes through to existing storefront pipelines
 *
 * Spec: docs/AI_SHOP_BOOTSTRAP.md
 *
 * Phase 1 status: SCAFFOLD — function shapes are real, persistence layer
 * is wired, but the AI parse step is stubbed until the scraper service +
 * Anthropic vision integration lands.
 */

import crypto from 'node:crypto';
import { getOptionalFirestoreCollection } from '../firestoreCollections';
import { SHOP_BOOTSTRAP_DRAFTS_COLLECTION } from '../constants/collections';
import type {
  AiShopBootstrapDraftPayload,
  ScrapedWebsiteContent,
  ShopBootstrapDraft,
  ShopBootstrapStatus,
} from '../types/aiShopBootstrap';
import { scrapeWebsite, validateScrapeUrl } from './aiShopWebsiteScraperService';

function getCollection() {
  return getOptionalFirestoreCollection<ShopBootstrapDraft>(SHOP_BOOTSTRAP_DRAFTS_COLLECTION);
}

function nowIso(): string {
  return new Date().toISOString();
}

function newDraftId(): string {
  // Format: bootstrap-{12 hex} — short, sortable-ish via timestamp prefix.
  return `bootstrap-${crypto.randomBytes(6).toString('hex')}`;
}

/**
 * Create a new bootstrap draft and kick off the scrape. Returns the
 * initial draft doc (status: 'scraping'). The scrape + AI parse run
 * asynchronously; the owner-portal screen polls or subscribes.
 */
export async function startShopBootstrap(input: {
  ownerUid: string;
  websiteUrl: string;
  claimedStorefrontId?: string;
}): Promise<ShopBootstrapDraft> {
  const validation = validateScrapeUrl(input.websiteUrl);
  if (!validation.ok) {
    throw new Error(`Invalid website URL (${validation.reason ?? 'unknown'}): ${input.websiteUrl}`);
  }

  const draftId = newDraftId();
  const now = nowIso();
  const draft: ShopBootstrapDraft = {
    draftId,
    ownerUid: input.ownerUid,
    websiteUrl: input.websiteUrl.trim(),
    status: 'scraping',
    scrapedAt: null,
    parsedAt: null,
    publishedAt: null,
    failureReason: null,
    scrapedContent: null,
    draft: null,
    ownerEdits: null,
    publishedStorefrontId: input.claimedStorefrontId ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const collection = getCollection();
  if (collection) {
    await collection.doc(draftId).set(draft);
  }

  // Fire-and-forget the scrape + parse pipeline. The scraper itself runs
  // in a separate Cloud Run service so this network call returns quickly.
  // We don't await — the owner-portal screen polls the draft doc.
  void runScrapeAndParse(draftId).catch((error) => {
    // eslint-disable-next-line no-console
    console.error(`[aiShopBootstrap] scrape+parse failed for ${draftId}:`, error);
  });

  return draft;
}

/**
 * The async pipeline that runs the scrape, then the Claude vision parse,
 * then writes the structured result back to Firestore. Invoked by
 * startShopBootstrap; can also be re-run from a "Try again" button on
 * a failed draft.
 */
export async function runScrapeAndParse(draftId: string): Promise<void> {
  const collection = getCollection();
  if (!collection) {
    return;
  }
  const draftSnap = await collection.doc(draftId).get();
  if (!draftSnap.exists) return;
  const draft = draftSnap.data() as ShopBootstrapDraft;

  // Step 1 — scrape
  let scrapeResult;
  try {
    scrapeResult = await scrapeWebsite({
      websiteUrl: draft.websiteUrl,
      respectRobotsTxt: true,
    });
  } catch (error) {
    await markFailed(
      draftId,
      'scrape_threw',
      error instanceof Error ? error.message : String(error),
    );
    return;
  }

  if (!scrapeResult.ok) {
    await markFailed(draftId, scrapeResult.reason, scrapeResult.message);
    return;
  }

  await collection.doc(draftId).set(
    {
      status: 'parsing' satisfies ShopBootstrapStatus,
      scrapedAt: nowIso(),
      scrapedContent: scrapeResult.content,
      updatedAt: nowIso(),
    },
    { merge: true },
  );

  // Step 2 — AI parse
  let aiPayload: AiShopBootstrapDraftPayload;
  try {
    aiPayload = await parseScrapedContentWithVision(scrapeResult.content);
  } catch (error) {
    await markFailed(
      draftId,
      'parse_threw',
      error instanceof Error ? error.message : String(error),
    );
    return;
  }

  await collection.doc(draftId).set(
    {
      status: 'ready' satisfies ShopBootstrapStatus,
      parsedAt: nowIso(),
      draft: aiPayload,
      updatedAt: nowIso(),
    },
    { merge: true },
  );
}

/**
 * Hand the scraped content (screenshot + text) to Claude Sonnet 4.5
 * vision and get back the structured AiShopBootstrapDraftPayload.
 *
 * Phase 1 status: SCAFFOLD ONLY — this is the next thing to build out.
 * Plan:
 *   1. Download the screenshot from Cloud Storage to base64
 *   2. Send to Anthropic API with the extractStorefrontDraft tool definition
 *   3. Map tool_use response → AiShopBootstrapDraftPayload
 *   4. Run OCM cross-reference on the detected name+address
 *   5. Return the payload
 */
export async function parseScrapedContentWithVision(
  _content: ScrapedWebsiteContent,
): Promise<AiShopBootstrapDraftPayload> {
  // TODO(phase-1): wire Anthropic SDK with vision + tool calling.
  //   - Model: claude-sonnet-4-5 (latest)
  //   - System prompt anchors on "NY-licensed cannabis dispensary website"
  //   - Tool: extractStorefrontDraft with the AiShopBootstrapDraftPayload schema
  //   - Response validation: every nullable field stays nullable; AI sets
  //     fields to null if not confident
  throw new Error(
    'aiShopBootstrapService.parseScrapedContentWithVision: not implemented yet — see docs/AI_SHOP_BOOTSTRAP.md phase 1',
  );
}

async function markFailed(draftId: string, reason: string, message: string): Promise<void> {
  const collection = getCollection();
  if (!collection) return;
  await collection.doc(draftId).set(
    {
      status: 'failed' satisfies ShopBootstrapStatus,
      failureReason: `${reason}: ${message}`.slice(0, 500),
      updatedAt: nowIso(),
    },
    { merge: true },
  );
}

export async function getDraft(
  draftId: string,
  ownerUid: string,
): Promise<ShopBootstrapDraft | null> {
  const collection = getCollection();
  if (!collection) return null;
  const snap = await collection.doc(draftId).get();
  if (!snap.exists) return null;
  const data = snap.data() as ShopBootstrapDraft;
  // Owner ACL — never let one owner see another's draft.
  if (data.ownerUid !== ownerUid) return null;
  return data;
}

export async function applyOwnerEdits(input: {
  draftId: string;
  ownerUid: string;
  ownerEdits: Partial<AiShopBootstrapDraftPayload>;
}): Promise<ShopBootstrapDraft | null> {
  const draft = await getDraft(input.draftId, input.ownerUid);
  if (!draft) return null;
  const collection = getCollection();
  if (!collection) return draft;
  const merged = {
    ...(draft.ownerEdits ?? {}),
    ...input.ownerEdits,
  };
  await collection.doc(input.draftId).set(
    {
      ownerEdits: merged,
      updatedAt: nowIso(),
    },
    { merge: true },
  );
  return { ...draft, ownerEdits: merged, updatedAt: nowIso() };
}

/**
 * Publish the draft into the existing storefront pipeline. This is where
 * the AI's proposed listing actually becomes visible to consumers in the
 * Canopy Trove app + on the public storefront page (Phase 2).
 *
 * Phase 1 status: SCAFFOLD — the write-through to existing
 * storefront_summaries / storefront_details / dispensaryClaims is the
 * next concrete chunk of work.
 */
export async function publishDraft(input: {
  draftId: string;
  ownerUid: string;
}): Promise<{ ok: true; storefrontId: string } | { ok: false; reason: string }> {
  const draft = await getDraft(input.draftId, input.ownerUid);
  if (!draft) return { ok: false, reason: 'draft_not_found' };
  if (draft.status !== 'ready') {
    return { ok: false, reason: `draft_not_ready (status: ${draft.status})` };
  }
  // TODO(phase-1): merge draft.draft + draft.ownerEdits → storefront update.
  //   1. If publishedStorefrontId is set (claimed shop), update in place
  //   2. Otherwise, create a new ownerProfiles claim on the OCM-matched shop
  //   3. Update storefront_summaries + storefront_details with merged data
  //   4. Lazy-copy detected photos into Cloud Storage
  //   5. Mark draft status: 'published'
  return { ok: false, reason: 'not_implemented_phase_1' };
}

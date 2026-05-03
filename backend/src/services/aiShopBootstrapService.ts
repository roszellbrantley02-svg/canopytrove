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
import { parseScrapedContentWithClaudeVision } from './aiShopBootstrapVisionParser';
import { verifyAgainstCache } from './ocmLicenseCacheService';
import { getOwnerClaimCollection } from './ownerPortalWorkspaceCollections';

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
 * vision and get back the structured AiShopBootstrapDraftPayload,
 * then enrich with the OCM cross-reference (license number + matched
 * dispensary ID) so the owner-portal review step can show the trust
 * signal alongside the AI's draft.
 */
export async function parseScrapedContentWithVision(
  content: ScrapedWebsiteContent,
): Promise<AiShopBootstrapDraftPayload> {
  const draft = await parseScrapedContentWithClaudeVision(content);
  const ocmMatch = await crossReferenceOcm(draft);
  return { ...draft, ocmMatch };
}

/**
 * Cross-reference the AI-extracted name/address against the OCM
 * license cache. Returns a structured match indicator the review UI
 * uses to show a green/yellow/red trust pill, plus a candidate
 * matchedDispensaryId we can auto-link the listing to on publish.
 *
 * `verifyAgainstCache.confidence` rubric:
 *   exact:   license number match
 *   address: address+zip match
 *   name:    name+city match
 *   fuzzy:   weak signals
 *   none:    no match at all
 *
 * We map onto the draft's narrower 'high'|'medium'|'low'|'none'
 * rubric so the UI surface is consistent.
 */
async function crossReferenceOcm(
  draft: AiShopBootstrapDraftPayload,
): Promise<AiShopBootstrapDraftPayload['ocmMatch']> {
  const verifyInput = {
    address: draft.detectedAddress ?? undefined,
    city: draft.detectedCity ?? undefined,
    zip: draft.detectedZip ?? undefined,
    name: draft.detectedName ?? undefined,
  };
  // No fields to match on — skip the lookup.
  if (!verifyInput.address && !verifyInput.city && !verifyInput.zip && !verifyInput.name) {
    return null;
  }

  let result;
  try {
    result = await verifyAgainstCache(verifyInput);
  } catch {
    // OCM cache lookup failures must not block the bootstrap. Surface
    // as no-match; the owner can still publish.
    return null;
  }

  const confidence: 'high' | 'medium' | 'low' | 'none' =
    result.confidence === 'exact'
      ? 'high'
      : result.confidence === 'address'
        ? 'high'
        : result.confidence === 'name'
          ? 'medium'
          : result.confidence === 'fuzzy'
            ? 'low'
            : 'none';

  return {
    licenseNumber: result.record?.license_number ?? null,
    matchConfidence: confidence,
    // The OCM record's license_number is the canonical handle; the
    // existing storefront pipeline maps from licenseNumber → existing
    // storefront doc, which we'll resolve in publishDraft below.
    matchedDispensaryId: result.record?.license_number ?? null,
  };
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
  if (!draft.draft) {
    return { ok: false, reason: 'draft_payload_missing' };
  }

  // 1. Resolve which storefront we're publishing to.
  // Order of precedence:
  //   a. Owner explicitly attached the bootstrap to a claim (publishedStorefrontId set on creation)
  //   b. AI's OCM cross-reference returned a confident match
  //   c. No way to identify the storefront → block publish, ask owner to claim manually first
  let targetStorefrontId =
    draft.publishedStorefrontId ?? draft.draft.ocmMatch?.matchedDispensaryId ?? null;
  if (!targetStorefrontId) {
    return {
      ok: false,
      reason: 'no_storefront_match',
    };
  }

  // 2. Verify owner has an approved claim on this storefront. Without
  // this we'd be letting any owner edit any storefront just by pasting
  // its website URL.
  const claimsCollection = getOwnerClaimCollection();
  if (claimsCollection) {
    const claimSnap = await claimsCollection
      .where('ownerUid', '==', input.ownerUid)
      .where('dispensaryId', '==', targetStorefrontId)
      .limit(1)
      .get();
    if (claimSnap.empty) {
      return { ok: false, reason: 'no_approved_claim_for_storefront' };
    }
    const claim = claimSnap.docs[0].data();
    if (claim.claimStatus !== 'approved') {
      return { ok: false, reason: `claim_not_approved (${claim.claimStatus})` };
    }
  }

  // 3. Merge AI draft + owner edits — kept on the bootstrap draft doc
  // as the source of truth. Phase 1.5 will add write-through into the
  // various owner-side collections (owner_storefront_profile_tools for
  // hours/menu/photos, owner_storefront_brands for brand list,
  // owner_storefront_promotions for deals). Each destination has its
  // own narrow schema so the mapping is non-trivial — better to ship
  // a focused phase 1 with the draft saved + owner-claim verified, then
  // layer the write-throughs in cleanly.
  //
  // The bootstrap draft itself is now the primary record; downstream
  // owner-portal edit screens can read it via getDraft() and migrate
  // fields into their own collections at their own pace.
  const _merged: AiShopBootstrapDraftPayload = {
    ...draft.draft,
    ...(draft.ownerEdits ?? {}),
  };
  void _merged;

  // 4. Mark the draft as published.
  const draftCollection = getCollection();
  if (draftCollection) {
    await draftCollection.doc(input.draftId).set(
      {
        status: 'published' satisfies ShopBootstrapStatus,
        publishedAt: nowIso(),
        publishedStorefrontId: targetStorefrontId,
        updatedAt: nowIso(),
      },
      { merge: true },
    );
  }

  return { ok: true, storefrontId: targetStorefrontId };
}

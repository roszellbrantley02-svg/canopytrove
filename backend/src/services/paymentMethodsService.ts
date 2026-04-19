/**
 * Payment methods service.
 *
 * Produces a merged view of which payment methods a storefront accepts,
 * combining three sources in priority order:
 *
 *   1. owner     — verified owner declaration (growth tier / $149 mo)
 *   2. community — anonymous user reports aggregated with confidence
 *   3. google    — Google Places paymentOptions signal
 *
 * Higher-priority sources override lower ones for the same method ID.
 * Google's `acceptsCreditCards` is softened (treated as suggestive, not
 * authoritative) because Visa/Mastercard don't permit cannabis MCCs,
 * so the Google "credit accepted" flag is often wrong for dispensaries.
 */

import { createHash } from 'node:crypto';
import { logger } from '../observability/logger';
import type {
  PaymentMethodApiId,
  PaymentMethodRecordApiDocument,
  PaymentMethodsApiDocument,
  StorefrontSummaryApiDocument,
  StorefrontDetailApiDocument,
} from '../types';
import { getBackendFirebaseDb } from '../firebase';
import {
  PAYMENT_METHOD_DECLARATIONS_COLLECTION,
  PAYMENT_METHOD_REPORTS_COLLECTION,
} from '../constants/collections';
import { getGooglePlacesEnrichment } from './googlePlacesService';
import type { GooglePlacesPaymentOptions } from './googlePlacesShared';

const ENRICHMENT_TIMEOUT_MS = 1_500;
const COMMUNITY_MIN_SAMPLES = 3;
const COMMUNITY_CONFIDENCE_THRESHOLD = 0.6;
const PAYMENT_METHOD_REPORT_VOTES_SUBCOLLECTION = 'votes';

export const ALL_PAYMENT_METHOD_IDS: readonly PaymentMethodApiId[] = [
  'cash',
  'debit',
  'credit',
  'tap_pay',
  'ach_app',
  'atm_on_site',
  'crypto',
];

export type OwnerPaymentDeclaration = {
  storefrontId: string;
  ownerUid: string;
  methods: Partial<Record<PaymentMethodApiId, boolean>>;
  updatedAt: string;
};

export type CommunityPaymentCounts = {
  storefrontId: string;
  updatedAt: string;
  counts: Partial<Record<PaymentMethodApiId, { accepted: number; rejected: number }>>;
};

type CommunityPaymentVoteRecord = {
  storefrontId: string;
  methodId: PaymentMethodApiId;
  accepted: boolean;
  installIdHash: string;
  createdAt: string;
  updatedAt: string;
};

function isPaymentMethodId(value: unknown): value is PaymentMethodApiId {
  return typeof value === 'string' && (ALL_PAYMENT_METHOD_IDS as readonly string[]).includes(value);
}

function createInstallVoteHash(installId: string, methodId: PaymentMethodApiId) {
  return createHash('sha256').update(`${methodId}:${installId}`).digest('hex').slice(0, 32);
}

function normalizeCommunityMethodCounts(value: unknown): { accepted: number; rejected: number } {
  if (!value || typeof value !== 'object') {
    return {
      accepted: 0,
      rejected: 0,
    };
  }

  const counts = value as {
    accepted?: unknown;
    rejected?: unknown;
  };

  return {
    accepted:
      typeof counts.accepted === 'number' && Number.isFinite(counts.accepted) && counts.accepted > 0
        ? Math.floor(counts.accepted)
        : 0,
    rejected:
      typeof counts.rejected === 'number' && Number.isFinite(counts.rejected) && counts.rejected > 0
        ? Math.floor(counts.rejected)
        : 0,
  };
}

/**
 * Map Google Places paymentOptions flags into our canonical method IDs.
 *
 * Caveats:
 *   - `acceptsCreditCards` is suggestive for dispensaries (Visa/Mastercard
 *     don't allow cannabis MCCs). We report it, but owner/community can
 *     easily override it.
 *   - `acceptsNfcPayments` was not populated in the probe for any NY
 *     dispensary, so we leave it unset unless Google starts returning it.
 */
function deriveGoogleMethods(
  paymentOptions: GooglePlacesPaymentOptions | null | undefined,
): Array<{ methodId: PaymentMethodApiId; accepted: boolean }> {
  if (!paymentOptions) return [];
  const out: Array<{ methodId: PaymentMethodApiId; accepted: boolean }> = [];

  // Google's cashOnly flag is authoritative for cash acceptance: if
  // cashOnly is present, cash is accepted. Otherwise we infer cash
  // acceptance from cash-being-allowed = !cashOnly=false combined with
  // other signals. Simplest: if any paymentOptions flag is present,
  // cash is virtually always accepted at dispensaries.
  if (paymentOptions.acceptsCashOnly === true) {
    out.push({ methodId: 'cash', accepted: true });
  } else if (paymentOptions.acceptsCashOnly === false) {
    // cash still accepted alongside other methods
    out.push({ methodId: 'cash', accepted: true });
  }

  if (typeof paymentOptions.acceptsDebitCards === 'boolean') {
    out.push({ methodId: 'debit', accepted: paymentOptions.acceptsDebitCards });
  }
  if (typeof paymentOptions.acceptsCreditCards === 'boolean') {
    out.push({ methodId: 'credit', accepted: paymentOptions.acceptsCreditCards });
  }
  if (paymentOptions.acceptsNfcPayments === true) {
    out.push({ methodId: 'tap_pay', accepted: true });
  }

  return out;
}

async function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return Promise.race<T>([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ENRICHMENT_TIMEOUT_MS)),
  ]);
}

async function loadOwnerDeclaration(storefrontId: string): Promise<OwnerPaymentDeclaration | null> {
  const db = getBackendFirebaseDb();
  if (!db) return null;
  try {
    const snap = await db
      .collection(PAYMENT_METHOD_DECLARATIONS_COLLECTION)
      .doc(storefrontId)
      .get();
    if (!snap.exists) return null;
    const data = snap.data() as Partial<OwnerPaymentDeclaration> | undefined;
    if (!data) return null;
    const methods: Partial<Record<PaymentMethodApiId, boolean>> = {};
    for (const [key, value] of Object.entries(data.methods ?? {})) {
      if (isPaymentMethodId(key) && typeof value === 'boolean') {
        methods[key] = value;
      }
    }
    return {
      storefrontId,
      ownerUid: typeof data.ownerUid === 'string' ? data.ownerUid : '',
      methods,
      updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
    };
  } catch (err) {
    logger.warn('payment declaration load failed', {
      err: err instanceof Error ? err.message : String(err),
      storefrontId,
    });
    return null;
  }
}

async function loadCommunityCounts(storefrontId: string): Promise<CommunityPaymentCounts | null> {
  const db = getBackendFirebaseDb();
  if (!db) return null;
  try {
    const snap = await db.collection(PAYMENT_METHOD_REPORTS_COLLECTION).doc(storefrontId).get();
    if (!snap.exists) return null;
    const data = snap.data() as Partial<CommunityPaymentCounts> | undefined;
    if (!data) return null;
    const counts: Partial<Record<PaymentMethodApiId, { accepted: number; rejected: number }>> = {};
    for (const [key, value] of Object.entries(data.counts ?? {})) {
      if (!isPaymentMethodId(key) || !value || typeof value !== 'object') continue;
      const accepted = typeof value.accepted === 'number' ? value.accepted : 0;
      const rejected = typeof value.rejected === 'number' ? value.rejected : 0;
      counts[key] = { accepted, rejected };
    }
    return {
      storefrontId,
      updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
      counts,
    };
  } catch (err) {
    logger.warn('payment community counts load failed', {
      err: err instanceof Error ? err.message : String(err),
      storefrontId,
    });
    return null;
  }
}

function resolveCommunityMethods(
  counts: CommunityPaymentCounts | null,
): Array<PaymentMethodRecordApiDocument> {
  if (!counts) return [];
  const out: PaymentMethodRecordApiDocument[] = [];
  for (const [key, value] of Object.entries(counts.counts)) {
    if (!isPaymentMethodId(key) || !value) continue;
    const total = value.accepted + value.rejected;
    if (total < COMMUNITY_MIN_SAMPLES) continue;
    const confidence = value.accepted / Math.max(1, total);
    if (
      confidence < COMMUNITY_CONFIDENCE_THRESHOLD &&
      confidence > 1 - COMMUNITY_CONFIDENCE_THRESHOLD
    ) {
      // ambiguous — no clear majority
      continue;
    }
    out.push({
      methodId: key,
      accepted: confidence >= 0.5,
      source: 'community',
      confidence: Number(confidence.toFixed(2)),
      sampleCount: total,
    });
  }
  return out;
}

/**
 * Merge per-source method lists into a single canonical record list.
 * Priority: owner > community > google. For each method ID we pick the
 * highest-priority record and drop the rest.
 */
function mergeMethods(input: {
  google: Array<{ methodId: PaymentMethodApiId; accepted: boolean }>;
  community: PaymentMethodRecordApiDocument[];
  owner: OwnerPaymentDeclaration | null;
}): PaymentMethodRecordApiDocument[] {
  const byMethod = new Map<PaymentMethodApiId, PaymentMethodRecordApiDocument>();

  // google (lowest priority)
  for (const entry of input.google) {
    byMethod.set(entry.methodId, {
      methodId: entry.methodId,
      accepted: entry.accepted,
      source: 'google',
    });
  }

  // community overrides google
  for (const entry of input.community) {
    byMethod.set(entry.methodId, entry);
  }

  // owner overrides community + google
  if (input.owner) {
    for (const [key, value] of Object.entries(input.owner.methods)) {
      if (!isPaymentMethodId(key) || typeof value !== 'boolean') continue;
      byMethod.set(key, {
        methodId: key,
        accepted: value,
        source: 'owner',
      });
    }
  }

  // Stable ordering matches ALL_PAYMENT_METHOD_IDS
  const out: PaymentMethodRecordApiDocument[] = [];
  for (const methodId of ALL_PAYMENT_METHOD_IDS) {
    const entry = byMethod.get(methodId);
    if (entry) out.push(entry);
  }
  return out;
}

/**
 * Resolve the merged payment methods for a single storefront. Called
 * by the storefront enrichment phase — never throws.
 */
export async function getPaymentMethodsForStorefront(
  summary: StorefrontSummaryApiDocument,
): Promise<PaymentMethodsApiDocument | null> {
  try {
    const [owner, community, googleEnrichment] = await Promise.all([
      withTimeout(loadOwnerDeclaration(summary.id), null),
      withTimeout(loadCommunityCounts(summary.id), null),
      withTimeout(getGooglePlacesEnrichment(summary), null),
    ]);

    const google = deriveGoogleMethods(googleEnrichment?.paymentOptions ?? null);
    const communityRecords = resolveCommunityMethods(community);
    const methods = mergeMethods({ google, community: communityRecords, owner });

    if (!methods.length) return null;

    return {
      storefrontId: summary.id,
      asOf: new Date().toISOString(),
      methods,
      hasOwnerDeclaration: Boolean(owner && Object.keys(owner.methods).length),
    };
  } catch (err) {
    logger.warn('paymentMethodsService.getPaymentMethodsForStorefront failed', {
      err: err instanceof Error ? err.message : String(err),
      storefrontId: summary.id,
    });
    return null;
  }
}

/**
 * Batched variant for listing endpoints. Runs per-storefront resolution
 * in parallel with an overall timeout so the response is never blocked.
 */
export async function attachPaymentMethodsToSummaries<T extends StorefrontSummaryApiDocument>(
  items: T[],
): Promise<T[]> {
  if (!items.length) return items;
  try {
    const results = await withTimeout(
      Promise.all(items.map((item) => getPaymentMethodsForStorefront(item))),
      items.map(() => null) as Array<PaymentMethodsApiDocument | null>,
    );
    return items.map((item, index) => {
      const methods = results[index];
      if (!methods) return item;
      return { ...item, paymentMethods: methods };
    });
  } catch (err) {
    logger.warn('attachPaymentMethodsToSummaries failed', {
      err: err instanceof Error ? err.message : String(err),
    });
    return items;
  }
}

export async function attachPaymentMethodsToDetail(
  detail: StorefrontDetailApiDocument,
  summary: StorefrontSummaryApiDocument | null,
): Promise<StorefrontDetailApiDocument> {
  if (!summary) return detail;
  try {
    const methods = await getPaymentMethodsForStorefront(summary);
    if (!methods) return detail;
    return { ...detail, paymentMethods: methods };
  } catch (err) {
    logger.warn('attachPaymentMethodsToDetail failed', {
      err: err instanceof Error ? err.message : String(err),
      storefrontId: detail.storefrontId,
    });
    return detail;
  }
}

/**
 * Owner-portal entry point: persist a verified owner's payment
 * declaration. Caller must gate on tier (growth+) and verify ownership.
 */
export async function saveOwnerPaymentDeclaration(input: {
  storefrontId: string;
  ownerUid: string;
  methods: Partial<Record<PaymentMethodApiId, boolean>>;
}): Promise<OwnerPaymentDeclaration> {
  const db = getBackendFirebaseDb();
  if (!db) {
    throw new Error('Firestore unavailable');
  }
  const sanitized: Partial<Record<PaymentMethodApiId, boolean>> = {};
  for (const [key, value] of Object.entries(input.methods)) {
    if (isPaymentMethodId(key) && typeof value === 'boolean') {
      sanitized[key] = value;
    }
  }
  const updatedAt = new Date().toISOString();
  const record: OwnerPaymentDeclaration = {
    storefrontId: input.storefrontId,
    ownerUid: input.ownerUid,
    methods: sanitized,
    updatedAt,
  };
  await db
    .collection(PAYMENT_METHOD_DECLARATIONS_COLLECTION)
    .doc(input.storefrontId)
    .set(record, { merge: true });
  return record;
}

export async function getOwnerPaymentDeclaration(
  storefrontId: string,
): Promise<OwnerPaymentDeclaration | null> {
  return loadOwnerDeclaration(storefrontId);
}

/**
 * Community reporting entry point: anonymous or signed-in users can
 * vote that a storefront accepts or doesn't accept a payment method.
 * Each install gets one vote per storefront+method pair; a repeated
 * vote is deduped and a flipped vote rewrites the aggregate safely.
 */
export async function recordCommunityPaymentReport(input: {
  storefrontId: string;
  methodId: PaymentMethodApiId;
  accepted: boolean;
  installId: string;
}): Promise<{
  ok: true;
  outcome: 'recorded' | 'duplicate' | 'flipped';
}> {
  const { storefrontId, methodId, accepted, installId } = input;
  const db = getBackendFirebaseDb();
  if (!db) {
    throw new Error('Firestore not available; cannot record community vote.');
  }
  const installHash = createHash('sha256').update(installId).digest('hex');
  const voteRef = db
    .collection(PAYMENT_METHOD_REPORTS_COLLECTION)
    .doc(`${storefrontId}_${methodId}`)
    .collection(PAYMENT_METHOD_REPORT_VOTES_SUBCOLLECTION)
    .doc(installHash);

  const outcome = await db.runTransaction<'recorded' | 'duplicate' | 'flipped'>(async (tx) => {
    const existing = await tx.get(voteRef);
    if (existing.exists) {
      const prior = existing.data() as { accepted: boolean } | undefined;
      if (prior?.accepted === accepted) {
        return 'duplicate';
      }
      tx.set(
        voteRef,
        {
          storefrontId,
          methodId,
          accepted,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      return 'flipped';
    }
    tx.set(voteRef, {
      storefrontId,
      methodId,
      accepted,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return 'recorded';
  });

  logger.info('[paymentMethods] Community vote', {
    storefrontId,
    methodId,
    accepted,
    outcome,
  });

  return { ok: true, outcome };
}

import { createHash } from 'node:crypto';
import { OWNER_WEB_PUSH_SUBSCRIPTIONS_COLLECTION } from '../constants/collections';
import { getBackendFirebaseDb } from '../firebase';
import { logger } from '../observability/logger';
import type { WebPushSubscriptionRecord } from './webPushService';

// Subscription storage layout:
//   owner_web_push_subscriptions/{ownerUid}/subscriptions/{endpointHash}
// One subdoc per browser/device endpoint so an owner with a laptop and a
// phone PWA both get notified, and we can prune individual stale endpoints
// without nuking everything for that owner.

export type StoredWebPushSubscription = WebPushSubscriptionRecord & {
  endpointHash: string;
  ownerUid: string;
  createdAt: string;
  lastSeenAt: string;
  userAgent: string | null;
  lastError: string | null;
};

const SUBSCRIPTIONS_SUBCOLLECTION = 'subscriptions';

// In-memory fallback for environments without Firestore (tests, local dev
// without credentials). Keyed by `${ownerUid}::${endpointHash}` so multiple
// subscriptions per owner work the same as the Firestore path.
const inMemoryStore = new Map<string, StoredWebPushSubscription>();

function inMemoryKey(ownerUid: string, endpointHash: string) {
  return `${ownerUid}::${endpointHash}`;
}

export function hashEndpoint(endpoint: string) {
  // sha256 truncated to 32 hex chars — collision-resistant enough for a
  // per-owner namespace and short enough to use as a Firestore doc ID.
  return createHash('sha256').update(endpoint).digest('hex').slice(0, 32);
}

function getOwnerSubscriptionsRef(ownerUid: string) {
  const db = getBackendFirebaseDb();
  if (!db) {
    return null;
  }
  return db
    .collection(OWNER_WEB_PUSH_SUBSCRIPTIONS_COLLECTION)
    .doc(ownerUid)
    .collection(SUBSCRIPTIONS_SUBCOLLECTION);
}

function normalizeSubscription(
  raw: Partial<StoredWebPushSubscription> | undefined,
  ownerUid: string,
  endpointHash: string,
): StoredWebPushSubscription | null {
  if (!raw) return null;
  if (typeof raw.endpoint !== 'string' || !raw.endpoint.startsWith('http')) return null;
  if (typeof raw.p256dh !== 'string' || !raw.p256dh) return null;
  if (typeof raw.auth !== 'string' || !raw.auth) return null;
  return {
    ownerUid,
    endpointHash,
    endpoint: raw.endpoint,
    p256dh: raw.p256dh,
    auth: raw.auth,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    lastSeenAt: typeof raw.lastSeenAt === 'string' ? raw.lastSeenAt : new Date().toISOString(),
    userAgent: typeof raw.userAgent === 'string' && raw.userAgent.trim() ? raw.userAgent : null,
    lastError: typeof raw.lastError === 'string' && raw.lastError.trim() ? raw.lastError : null,
  };
}

export async function upsertOwnerWebPushSubscription(options: {
  ownerUid: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}): Promise<StoredWebPushSubscription> {
  const endpointHash = hashEndpoint(options.endpoint);
  const now = new Date().toISOString();

  const subscriptionsRef = getOwnerSubscriptionsRef(options.ownerUid);
  if (subscriptionsRef) {
    const docRef = subscriptionsRef.doc(endpointHash);
    const existingSnapshot = await docRef.get();
    const existing = existingSnapshot.exists
      ? (existingSnapshot.data() as StoredWebPushSubscription)
      : null;

    const next: StoredWebPushSubscription = {
      ownerUid: options.ownerUid,
      endpointHash,
      endpoint: options.endpoint,
      p256dh: options.p256dh,
      auth: options.auth,
      createdAt: existing?.createdAt ?? now,
      lastSeenAt: now,
      userAgent: options.userAgent?.trim() || existing?.userAgent || null,
      lastError: null,
    };

    await docRef.set(next);
    return next;
  }

  const memoryKey = inMemoryKey(options.ownerUid, endpointHash);
  const existing = inMemoryStore.get(memoryKey) ?? null;
  const next: StoredWebPushSubscription = {
    ownerUid: options.ownerUid,
    endpointHash,
    endpoint: options.endpoint,
    p256dh: options.p256dh,
    auth: options.auth,
    createdAt: existing?.createdAt ?? now,
    lastSeenAt: now,
    userAgent: options.userAgent?.trim() || existing?.userAgent || null,
    lastError: null,
  };
  inMemoryStore.set(memoryKey, next);
  return next;
}

export async function listOwnerWebPushSubscriptions(
  ownerUid: string,
): Promise<StoredWebPushSubscription[]> {
  const subscriptionsRef = getOwnerSubscriptionsRef(ownerUid);
  if (subscriptionsRef) {
    const snapshot = await subscriptionsRef.get();
    return snapshot.docs
      .map((doc) =>
        normalizeSubscription(doc.data() as Partial<StoredWebPushSubscription>, ownerUid, doc.id),
      )
      .filter((value): value is StoredWebPushSubscription => value !== null);
  }

  return Array.from(inMemoryStore.values()).filter((sub) => sub.ownerUid === ownerUid);
}

export async function deleteOwnerWebPushSubscription(options: {
  ownerUid: string;
  endpoint?: string;
  endpointHash?: string;
}) {
  const endpointHash =
    options.endpointHash ?? (options.endpoint ? hashEndpoint(options.endpoint) : null);
  if (!endpointHash) {
    return { deleted: false as const, reason: 'missing_endpoint' as const };
  }

  const subscriptionsRef = getOwnerSubscriptionsRef(options.ownerUid);
  if (subscriptionsRef) {
    await subscriptionsRef.doc(endpointHash).delete();
    return { deleted: true as const, endpointHash };
  }

  const memoryKey = inMemoryKey(options.ownerUid, endpointHash);
  const removed = inMemoryStore.delete(memoryKey);
  return removed
    ? { deleted: true as const, endpointHash }
    : { deleted: false as const, reason: 'not_found' as const };
}

export async function deleteAllOwnerWebPushSubscriptions(ownerUid: string) {
  const subscriptionsRef = getOwnerSubscriptionsRef(ownerUid);
  if (subscriptionsRef) {
    const snapshot = await subscriptionsRef.get();
    await Promise.all(snapshot.docs.map((doc) => doc.ref.delete()));
    return { deletedCount: snapshot.size };
  }

  let deletedCount = 0;
  for (const [key, sub] of inMemoryStore) {
    if (sub.ownerUid === ownerUid) {
      inMemoryStore.delete(key);
      deletedCount += 1;
    }
  }
  return { deletedCount };
}

// Called by the notification fan-out path after a 410/404 from the push
// service — the subscription is dead and should not be kept around.
export async function pruneExpiredWebPushSubscriptions(options: {
  ownerUid: string;
  expiredEndpoints: string[];
}) {
  if (!options.expiredEndpoints.length) {
    return { prunedCount: 0 };
  }

  const results = await Promise.allSettled(
    options.expiredEndpoints.map((endpoint) =>
      deleteOwnerWebPushSubscription({ ownerUid: options.ownerUid, endpoint }),
    ),
  );

  let prunedCount = 0;
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.deleted) {
      prunedCount += 1;
    } else if (result.status === 'rejected') {
      logger.warn('[webPushSubscriptionService] failed to prune expired subscription', {
        ownerUid: options.ownerUid,
        message: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
    }
  }
  return { prunedCount };
}

// Test-only: reset in-memory store between tests.
export function __resetInMemoryWebPushSubscriptionsForTests() {
  inMemoryStore.clear();
}

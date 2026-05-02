/**
 * Per-account-per-day idempotence log for the deal-digest cron.
 *
 * Without this log, a manual re-run of the dispatch endpoint (or a
 * silent retry from GitHub Actions) would re-send a digest email for a
 * day that already had one. With it, each account gets at most one
 * digest per UTC day even if the cron fires twice.
 *
 * Collection: `deal_digest_email_log`
 * Doc id: `${accountId}__${YYYYMMDD-utc}`
 *
 * Read (`wasDigestSentToday`): single-doc lookup, deterministic, fast.
 * Write (`recordDigestSent`): single-doc set with merge:true.
 *
 * Mode fallbacks:
 * - Firestore mode: real persistence, idempotent across processes.
 * - Memory mode (test/dev without Firestore): an in-process Map keyed
 *   the same way. Reset between test runs via `clearDealDigestLogStateForTests`.
 */
import { getOptionalFirestoreCollection } from '../firestoreCollections';

const DEAL_DIGEST_EMAIL_LOG_COLLECTION = 'deal_digest_email_log';

export type DealDigestLogRecord = {
  accountId: string;
  // Local label of the send day in UTC (e.g. "20260502"). Stored as a
  // string so the doc id stays human-readable.
  utcDayKey: string;
  sentAtIso: string;
  profileId: string;
  shopCount: number;
  providerMessageId: string | null;
};

const memoryDigestLogStore = new Map<string, DealDigestLogRecord>();

function getCollection() {
  return getOptionalFirestoreCollection<DealDigestLogRecord>(DEAL_DIGEST_EMAIL_LOG_COLLECTION);
}

export function getUtcDayKey(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function buildDocId(accountId: string, utcDayKey: string): string {
  // Sanitize accountId: Firestore doc ids cannot contain `/`. Underscores
  // are fine. Use double underscore as separator since accountId may
  // already contain single underscores.
  const safeAccountId = accountId.replace(/\//g, '_');
  return `${safeAccountId}__${utcDayKey}`;
}

export async function wasDigestSentToday(
  accountId: string,
  utcDayKey: string = getUtcDayKey(),
): Promise<boolean> {
  const collection = getCollection();
  const docId = buildDocId(accountId, utcDayKey);
  if (!collection) {
    return memoryDigestLogStore.has(docId);
  }

  const snapshot = await collection.doc(docId).get();
  return snapshot.exists;
}

export async function recordDigestSent(input: {
  accountId: string;
  profileId: string;
  shopCount: number;
  providerMessageId: string | null;
  utcDayKey?: string;
  sentAt?: Date;
}): Promise<void> {
  const utcDayKey = input.utcDayKey ?? getUtcDayKey(input.sentAt);
  const sentAtIso = (input.sentAt ?? new Date()).toISOString();
  const docId = buildDocId(input.accountId, utcDayKey);
  const record: DealDigestLogRecord = {
    accountId: input.accountId,
    utcDayKey,
    sentAtIso,
    profileId: input.profileId,
    shopCount: input.shopCount,
    providerMessageId: input.providerMessageId,
  };

  const collection = getCollection();
  if (!collection) {
    memoryDigestLogStore.set(docId, record);
    return;
  }

  await collection.doc(docId).set(record, { merge: true });
}

export function clearDealDigestLogStateForTests(): void {
  memoryDigestLogStore.clear();
}

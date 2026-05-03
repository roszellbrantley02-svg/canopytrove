import { getOptionalFirestoreCollection } from '../firestoreCollections';
import { backendStorefrontSourceStatus } from '../sources';
import { sendTransactionalEmail } from './emailDeliveryService';
import { buildMemberWelcomeEmail } from './transactionalEmailTemplates';
import {
  type TransactionalEmailDeliveryState,
  getDeliveryStateForResendEventType,
  normalizeDeliveryEventSummary,
  normalizeDeliveryEventType,
  normalizeProviderEventId,
  normalizeProviderMessageId,
} from './transactionalEmailEventUtils';

export type MemberEmailSubscriptionSource = 'member_signup' | 'profile';

type MemberEmailSubscriptionRecord = {
  accountId: string;
  email: string;
  displayName: string | null;
  subscribed: boolean;
  source: MemberEmailSubscriptionSource;
  createdAt: string;
  updatedAt: string;
  consentedAt: string | null;
  unsubscribedAt: string | null;
  welcomeEmailSentAt: string | null;
  lastWelcomeEmailAttemptAt: string | null;
  lastWelcomeEmailError: string | null;
  providerMessageId: string | null;
  lastDeliveryEventId: string | null;
  lastDeliveryEventType: string | null;
  lastDeliveryEventAt: string | null;
  lastDeliveryEventSummary: string | null;
  // Per-channel opt-outs (added May 2 2026 with the deal-digest pipeline).
  // Default false = the user receives the channel. One-click unsubscribe
  // links flip the relevant flag to true. The global `subscribed` flag
  // still wins — if subscribed=false, no channel sends regardless.
  dealDigestOptOut?: boolean;
  dealDigestOptOutAt?: string | null;
};

export type MemberEmailSubscriptionStatus = {
  accountId: string;
  email: string | null;
  displayName: string | null;
  subscribed: boolean;
  source: MemberEmailSubscriptionSource;
  updatedAt: string | null;
  consentedAt: string | null;
  unsubscribedAt: string | null;
  welcomeEmailSentAt: string | null;
  welcomeEmailState: TransactionalEmailDeliveryState;
  welcomeEmailError: string | null;
  welcomeEmailLastEventType: string | null;
  welcomeEmailLastEventAt: string | null;
  welcomeEmailLastEventSummary: string | null;
};

const MEMBER_EMAIL_SUBSCRIPTIONS_COLLECTION = 'member_email_subscriptions';
const memberEmailSubscriptionStore = new Map<string, MemberEmailSubscriptionRecord>();

function getNowIso() {
  return new Date().toISOString();
}

function trimValue(value: string | null | undefined) {
  return value?.trim() || null;
}

function normalizeEmail(value: string | null | undefined) {
  const trimmed = trimValue(value);
  return trimmed ? trimmed.toLowerCase() : null;
}

function normalizeDisplayName(value: string | null | undefined) {
  return trimValue(value);
}

function normalizeIsoDate(value: string | null | undefined) {
  const trimmed = trimValue(value);
  return trimmed && !Number.isNaN(Date.parse(trimmed)) ? trimmed : null;
}

function truncateError(value: string | null | undefined) {
  const trimmed = trimValue(value);
  return trimmed ? trimmed.slice(0, 240) : null;
}

function normalizeRecord(record: MemberEmailSubscriptionRecord): MemberEmailSubscriptionRecord {
  return {
    accountId: record.accountId.trim(),
    email: normalizeEmail(record.email) ?? '',
    displayName: normalizeDisplayName(record.displayName),
    subscribed: Boolean(record.subscribed),
    source: record.source === 'profile' ? 'profile' : 'member_signup',
    createdAt: normalizeIsoDate(record.createdAt) ?? getNowIso(),
    updatedAt: normalizeIsoDate(record.updatedAt) ?? getNowIso(),
    consentedAt: normalizeIsoDate(record.consentedAt),
    unsubscribedAt: normalizeIsoDate(record.unsubscribedAt),
    welcomeEmailSentAt: normalizeIsoDate(record.welcomeEmailSentAt),
    lastWelcomeEmailAttemptAt: normalizeIsoDate(record.lastWelcomeEmailAttemptAt),
    lastWelcomeEmailError: truncateError(record.lastWelcomeEmailError),
    providerMessageId: normalizeProviderMessageId(record.providerMessageId),
    lastDeliveryEventId: normalizeProviderEventId(record.lastDeliveryEventId),
    lastDeliveryEventType: normalizeDeliveryEventType(record.lastDeliveryEventType),
    lastDeliveryEventAt: normalizeIsoDate(record.lastDeliveryEventAt),
    lastDeliveryEventSummary: normalizeDeliveryEventSummary(record.lastDeliveryEventSummary),
    dealDigestOptOut: Boolean(record.dealDigestOptOut),
    dealDigestOptOutAt: normalizeIsoDate(record.dealDigestOptOutAt),
  };
}

function createDefaultRecord(input: {
  accountId: string;
  email: string;
  displayName?: string | null;
}): MemberEmailSubscriptionRecord {
  const now = getNowIso();
  return {
    accountId: input.accountId.trim(),
    email: normalizeEmail(input.email) ?? '',
    displayName: normalizeDisplayName(input.displayName),
    subscribed: false,
    source: 'member_signup',
    createdAt: now,
    updatedAt: now,
    consentedAt: null,
    unsubscribedAt: null,
    welcomeEmailSentAt: null,
    lastWelcomeEmailAttemptAt: null,
    lastWelcomeEmailError: null,
    providerMessageId: null,
    lastDeliveryEventId: null,
    lastDeliveryEventType: null,
    lastDeliveryEventAt: null,
    lastDeliveryEventSummary: null,
  };
}

function getCollection() {
  return getOptionalFirestoreCollection<MemberEmailSubscriptionRecord>(
    MEMBER_EMAIL_SUBSCRIPTIONS_COLLECTION,
  );
}

async function getRecord(
  accountId: string,
  options?: { email?: string | null; displayName?: string | null },
) {
  const collectionRef = getCollection();
  if (collectionRef) {
    const snapshot = await collectionRef.doc(accountId).get();
    if (!snapshot.exists) {
      return createDefaultRecord({
        accountId,
        email: options?.email ?? '',
        displayName: options?.displayName ?? null,
      });
    }

    return normalizeRecord(snapshot.data() as MemberEmailSubscriptionRecord);
  }

  const existingRecord = memberEmailSubscriptionStore.get(accountId);
  if (existingRecord) {
    return normalizeRecord(existingRecord);
  }

  return createDefaultRecord({
    accountId,
    email: options?.email ?? '',
    displayName: options?.displayName ?? null,
  });
}

async function saveRecord(record: MemberEmailSubscriptionRecord) {
  const normalized = normalizeRecord(record);
  const collectionRef = getCollection();
  if (collectionRef) {
    await collectionRef.doc(normalized.accountId).set(normalized);
    return normalized;
  }

  memberEmailSubscriptionStore.set(normalized.accountId, normalized);
  return normalized;
}

function getWelcomeEmailState(
  record: MemberEmailSubscriptionRecord,
): MemberEmailSubscriptionStatus['welcomeEmailState'] {
  const deliveryState = getDeliveryStateForResendEventType(record.lastDeliveryEventType);
  if (deliveryState) {
    return deliveryState;
  }

  if (record.welcomeEmailSentAt) {
    return 'sent';
  }

  if (!record.subscribed) {
    return 'not_requested';
  }

  if (record.lastWelcomeEmailError) {
    return record.lastWelcomeEmailError === 'not_configured' ? 'pending_provider' : 'failed';
  }

  return 'pending_provider';
}

function toStatus(record: MemberEmailSubscriptionRecord): MemberEmailSubscriptionStatus {
  return {
    accountId: record.accountId,
    email: record.email || null,
    displayName: record.displayName,
    subscribed: record.subscribed,
    source: record.source,
    updatedAt: record.updatedAt,
    consentedAt: record.consentedAt,
    unsubscribedAt: record.unsubscribedAt,
    welcomeEmailSentAt: record.welcomeEmailSentAt,
    welcomeEmailState: getWelcomeEmailState(record),
    welcomeEmailError:
      record.lastWelcomeEmailError && record.lastWelcomeEmailError !== 'not_configured'
        ? record.lastWelcomeEmailError
        : null,
    welcomeEmailLastEventType: record.lastDeliveryEventType,
    welcomeEmailLastEventAt: record.lastDeliveryEventAt,
    welcomeEmailLastEventSummary: record.lastDeliveryEventSummary,
  };
}

async function findRecordByProviderMessageId(providerMessageId: string) {
  const normalizedMessageId = normalizeProviderMessageId(providerMessageId);
  if (!normalizedMessageId) {
    return null;
  }

  const collectionRef = getCollection();
  if (collectionRef) {
    const snapshot = await collectionRef
      .where('providerMessageId', '==', normalizedMessageId)
      .limit(1)
      .get();
    if (snapshot.empty) {
      return null;
    }

    return normalizeRecord(snapshot.docs[0]?.data() as MemberEmailSubscriptionRecord);
  }

  const record = Array.from(memberEmailSubscriptionStore.values()).find(
    (candidate) => normalizeProviderMessageId(candidate.providerMessageId) === normalizedMessageId,
  );
  return record ? normalizeRecord(record) : null;
}

async function sendWelcomeEmailIfNeeded(record: MemberEmailSubscriptionRecord) {
  // Welcome email is TRANSACTIONAL — fires once per account on first
  // record creation. The `subscribed` flag governs ongoing marketing
  // emails (deal digests etc.), NOT the initial welcome notice. Before
  // May 3 2026 this also required `subscribed === true`, which meant
  // every signed-up user who didn't tick the marketing-opt-in checkbox
  // got nothing — including real users (Alicia + 3 Apple-relay accts
  // discovered during the post-mortem on the welcome-email backfill).
  if (record.welcomeEmailSentAt || !record.email) {
    return record;
  }

  const emailContent = buildMemberWelcomeEmail({
    displayName: record.displayName,
  });
  const now = getNowIso();
  const result = await sendTransactionalEmail({
    to: record.email,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
    idempotencyKey: `member-welcome:${record.accountId}`,
    tags: [
      {
        name: 'email_type',
        value: 'member_welcome',
      },
      {
        name: 'audience',
        value: 'member',
      },
    ],
  });

  if (!result.ok) {
    if (result.code === 'not_configured') {
      return saveRecord({
        ...record,
        lastWelcomeEmailError: 'not_configured',
        updatedAt: now,
      });
    }

    return saveRecord({
      ...record,
      updatedAt: now,
      lastWelcomeEmailAttemptAt: now,
      lastWelcomeEmailError: result.message,
    });
  }

  return saveRecord({
    ...record,
    updatedAt: now,
    welcomeEmailSentAt: now,
    lastWelcomeEmailAttemptAt: now,
    lastWelcomeEmailError: null,
    providerMessageId: result.id,
  });
}

export async function recordMemberWelcomeEmailDeliveryEvent(input: {
  providerMessageId: string;
  providerEventId?: string | null;
  eventType: string;
  occurredAt?: string | null;
  summary?: string | null;
}) {
  const record = await findRecordByProviderMessageId(input.providerMessageId);
  if (!record) {
    return null;
  }

  return toStatus(
    await saveRecord({
      ...record,
      updatedAt: getNowIso(),
      lastDeliveryEventId: normalizeProviderEventId(input.providerEventId),
      lastDeliveryEventType: normalizeDeliveryEventType(input.eventType),
      lastDeliveryEventAt: normalizeIsoDate(input.occurredAt) ?? getNowIso(),
      lastDeliveryEventSummary: normalizeDeliveryEventSummary(input.summary),
    }),
  );
}

/**
 * Returns the eligibility profile for the daily deal-digest email.
 *
 * - eligible: true only when there is a stored email AND the global
 *   `subscribed` flag is true AND the per-channel `dealDigestOptOut`
 *   flag is false. This intentionally requires explicit global opt-in;
 *   simply having an email on Firebase Auth is not enough.
 * - email + displayName are echoed back so the orchestrator can render
 *   the email without a second lookup.
 *
 * Returns `null` if the account has no record at all (never subscribed
 * to anything) — orchestrator skips silently.
 */
export async function getDealDigestEligibility(accountId: string): Promise<{
  accountId: string;
  email: string;
  displayName: string | null;
  eligible: boolean;
  reason: 'eligible' | 'no_email' | 'globally_unsubscribed' | 'deal_digest_opt_out';
} | null> {
  const collectionRef = getCollection();
  if (collectionRef) {
    const snapshot = await collectionRef.doc(accountId).get();
    if (!snapshot.exists) return null;
    const record = normalizeRecord(snapshot.data() as MemberEmailSubscriptionRecord);
    return computeDealDigestEligibility(record);
  }

  const memoryRecord = memberEmailSubscriptionStore.get(accountId);
  if (!memoryRecord) return null;
  return computeDealDigestEligibility(normalizeRecord(memoryRecord));
}

function computeDealDigestEligibility(record: MemberEmailSubscriptionRecord) {
  if (!record.email) {
    return {
      accountId: record.accountId,
      email: '',
      displayName: record.displayName,
      eligible: false,
      reason: 'no_email' as const,
    };
  }
  if (!record.subscribed) {
    return {
      accountId: record.accountId,
      email: record.email,
      displayName: record.displayName,
      eligible: false,
      reason: 'globally_unsubscribed' as const,
    };
  }
  if (record.dealDigestOptOut) {
    return {
      accountId: record.accountId,
      email: record.email,
      displayName: record.displayName,
      eligible: false,
      reason: 'deal_digest_opt_out' as const,
    };
  }
  return {
    accountId: record.accountId,
    email: record.email,
    displayName: record.displayName,
    eligible: true,
    reason: 'eligible' as const,
  };
}

/**
 * Flips the per-channel deal-digest opt-out for an account. Used by
 * the one-click unsubscribe route (`POST /email/unsubscribe`).
 *
 * Returns:
 * - { ok: true, alreadyOptedOut: false } if we just opted them out
 * - { ok: true, alreadyOptedOut: true } if they were already out
 * - { ok: false, reason: 'not_found' } if no subscription record exists
 *   (rare — would mean the unsubscribe token references an account that
 *   never subscribed; treat as no-op success from the user's POV)
 */
export async function optOutOfDealDigest(
  accountId: string,
): Promise<{ ok: true; alreadyOptedOut: boolean } | { ok: false; reason: 'not_found' }> {
  const collectionRef = getCollection();
  let record: MemberEmailSubscriptionRecord | null = null;

  if (collectionRef) {
    const snapshot = await collectionRef.doc(accountId).get();
    if (!snapshot.exists) {
      return { ok: false, reason: 'not_found' };
    }
    record = normalizeRecord(snapshot.data() as MemberEmailSubscriptionRecord);
  } else {
    const stored = memberEmailSubscriptionStore.get(accountId);
    if (!stored) {
      return { ok: false, reason: 'not_found' };
    }
    record = normalizeRecord(stored);
  }

  if (record.dealDigestOptOut) {
    return { ok: true, alreadyOptedOut: true };
  }

  const now = getNowIso();
  await saveRecord({
    ...record,
    updatedAt: now,
    dealDigestOptOut: true,
    dealDigestOptOutAt: now,
  });
  return { ok: true, alreadyOptedOut: false };
}

export async function getMemberEmailSubscriptionStatus(input: {
  accountId: string;
  email: string;
  displayName?: string | null;
}) {
  const record = await getRecord(input.accountId, {
    email: input.email,
    displayName: input.displayName ?? null,
  });
  const hydratedRecord =
    record.email === normalizeEmail(input.email) &&
    record.displayName === normalizeDisplayName(input.displayName)
      ? record
      : await saveRecord({
          ...record,
          email: normalizeEmail(input.email) ?? record.email,
          displayName: normalizeDisplayName(input.displayName) ?? record.displayName,
          updatedAt: getNowIso(),
        });
  return toStatus(hydratedRecord);
}

export async function syncMemberEmailSubscription(input: {
  accountId: string;
  email: string;
  displayName?: string | null;
  subscribed: boolean;
  source: MemberEmailSubscriptionSource;
}) {
  const normalizedEmail = normalizeEmail(input.email);
  if (!normalizedEmail) {
    throw new Error('A valid member email address is required for email subscriptions.');
  }

  const previousRecord = await getRecord(input.accountId, {
    email: normalizedEmail,
    displayName: input.displayName ?? null,
  });
  const now = getNowIso();
  const nextRecord = await saveRecord({
    ...previousRecord,
    email: normalizedEmail,
    displayName: normalizeDisplayName(input.displayName) ?? previousRecord.displayName,
    subscribed: input.subscribed,
    source: input.source,
    updatedAt: now,
    consentedAt: input.subscribed
      ? !previousRecord.subscribed
        ? now
        : (previousRecord.consentedAt ?? now)
      : previousRecord.consentedAt,
    unsubscribedAt: input.subscribed ? null : now,
  });

  // Welcome is transactional, so it fires on first record creation
  // regardless of whether the user opted into marketing. The
  // `subscribed` flag still governs deal-digest sends downstream, so a
  // user who declined marketing only gets the one-time welcome.
  const finalRecord = !previousRecord.welcomeEmailSentAt
    ? await sendWelcomeEmailIfNeeded(nextRecord)
    : nextRecord;

  return toStatus(finalRecord);
}

export async function listMemberEmailSubscriptions(options?: {
  includeUnsubscribed?: boolean;
  limit?: number;
  startAfter?: string;
}) {
  const collectionRef = getCollection();
  const limit = options?.limit ?? 1000;
  const records = collectionRef
    ? (
        await collectionRef
          .orderBy('updatedAt', 'desc')
          .limit(Math.min(limit * 2, 5000))
          .get()
      ).docs.map((documentSnapshot) =>
        normalizeRecord(documentSnapshot.data() as MemberEmailSubscriptionRecord),
      )
    : Array.from(memberEmailSubscriptionStore.values()).map(normalizeRecord);

  let filteredRecords = options?.includeUnsubscribed
    ? records
    : records.filter((record) => record.subscribed);

  // Apply pagination
  if (options?.startAfter) {
    const startIndex = filteredRecords.findIndex((r) => r.email === options.startAfter);
    filteredRecords = filteredRecords.slice(startIndex + 1);
  }

  const paginatedRecords = filteredRecords.slice(0, limit);

  return {
    storage: backendStorefrontSourceStatus.activeMode === 'firestore' ? 'firestore' : 'memory',
    count: filteredRecords.length,
    items: paginatedRecords
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(toStatus),
  };
}

export function exportMemberEmailSubscriptionsCsv(statuses: MemberEmailSubscriptionStatus[]) {
  const header = [
    'accountId',
    'email',
    'displayName',
    'subscribed',
    'source',
    'updatedAt',
    'consentedAt',
    'unsubscribedAt',
    'welcomeEmailSentAt',
    'welcomeEmailState',
    'welcomeEmailLastEventType',
    'welcomeEmailLastEventAt',
    'welcomeEmailLastEventSummary',
  ];

  const rows = statuses.map((status) => [
    status.accountId,
    status.email ?? '',
    status.displayName ?? '',
    status.subscribed ? 'true' : 'false',
    status.source,
    status.updatedAt ?? '',
    status.consentedAt ?? '',
    status.unsubscribedAt ?? '',
    status.welcomeEmailSentAt ?? '',
    status.welcomeEmailState,
    status.welcomeEmailLastEventType ?? '',
    status.welcomeEmailLastEventAt ?? '',
    status.welcomeEmailLastEventSummary ?? '',
  ]);

  return [header, ...rows]
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
    .join('\n');
}

export function clearMemberEmailSubscriptionMemoryStateForTests() {
  memberEmailSubscriptionStore.clear();
}

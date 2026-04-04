import crypto from 'node:crypto';
import { DocumentReference, FieldValue, WriteBatch } from 'firebase-admin/firestore';
import {
  AnalyticsEventBatchRequest,
  AnalyticsEventInput,
  AnalyticsMetadata,
} from '../../../src/types/analytics';
import { getBackendFirebaseDb } from '../firebase';

type AnalyticsEventDocument = AnalyticsEventInput & {
  eventId: string;
  receivedAt: string;
  platform: string;
  appVersion: string | null;
  ipAddress: string | null;
  userAgent: string | null;
};

const EVENTS_COLLECTION = 'analytics_events';
const DAILY_APP_METRICS_COLLECTION = 'analytics_daily_app_metrics';
const DAILY_STOREFRONT_METRICS_COLLECTION = 'analytics_daily_storefront_metrics';
const DAILY_DEAL_METRICS_COLLECTION = 'analytics_daily_deal_metrics';
const DAILY_SEARCH_METRICS_COLLECTION = 'analytics_daily_search_metrics';
const DAILY_SIGNUP_METRICS_COLLECTION = 'analytics_daily_signup_metrics';
const DAILY_QUERY_METRICS_COLLECTION = 'analytics_daily_query_metrics';

const memoryAnalyticsEvents: AnalyticsEventDocument[] = [];

function createDateKey(occurredAt: string) {
  return occurredAt.slice(0, 10);
}

function createScopedDailyId(dateKey: string, entityId: string) {
  return `${dateKey}_${entityId}`;
}

function createQueryMetricId(dateKey: string, query: string) {
  const hash = crypto.createHash('sha1').update(query).digest('hex').slice(0, 12);
  return `${dateKey}_${hash}`;
}

function normalizeMetadata(metadata: AnalyticsMetadata | undefined) {
  return metadata ?? {};
}

function stripUndefinedProperties<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as T;
}

function createEventDocument(
  event: AnalyticsEventInput,
  batch: AnalyticsEventBatchRequest,
  requestContext: {
    ipAddress: string | null;
    userAgent: string | null;
  },
): AnalyticsEventDocument {
  return stripUndefinedProperties({
    ...event,
    metadata: normalizeMetadata(event.metadata),
    eventId: event.eventId?.trim() || crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
    platform: batch.platform,
    appVersion: batch.appVersion ?? null,
    ipAddress: requestContext.ipAddress,
    userAgent: requestContext.userAgent,
  });
}

function setMerged(
  writeBatch: WriteBatch,
  documentRef: DocumentReference,
  data: Record<string, unknown>,
) {
  writeBatch.set(documentRef, data, { merge: true });
}

function incrementIfNeeded(
  target: Record<string, unknown>,
  field: string,
  shouldIncrement: boolean,
  amount = 1,
) {
  if (shouldIncrement) {
    target[field] = FieldValue.increment(amount);
  }
}

function applyDailyAppMetrics(writeBatch: WriteBatch, event: AnalyticsEventDocument) {
  const dateKey = createDateKey(event.occurredAt);
  const documentRef = getBackendFirebaseDb()!.collection(DAILY_APP_METRICS_COLLECTION).doc(dateKey);
  const payload: Record<string, unknown> = {
    date: dateKey,
    updatedAt: event.receivedAt,
    eventCount: FieldValue.increment(1),
  };

  incrementIfNeeded(payload, 'appOpenCount', event.eventType === 'app_open');
  incrementIfNeeded(payload, 'sessionStartCount', event.eventType === 'session_start');
  incrementIfNeeded(payload, 'sessionEndCount', event.eventType === 'session_end');
  incrementIfNeeded(payload, 'screenViewCount', event.eventType === 'screen_view');
  incrementIfNeeded(payload, 'signInCount', event.eventType === 'signin');
  incrementIfNeeded(payload, 'signupStartedCount', event.eventType === 'signup_started');
  incrementIfNeeded(payload, 'signupCompletedCount', event.eventType === 'signup_completed');
  incrementIfNeeded(
    payload,
    'passwordResetRequestCount',
    event.eventType === 'password_reset_requested',
  );
  incrementIfNeeded(payload, 'reviewStartedCount', event.eventType === 'review_started');
  incrementIfNeeded(payload, 'reviewSubmittedCount', event.eventType === 'review_submitted');

  if (event.eventType === 'session_end') {
    const durationSeconds =
      typeof event.metadata?.durationSeconds === 'number'
        ? Math.max(0, event.metadata.durationSeconds)
        : 0;
    if (durationSeconds > 0) {
      payload.totalSessionDurationSeconds = FieldValue.increment(durationSeconds);
    }
  }

  setMerged(writeBatch, documentRef, payload);
}

function applyDailySearchMetrics(writeBatch: WriteBatch, event: AnalyticsEventDocument) {
  const dateKey = createDateKey(event.occurredAt);
  const documentRef = getBackendFirebaseDb()!
    .collection(DAILY_SEARCH_METRICS_COLLECTION)
    .doc(dateKey);
  const payload: Record<string, unknown> = {
    date: dateKey,
    updatedAt: event.receivedAt,
  };

  incrementIfNeeded(payload, 'searchSubmittedCount', event.eventType === 'search_submitted');
  incrementIfNeeded(payload, 'searchClearedCount', event.eventType === 'search_cleared');
  incrementIfNeeded(
    payload,
    'locationPromptShownCount',
    event.eventType === 'location_prompt_shown',
  );
  incrementIfNeeded(payload, 'locationGrantedCount', event.eventType === 'location_granted');
  incrementIfNeeded(payload, 'locationDeniedCount', event.eventType === 'location_denied');
  incrementIfNeeded(payload, 'locationChangedCount', event.eventType === 'location_changed');
  incrementIfNeeded(payload, 'browseSortChangedCount', event.eventType === 'browse_sort_changed');
  incrementIfNeeded(payload, 'hotDealsToggleCount', event.eventType === 'hot_deals_toggled');

  setMerged(writeBatch, documentRef, payload);

  if (event.eventType !== 'search_submitted') {
    return;
  }

  const normalizedQuery =
    typeof event.metadata?.query === 'string' ? event.metadata.query.trim().toLowerCase() : '';
  if (!normalizedQuery) {
    return;
  }

  const queryRef = getBackendFirebaseDb()!
    .collection(DAILY_QUERY_METRICS_COLLECTION)
    .doc(createQueryMetricId(dateKey, normalizedQuery));
  setMerged(writeBatch, queryRef, {
    date: dateKey,
    query: normalizedQuery,
    updatedAt: event.receivedAt,
    submittedCount: FieldValue.increment(1),
  });
}

function applyDailyStorefrontMetrics(writeBatch: WriteBatch, event: AnalyticsEventDocument) {
  if (!event.storefrontId) {
    return;
  }

  const dateKey = createDateKey(event.occurredAt);
  const documentRef = getBackendFirebaseDb()!
    .collection(DAILY_STOREFRONT_METRICS_COLLECTION)
    .doc(createScopedDailyId(dateKey, event.storefrontId));
  const payload: Record<string, unknown> = {
    date: dateKey,
    storefrontId: event.storefrontId,
    updatedAt: event.receivedAt,
  };

  incrementIfNeeded(payload, 'impressionCount', event.eventType === 'storefront_impression');
  incrementIfNeeded(payload, 'openCount', event.eventType === 'storefront_opened');
  incrementIfNeeded(payload, 'goNowTapCount', event.eventType === 'go_now_tapped');
  incrementIfNeeded(payload, 'websiteTapCount', event.eventType === 'website_tapped');
  incrementIfNeeded(payload, 'phoneTapCount', event.eventType === 'phone_tapped');
  incrementIfNeeded(payload, 'menuTapCount', event.eventType === 'menu_tapped');
  incrementIfNeeded(payload, 'reviewPromptShownCount', event.eventType === 'review_prompt_shown');
  incrementIfNeeded(
    payload,
    'reviewPromptDismissedCount',
    event.eventType === 'review_prompt_dismissed',
  );
  incrementIfNeeded(payload, 'reviewStartedCount', event.eventType === 'review_started');
  incrementIfNeeded(payload, 'reviewSubmittedCount', event.eventType === 'review_submitted');

  setMerged(writeBatch, documentRef, payload);
}

function applyDailyDealMetrics(writeBatch: WriteBatch, event: AnalyticsEventDocument) {
  if (!event.dealId) {
    return;
  }

  const dateKey = createDateKey(event.occurredAt);
  const documentRef = getBackendFirebaseDb()!
    .collection(DAILY_DEAL_METRICS_COLLECTION)
    .doc(createScopedDailyId(dateKey, event.dealId));
  const payload: Record<string, unknown> = {
    date: dateKey,
    dealId: event.dealId,
    updatedAt: event.receivedAt,
  };

  incrementIfNeeded(payload, 'impressionCount', event.eventType === 'deal_impression');
  incrementIfNeeded(payload, 'openCount', event.eventType === 'deal_opened');
  incrementIfNeeded(payload, 'saveCount', event.eventType === 'deal_saved');
  incrementIfNeeded(payload, 'redeemStartCount', event.eventType === 'deal_redeem_started');
  incrementIfNeeded(payload, 'redeemedCount', event.eventType === 'deal_redeemed');
  incrementIfNeeded(payload, 'websiteTapCount', event.eventType === 'website_tapped');
  incrementIfNeeded(payload, 'phoneTapCount', event.eventType === 'phone_tapped');
  incrementIfNeeded(payload, 'menuTapCount', event.eventType === 'menu_tapped');

  setMerged(writeBatch, documentRef, payload);
}

function applyDailySignupMetrics(writeBatch: WriteBatch, event: AnalyticsEventDocument) {
  if (event.eventType !== 'signup_started' && event.eventType !== 'signup_completed') {
    return;
  }

  const dateKey = createDateKey(event.occurredAt);
  const documentRef = getBackendFirebaseDb()!
    .collection(DAILY_SIGNUP_METRICS_COLLECTION)
    .doc(dateKey);
  const payload: Record<string, unknown> = {
    date: dateKey,
    updatedAt: event.receivedAt,
  };

  incrementIfNeeded(payload, 'startedCount', event.eventType === 'signup_started');
  incrementIfNeeded(payload, 'completedCount', event.eventType === 'signup_completed');

  setMerged(writeBatch, documentRef, payload);
}

function recordInMemory(event: AnalyticsEventDocument) {
  memoryAnalyticsEvents.push(event);
}

function dedupeIncomingDocuments(documents: AnalyticsEventDocument[]) {
  const seenEventIds = new Set<string>();
  const dedupedDocuments: AnalyticsEventDocument[] = [];
  let duplicateCount = 0;

  for (const document of documents) {
    if (seenEventIds.has(document.eventId)) {
      duplicateCount += 1;
      continue;
    }

    seenEventIds.add(document.eventId);
    dedupedDocuments.push(document);
  }

  return {
    dedupedDocuments,
    duplicateCount,
  };
}

export function clearAnalyticsEventState() {
  memoryAnalyticsEvents.length = 0;
}

export async function recordAnalyticsEvents(
  batch: AnalyticsEventBatchRequest,
  requestContext: {
    ipAddress: string | null;
    userAgent: string | null;
  },
) {
  const db = getBackendFirebaseDb();
  const incomingDocuments = batch.events.map((event) =>
    createEventDocument(event, batch, requestContext),
  );
  const { dedupedDocuments, duplicateCount: inBatchDuplicateCount } =
    dedupeIncomingDocuments(incomingDocuments);

  if (!db) {
    let duplicateCount = inBatchDuplicateCount;
    let acceptedCount = 0;

    dedupedDocuments.forEach((document) => {
      if (
        memoryAnalyticsEvents.some((existingEvent) => existingEvent.eventId === document.eventId)
      ) {
        duplicateCount += 1;
        return;
      }

      recordInMemory(document);
      acceptedCount += 1;
    });

    return {
      ok: true,
      accepted: acceptedCount,
      duplicates: duplicateCount,
    };
  }

  const writeBatch = db.batch();
  const rawEventRefs = dedupedDocuments.map((document) =>
    db.collection(EVENTS_COLLECTION).doc(document.eventId),
  );
  const existingSnapshots = rawEventRefs.length ? await db.getAll(...rawEventRefs) : [];
  const existingEventIds = new Set(
    existingSnapshots.filter((snapshot) => snapshot.exists).map((snapshot) => snapshot.id),
  );
  const acceptedDocuments = dedupedDocuments.filter(
    (document) => !existingEventIds.has(document.eventId),
  );

  acceptedDocuments.forEach((document) => {
    const rawEventRef = db.collection(EVENTS_COLLECTION).doc(document.eventId);
    writeBatch.set(rawEventRef, document);

    applyDailyAppMetrics(writeBatch, document);
    applyDailySearchMetrics(writeBatch, document);
    applyDailyStorefrontMetrics(writeBatch, document);
    applyDailyDealMetrics(writeBatch, document);
    applyDailySignupMetrics(writeBatch, document);
  });

  if (acceptedDocuments.length) {
    await writeBatch.commit();
  }

  return {
    ok: true,
    accepted: acceptedDocuments.length,
    duplicates: inBatchDuplicateCount + (dedupedDocuments.length - acceptedDocuments.length),
  };
}

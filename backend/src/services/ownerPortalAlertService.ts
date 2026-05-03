import { getOptionalFirestoreCollection } from '../firestoreCollections';
import { logger } from '../observability/logger';
import { backendStorefrontSourceStatus } from '../sources';
import { sendExpoPushMessages } from './expoPushService';
import { syncOwnerRuntimeAlertSubscription } from './opsAlertSubscriptionService';
import { getCanonicalOwnerUidForStorefront } from './ownerPortalAuthorizationService';
import { sendWebPushNotifications, type WebPushPayload } from './webPushService';
import {
  listOwnerWebPushSubscriptions,
  pruneExpiredWebPushSubscriptions,
} from './webPushSubscriptionService';

type OwnerPortalAlertRecord = {
  ownerUid: string;
  devicePushToken: string | null;
  updatedAt: string;
};

type OwnerProfileRecord = {
  uid: string;
  dispensaryId: string | null;
};

const OWNER_PORTAL_ALERTS_COLLECTION = 'owner_portal_alerts';
const OWNER_PROFILES_COLLECTION = 'ownerProfiles';

const ownerPortalAlertStore = new Map<string, OwnerPortalAlertRecord>();
const ownerProfileStore = new Map<string, OwnerProfileRecord>();

function createEmptyOwnerAlertRecord(ownerUid: string): OwnerPortalAlertRecord {
  return {
    ownerUid,
    devicePushToken: null,
    updatedAt: new Date(0).toISOString(),
  };
}

function normalizeOwnerPortalAlertRecord(record: OwnerPortalAlertRecord): OwnerPortalAlertRecord {
  return {
    ownerUid: record.ownerUid,
    devicePushToken:
      typeof record.devicePushToken === 'string' && record.devicePushToken.trim()
        ? record.devicePushToken.trim()
        : null,
    updatedAt:
      typeof record.updatedAt === 'string' && record.updatedAt.trim()
        ? record.updatedAt
        : new Date(0).toISOString(),
  };
}

function getOwnerPortalAlertCollection() {
  return getOptionalFirestoreCollection<OwnerPortalAlertRecord>(OWNER_PORTAL_ALERTS_COLLECTION);
}

function getOwnerProfileCollection() {
  return getOptionalFirestoreCollection<OwnerProfileRecord>(OWNER_PROFILES_COLLECTION);
}

async function getOwnerPortalAlertRecord(ownerUid: string) {
  const collectionRef = getOwnerPortalAlertCollection();
  if (collectionRef) {
    const snapshot = await collectionRef.doc(ownerUid).get();
    if (!snapshot.exists) {
      return createEmptyOwnerAlertRecord(ownerUid);
    }

    return normalizeOwnerPortalAlertRecord(snapshot.data() as OwnerPortalAlertRecord);
  }

  return ownerPortalAlertStore.get(ownerUid) ?? createEmptyOwnerAlertRecord(ownerUid);
}

export async function getOwnerPortalAlertPushToken(ownerUid: string) {
  const record = await getOwnerPortalAlertRecord(ownerUid);
  return record.devicePushToken;
}

async function saveOwnerPortalAlertRecord(record: OwnerPortalAlertRecord) {
  const normalized = normalizeOwnerPortalAlertRecord(record);
  const collectionRef = getOwnerPortalAlertCollection();
  if (collectionRef) {
    await collectionRef.doc(record.ownerUid).set(normalized);
    return normalized;
  }

  ownerPortalAlertStore.set(record.ownerUid, normalized);
  return normalized;
}

async function listOwnerUidsForStorefront(storefrontId: string) {
  const canonicalOwnerUid = await getCanonicalOwnerUidForStorefront(storefrontId);
  if (canonicalOwnerUid) {
    return [canonicalOwnerUid];
  }

  const collectionRef = getOwnerProfileCollection();
  if (collectionRef) {
    return [];
  }

  return Array.from(ownerProfileStore.values())
    .filter((profile) => profile.dispensaryId === storefrontId)
    .map((profile) => profile.uid);
}

export async function syncOwnerPortalAlerts(options: {
  ownerUid: string;
  devicePushToken?: string | null;
}) {
  const previousRecord = await getOwnerPortalAlertRecord(options.ownerUid);
  const nextRecord = await saveOwnerPortalAlertRecord({
    ownerUid: options.ownerUid,
    devicePushToken: options.devicePushToken ?? previousRecord.devicePushToken,
    updatedAt: new Date().toISOString(),
  });
  await syncOwnerRuntimeAlertSubscription({
    ownerUid: options.ownerUid,
    devicePushToken: nextRecord.devicePushToken,
  });

  return {
    pushEnabled: Boolean(nextRecord.devicePushToken),
    updatedAt: nextRecord.updatedAt,
  };
}

export async function getOwnerPortalAlertStatus(ownerUid: string) {
  const record = await getOwnerPortalAlertRecord(ownerUid);
  return {
    pushEnabled: Boolean(record.devicePushToken),
    updatedAt: record.updatedAt === new Date(0).toISOString() ? null : record.updatedAt,
  };
}

// Fan out a single notification to every browser/device subscription
// registered by `ownerUid` via the web-push pipeline. Resolves with the
// number of successful deliveries; expired subscriptions are pruned so we
// don't keep hitting dead endpoints.
async function fanOutWebPushForOwner(ownerUid: string, payload: WebPushPayload): Promise<number> {
  let subscriptions: Awaited<ReturnType<typeof listOwnerWebPushSubscriptions>> = [];
  try {
    subscriptions = await listOwnerWebPushSubscriptions(ownerUid);
  } catch (error) {
    logger.warn('[ownerPortalAlertService] failed to load web push subscriptions', {
      ownerUid,
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }

  if (!subscriptions.length) {
    return 0;
  }

  const results = await sendWebPushNotifications(
    subscriptions.map((sub) => ({
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
    })),
    payload,
  );

  const expiredEndpoints = results
    .filter((result) => result.status === 'expired')
    .map((result) => result.endpoint)
    .filter((endpoint) => Boolean(endpoint));

  if (expiredEndpoints.length) {
    try {
      await pruneExpiredWebPushSubscriptions({ ownerUid, expiredEndpoints });
    } catch (error) {
      logger.warn('[ownerPortalAlertService] failed to prune expired web push subscriptions', {
        ownerUid,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results.filter((result) => result.status === 'ok').length;
}

export async function notifyOwnersOfStorefrontActivity(options: {
  storefrontId: string;
  title: string;
  body: string;
  data: Record<string, string>;
}) {
  const ownerUids = await listOwnerUidsForStorefront(options.storefrontId);
  if (!ownerUids.length) {
    return {
      notifiedOwnerCount: 0,
      webPushDeliveredCount: 0,
      storage: backendStorefrontSourceStatus.activeMode === 'firestore' ? 'firestore' : 'memory',
    };
  }

  const webPushPayload: WebPushPayload = {
    title: options.title,
    body: options.body,
    url:
      options.data?.url ?? `/owner-portal?storefrontId=${encodeURIComponent(options.storefrontId)}`,
    tag: `owner-portal-${options.storefrontId}`,
    data: {
      kind: 'owner_portal_alert',
      storefrontId: options.storefrontId,
      ...options.data,
    },
  };

  // Fan out web push first — fire-and-forget'ed against the existing native
  // pipeline so a stalled web-push request can't delay the native fan-out.
  // Resolve their counts in parallel via Promise.all.
  const [webPushDeliveredCount, expoResult] = await Promise.all([
    Promise.all(ownerUids.map((ownerUid) => fanOutWebPushForOwner(ownerUid, webPushPayload))).then(
      (counts) => counts.reduce((sum, count) => sum + count, 0),
    ),
    fanOutExpoPushForOwners(ownerUids, options),
  ]);

  return {
    notifiedOwnerCount: expoResult.notifiedOwnerCount,
    webPushDeliveredCount,
    storage: backendStorefrontSourceStatus.activeMode === 'firestore' ? 'firestore' : 'memory',
  };
}

async function fanOutExpoPushForOwners(
  ownerUids: string[],
  options: {
    storefrontId: string;
    title: string;
    body: string;
    data: Record<string, string>;
  },
): Promise<{ notifiedOwnerCount: number }> {
  const settledAlertRecords = await Promise.allSettled(
    ownerUids.map((ownerUid) => getOwnerPortalAlertRecord(ownerUid)),
  );
  const ownerAlertRecords = settledAlertRecords.flatMap((result, index) => {
    if (result.status === 'fulfilled') {
      return [result.value];
    }
    logger.warn(
      `[ownerPortalAlertService] failed to load alert record for ${ownerUids[index] ?? 'unknown'}`,
      { error: result.reason instanceof Error ? result.reason.message : String(result.reason) },
    );
    return [];
  });
  const recordsWithTokens = ownerAlertRecords.filter((record) => record.devicePushToken);
  if (!recordsWithTokens.length) {
    return { notifiedOwnerCount: 0 };
  }

  const tickets = await sendExpoPushMessages(
    recordsWithTokens.map((record) => ({
      to: record.devicePushToken!,
      title: options.title,
      body: options.body,
      sound: 'default',
      priority: 'high',
      channelId: 'owner-portal-alerts',
      data: {
        kind: 'owner_portal_alert',
        storefrontId: options.storefrontId,
        ...options.data,
      },
    })),
  );

  const tokenCleanupResults = await Promise.allSettled(
    tickets.map(async (ticket, index) => {
      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        const record = recordsWithTokens[index];
        await saveOwnerPortalAlertRecord({
          ...record,
          devicePushToken: null,
        });
      }
    }),
  );
  for (const result of tokenCleanupResults) {
    if (result.status === 'rejected') {
      logger.warn('[ownerPortalAlertService] failed to clear stale device token', {
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
    }
  }

  return {
    notifiedOwnerCount: tickets.filter((ticket) => ticket.status === 'ok').length,
  };
}

export async function notifyOwnerPortalUser(options: {
  ownerUid: string;
  title: string;
  body: string;
  data: Record<string, string>;
}) {
  const record = await getOwnerPortalAlertRecord(options.ownerUid);
  if (!record.devicePushToken) {
    return {
      notifiedOwnerCount: 0,
      storage: backendStorefrontSourceStatus.activeMode === 'firestore' ? 'firestore' : 'memory',
    };
  }

  const tickets = await sendExpoPushMessages([
    {
      to: record.devicePushToken,
      title: options.title,
      body: options.body,
      sound: 'default',
      priority: 'high',
      channelId: 'owner-portal-alerts',
      data: {
        kind: 'owner_portal_alert',
        ...options.data,
      },
    },
  ]);

  const firstTicket = tickets[0];
  if (firstTicket?.status === 'error' && firstTicket.details?.error === 'DeviceNotRegistered') {
    await saveOwnerPortalAlertRecord({
      ...record,
      devicePushToken: null,
    });
  }

  return {
    notifiedOwnerCount: tickets.filter((ticket) => ticket.status === 'ok').length,
    storage: backendStorefrontSourceStatus.activeMode === 'firestore' ? 'firestore' : 'memory',
  };
}

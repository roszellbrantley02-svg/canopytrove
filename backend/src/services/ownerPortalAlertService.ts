import { getOptionalFirestoreCollection } from '../firestoreCollections';
import { backendStorefrontSourceStatus } from '../sources';
import { sendExpoPushMessages } from './expoPushService';
import { syncOwnerRuntimeAlertSubscription } from './opsAlertSubscriptionService';
import { getCanonicalOwnerUidForStorefront } from './ownerPortalAuthorizationService';

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

function normalizeOwnerPortalAlertRecord(
  record: OwnerPortalAlertRecord
): OwnerPortalAlertRecord {
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
    updatedAt:
      record.updatedAt === new Date(0).toISOString() ? null : record.updatedAt,
  };
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
      storage:
        backendStorefrontSourceStatus.activeMode === 'firestore' ? 'firestore' : 'memory',
    };
  }

  const settledAlertRecords = await Promise.allSettled(
    ownerUids.map((ownerUid) => getOwnerPortalAlertRecord(ownerUid))
  );
  const ownerAlertRecords = settledAlertRecords.flatMap((result, index) => {
    if (result.status === 'fulfilled') {
      return [result.value];
    }
    console.warn(
      `[ownerPortalAlertService] failed to load alert record for ${ownerUids[index] ?? 'unknown'}:`,
      result.reason
    );
    return [];
  });
  const recordsWithTokens = ownerAlertRecords.filter((record) => record.devicePushToken);
  if (!recordsWithTokens.length) {
    return {
      notifiedOwnerCount: 0,
      storage:
        backendStorefrontSourceStatus.activeMode === 'firestore' ? 'firestore' : 'memory',
    };
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
    }))
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
    })
  );
  for (const result of tokenCleanupResults) {
    if (result.status === 'rejected') {
      console.warn('[ownerPortalAlertService] failed to clear stale device token:', result.reason);
    }
  }

  return {
    notifiedOwnerCount: tickets.filter((ticket) => ticket.status === 'ok').length,
    storage:
      backendStorefrontSourceStatus.activeMode === 'firestore' ? 'firestore' : 'memory',
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
      storage:
        backendStorefrontSourceStatus.activeMode === 'firestore' ? 'firestore' : 'memory',
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
    storage:
      backendStorefrontSourceStatus.activeMode === 'firestore' ? 'firestore' : 'memory',
  };
}

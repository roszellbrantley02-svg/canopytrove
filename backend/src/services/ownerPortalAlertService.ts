import { CollectionReference } from 'firebase-admin/firestore';
import { getBackendFirebaseDb } from '../firebase';
import { backendStorefrontSourceStatus } from '../sources';
import { sendExpoPushMessages } from './expoPushService';

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
  const db = getBackendFirebaseDb();
  if (!db || backendStorefrontSourceStatus.activeMode !== 'firestore') {
    return null;
  }

  return db.collection(
    OWNER_PORTAL_ALERTS_COLLECTION
  ) as CollectionReference<OwnerPortalAlertRecord>;
}

function getOwnerProfileCollection() {
  const db = getBackendFirebaseDb();
  if (!db || backendStorefrontSourceStatus.activeMode !== 'firestore') {
    return null;
  }

  return db.collection(OWNER_PROFILES_COLLECTION) as CollectionReference<OwnerProfileRecord>;
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
  const collectionRef = getOwnerProfileCollection();
  if (collectionRef) {
    const snapshot = await collectionRef.where('dispensaryId', '==', storefrontId).get();
    return snapshot.docs
      .map((documentSnapshot) => documentSnapshot.id)
      .filter((ownerUid) => ownerUid.trim());
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

  const ownerAlertRecords = await Promise.all(
    ownerUids.map((ownerUid) => getOwnerPortalAlertRecord(ownerUid))
  );
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

  await Promise.all(
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

  return {
    notifiedOwnerCount: tickets.filter((ticket) => ticket.status === 'ok').length,
    storage:
      backendStorefrontSourceStatus.activeMode === 'firestore' ? 'firestore' : 'memory',
  };
}

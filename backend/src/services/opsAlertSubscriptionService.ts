import { createHash } from 'node:crypto';
import {
  RuntimeAlertSubscriptionSource,
  RuntimeAlertSubscriptionStatus,
} from '../../../src/types/runtimeOps';
import { serverConfig } from '../config';
import { getOptionalFirestoreCollection } from '../firestoreCollections';
import { backendStorefrontSourceStatus } from '../sources';
import { sendExpoPushMessages } from './expoPushService';

type RuntimeAlertSubscriptionRecord = {
  id: string;
  source: RuntimeAlertSubscriptionSource;
  ownerUid: string | null;
  devicePushToken: string | null;
  updatedAt: string;
};

const OPS_ALERT_SUBSCRIPTIONS_COLLECTION = 'ops_alert_subscriptions';
const alertSubscriptionStore = new Map<string, RuntimeAlertSubscriptionRecord>();
const recentAlertFingerprintStore = new Map<string, string>();

function getNowIso() {
  return new Date().toISOString();
}

function getCooldownWindowMs() {
  return Math.max(serverConfig.opsAlertCooldownMinutes, 1) * 60_000;
}

function isExpoPushToken(value: string | null | undefined) {
  return typeof value === 'string' && /^(Expo|Exponent)PushToken\[[^\]]+\]$/.test(value.trim());
}

function normalizePushToken(value: string | null | undefined) {
  const normalizedValue = value?.trim() || null;
  return isExpoPushToken(normalizedValue) ? normalizedValue : null;
}

function normalizeUpdatedAt(value: string | null | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : new Date(0).toISOString();
}

function createAdminSubscriptionId(devicePushToken: string) {
  return `admin:${createHash('sha1').update(devicePushToken).digest('hex')}`;
}

function createOwnerSubscriptionId(ownerUid: string) {
  return `owner:${ownerUid.trim()}`;
}

function normalizeRuntimeAlertSubscriptionRecord(
  record: RuntimeAlertSubscriptionRecord,
): RuntimeAlertSubscriptionRecord {
  return {
    id: record.id,
    source: record.source === 'admin_runtime' ? 'admin_runtime' : 'owner_portal',
    ownerUid:
      typeof record.ownerUid === 'string' && record.ownerUid.trim() ? record.ownerUid.trim() : null,
    devicePushToken: normalizePushToken(record.devicePushToken),
    updatedAt: normalizeUpdatedAt(record.updatedAt),
  };
}

function toRuntimeAlertSubscriptionStatus(
  record: RuntimeAlertSubscriptionRecord,
  source: RuntimeAlertSubscriptionSource,
): RuntimeAlertSubscriptionStatus {
  return {
    source,
    pushEnabled: Boolean(record.devicePushToken),
    updatedAt: record.updatedAt === new Date(0).toISOString() ? null : record.updatedAt,
  };
}

function getRuntimeAlertSubscriptionCollection() {
  return getOptionalFirestoreCollection<RuntimeAlertSubscriptionRecord>(
    OPS_ALERT_SUBSCRIPTIONS_COLLECTION,
  );
}

async function getSubscriptionRecordById(subscriptionId: string) {
  const collectionRef = getRuntimeAlertSubscriptionCollection();
  if (collectionRef) {
    const snapshot = await collectionRef.doc(subscriptionId).get();
    if (!snapshot.exists) {
      return null;
    }

    return normalizeRuntimeAlertSubscriptionRecord(
      snapshot.data() as RuntimeAlertSubscriptionRecord,
    );
  }

  return alertSubscriptionStore.get(subscriptionId) ?? null;
}

async function listRuntimeAlertSubscriptionRecords() {
  const collectionRef = getRuntimeAlertSubscriptionCollection();
  if (collectionRef) {
    const snapshot = await collectionRef.get();
    return snapshot.docs.map((documentSnapshot) =>
      normalizeRuntimeAlertSubscriptionRecord(
        documentSnapshot.data() as RuntimeAlertSubscriptionRecord,
      ),
    );
  }

  return Array.from(alertSubscriptionStore.values()).map((record) =>
    normalizeRuntimeAlertSubscriptionRecord(record),
  );
}

async function saveRuntimeAlertSubscriptionRecord(record: RuntimeAlertSubscriptionRecord) {
  const normalized = normalizeRuntimeAlertSubscriptionRecord(record);
  const collectionRef = getRuntimeAlertSubscriptionCollection();
  if (collectionRef) {
    await collectionRef.doc(normalized.id).set(normalized);
    return normalized;
  }

  alertSubscriptionStore.set(normalized.id, normalized);
  return normalized;
}

async function clearRuntimeAlertSubscriptionToken(record: RuntimeAlertSubscriptionRecord) {
  return saveRuntimeAlertSubscriptionRecord({
    ...record,
    devicePushToken: null,
    updatedAt: getNowIso(),
  });
}

function shouldSendFingerprintAlert(fingerprint: string | null | undefined) {
  const normalizedFingerprint = fingerprint?.trim();
  if (!normalizedFingerprint) {
    return true;
  }

  const previousSentAt = recentAlertFingerprintStore.get(normalizedFingerprint);
  if (!previousSentAt) {
    return true;
  }

  return Date.now() - Date.parse(previousSentAt) >= getCooldownWindowMs();
}

function markFingerprintAlertSent(fingerprint: string | null | undefined) {
  const normalizedFingerprint = fingerprint?.trim();
  if (!normalizedFingerprint) {
    return;
  }

  recentAlertFingerprintStore.set(normalizedFingerprint, getNowIso());
}

export async function syncOwnerRuntimeAlertSubscription(options: {
  ownerUid: string;
  devicePushToken?: string | null;
}) {
  const subscriptionId = createOwnerSubscriptionId(options.ownerUid);
  const previousRecord = (await getSubscriptionRecordById(subscriptionId)) ?? {
    id: subscriptionId,
    source: 'owner_portal' as const,
    ownerUid: options.ownerUid.trim(),
    devicePushToken: null,
    updatedAt: new Date(0).toISOString(),
  };

  const nextRecord = await saveRuntimeAlertSubscriptionRecord({
    ...previousRecord,
    source: 'owner_portal',
    ownerUid: options.ownerUid.trim(),
    devicePushToken:
      options.devicePushToken === undefined
        ? previousRecord.devicePushToken
        : normalizePushToken(options.devicePushToken),
    updatedAt: getNowIso(),
  });

  return toRuntimeAlertSubscriptionStatus(nextRecord, 'owner_portal');
}

export async function syncAdminRuntimeAlertSubscription(options: {
  devicePushToken?: string | null;
}) {
  const normalizedPushToken = normalizePushToken(options.devicePushToken);
  if (!normalizedPushToken) {
    return {
      source: 'admin_runtime',
      pushEnabled: false,
      updatedAt: null,
    } satisfies RuntimeAlertSubscriptionStatus;
  }

  const subscriptionId = createAdminSubscriptionId(normalizedPushToken);
  const previousRecord = (await getSubscriptionRecordById(subscriptionId)) ?? {
    id: subscriptionId,
    source: 'admin_runtime' as const,
    ownerUid: null,
    devicePushToken: normalizedPushToken,
    updatedAt: new Date(0).toISOString(),
  };

  const nextRecord = await saveRuntimeAlertSubscriptionRecord({
    ...previousRecord,
    source: 'admin_runtime',
    ownerUid: null,
    devicePushToken: normalizedPushToken,
    updatedAt: getNowIso(),
  });

  return toRuntimeAlertSubscriptionStatus(nextRecord, 'admin_runtime');
}

export async function getAdminRuntimeAlertSubscriptionStatus(options?: {
  devicePushToken?: string | null;
}) {
  const normalizedPushToken = normalizePushToken(options?.devicePushToken);
  if (!normalizedPushToken) {
    return {
      source: 'admin_runtime',
      pushEnabled: false,
      updatedAt: null,
    } satisfies RuntimeAlertSubscriptionStatus;
  }

  const record = await getSubscriptionRecordById(createAdminSubscriptionId(normalizedPushToken));
  if (!record) {
    return {
      source: 'admin_runtime',
      pushEnabled: false,
      updatedAt: null,
    } satisfies RuntimeAlertSubscriptionStatus;
  }

  return toRuntimeAlertSubscriptionStatus(record, 'admin_runtime');
}

export async function notifyRuntimeAlertSubscribers(options: {
  title: string;
  body: string;
  data?: Record<string, string>;
  fingerprint?: string | null;
}) {
  if (!shouldSendFingerprintAlert(options.fingerprint)) {
    return {
      notifiedSubscriberCount: 0,
      throttled: true,
      storage: backendStorefrontSourceStatus.activeMode === 'firestore' ? 'firestore' : 'memory',
    };
  }

  const subscriptionRecords = await listRuntimeAlertSubscriptionRecords();
  const recordsWithTokens = subscriptionRecords.filter((record) => record.devicePushToken);

  if (!recordsWithTokens.length) {
    return {
      notifiedSubscriberCount: 0,
      throttled: false,
      storage: backendStorefrontSourceStatus.activeMode === 'firestore' ? 'firestore' : 'memory',
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
        kind: 'runtime_incident_alert',
        source: record.source,
        ...(options.data ?? {}),
      },
    })),
  );

  const tokenCleanupResults = await Promise.allSettled(
    tickets.map(async (ticket, index) => {
      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        await clearRuntimeAlertSubscriptionToken(recordsWithTokens[index]);
      }
    }),
  );
  for (const result of tokenCleanupResults) {
    if (result.status === 'rejected') {
      console.warn(
        '[opsAlertSubscriptionService] failed to clear stale subscription token:',
        result.reason,
      );
    }
  }

  if (tickets.some((ticket) => ticket.status === 'ok')) {
    markFingerprintAlertSent(options.fingerprint);
  }

  return {
    notifiedSubscriberCount: tickets.filter((ticket) => ticket.status === 'ok').length,
    throttled: false,
    storage: backendStorefrontSourceStatus.activeMode === 'firestore' ? 'firestore' : 'memory',
  };
}

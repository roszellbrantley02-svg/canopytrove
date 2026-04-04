import { getOptionalFirestoreCollection } from '../firestoreCollections';
import { backendStorefrontSourceStatus } from '../sources';
import { getStorefrontSummariesByIds } from '../storefrontService';
import { sendExpoPushMessages } from './expoPushService';
import { listProfiles } from './profileService';
import { getRouteState } from './routeStateService';

type FavoriteDealAlertRecord = {
  profileId: string;
  activeDealFingerprintsByStorefrontId: Record<string, string>;
  devicePushToken: string | null;
  updatedAt: string;
};

type FavoriteDealAlertNotification = {
  storefrontId: string;
  storefrontName: string;
  promotionText: string;
};

const FAVORITE_DEAL_ALERTS_COLLECTION = 'favorite_deal_alerts';

const favoriteDealAlertStore = new Map<string, FavoriteDealAlertRecord>();

function createEmptyRecord(profileId: string): FavoriteDealAlertRecord {
  return {
    profileId,
    activeDealFingerprintsByStorefrontId: {},
    devicePushToken: null,
    updatedAt: new Date(0).toISOString(),
  };
}

function getFavoriteDealAlertCollection() {
  return getOptionalFirestoreCollection<FavoriteDealAlertRecord>(FAVORITE_DEAL_ALERTS_COLLECTION);
}

function normalizeFavoriteDealAlertRecord(
  record: FavoriteDealAlertRecord,
): FavoriteDealAlertRecord {
  return {
    profileId: record.profileId,
    activeDealFingerprintsByStorefrontId:
      typeof record.activeDealFingerprintsByStorefrontId === 'object' &&
      record.activeDealFingerprintsByStorefrontId
        ? Object.fromEntries(
            Object.entries(record.activeDealFingerprintsByStorefrontId)
              .filter(
                ([storefrontId, fingerprint]) =>
                  typeof storefrontId === 'string' &&
                  typeof fingerprint === 'string' &&
                  storefrontId.trim() &&
                  fingerprint.trim(),
              )
              .slice(0, 64),
          )
        : {},
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

function createDealFingerprint(promotionText?: string | null) {
  const normalized = promotionText?.trim().replace(/\s+/g, ' ').toLowerCase() ?? '';
  return normalized || null;
}

async function getFavoriteDealAlertRecord(profileId: string) {
  const collectionRef = getFavoriteDealAlertCollection();
  if (collectionRef) {
    const snapshot = await collectionRef.doc(profileId).get();
    if (!snapshot.exists) {
      return createEmptyRecord(profileId);
    }

    return normalizeFavoriteDealAlertRecord(snapshot.data() as FavoriteDealAlertRecord);
  }

  return favoriteDealAlertStore.get(profileId) ?? createEmptyRecord(profileId);
}

async function saveFavoriteDealAlertRecord(record: FavoriteDealAlertRecord) {
  const normalizedRecord = normalizeFavoriteDealAlertRecord(record);
  const collectionRef = getFavoriteDealAlertCollection();
  if (collectionRef) {
    await collectionRef.doc(record.profileId).set(normalizedRecord);
    return normalizedRecord;
  }

  favoriteDealAlertStore.set(record.profileId, normalizedRecord);
  return normalizedRecord;
}

export async function deleteFavoriteDealAlertRecord(profileId: string) {
  const collectionRef = getFavoriteDealAlertCollection();
  if (collectionRef) {
    await collectionRef.doc(profileId).delete();
    return true;
  }

  return favoriteDealAlertStore.delete(profileId);
}

export async function syncFavoriteDealAlerts(options: {
  profileId: string;
  savedStorefrontIds: string[];
  allowNotifications: boolean;
  devicePushToken?: string;
}) {
  const dedupedSavedStorefrontIds = Array.from(
    new Set(options.savedStorefrontIds.map((storefrontId) => storefrontId.trim()).filter(Boolean)),
  ).slice(0, 64);

  const [previousRecordResult, savedSummariesResult] = await Promise.allSettled([
    getFavoriteDealAlertRecord(options.profileId),
    dedupedSavedStorefrontIds.length ? getStorefrontSummariesByIds(dedupedSavedStorefrontIds) : [],
  ]);
  const storage = backendStorefrontSourceStatus.activeMode === 'firestore' ? 'firestore' : 'memory';
  const previousRecord =
    previousRecordResult.status === 'fulfilled'
      ? previousRecordResult.value
      : createEmptyRecord(options.profileId);
  if (previousRecordResult.status === 'rejected') {
    console.warn(
      `[favoriteDealAlertService] failed to load previous alert state for ${options.profileId}:`,
      previousRecordResult.reason,
    );
  }
  if (savedSummariesResult.status !== 'fulfilled') {
    console.warn(
      `[favoriteDealAlertService] failed to load saved storefront summaries for ${options.profileId}:`,
      savedSummariesResult.reason,
    );
    return {
      notifications: [],
      deliveryMode: 'none' as const,
      storage,
      state: previousRecord,
    };
  }
  const savedSummaries = savedSummariesResult.value;

  const nextFingerprints: Record<string, string> = {};
  const notifications: FavoriteDealAlertNotification[] = [];

  savedSummaries.forEach((summary) => {
    const fingerprint = createDealFingerprint(summary.promotionText);
    if (!fingerprint || !summary.promotionText?.trim()) {
      return;
    }

    nextFingerprints[summary.id] = fingerprint;

    const previousFingerprint =
      previousRecord.activeDealFingerprintsByStorefrontId[summary.id] ?? null;
    if (
      options.allowNotifications &&
      previousRecord.updatedAt !== new Date(0).toISOString() &&
      previousFingerprint !== fingerprint
    ) {
      notifications.push({
        storefrontId: summary.id,
        storefrontName: summary.displayName,
        promotionText: summary.promotionText.trim(),
      });
    }
  });

  let deliveryMode: 'backend_push' | 'client_local' | 'none' =
    notifications.length > 0 ? 'client_local' : 'none';

  let finalRecord = await saveFavoriteDealAlertRecord({
    profileId: options.profileId,
    activeDealFingerprintsByStorefrontId: nextFingerprints,
    devicePushToken: options.devicePushToken ?? previousRecord.devicePushToken,
    updatedAt: new Date().toISOString(),
  });

  const pushToken = finalRecord.devicePushToken;
  if (options.allowNotifications && notifications.length > 0 && pushToken) {
    const tickets = await sendExpoPushMessages(
      notifications.map((notification) => ({
        to: pushToken,
        title: `Deal at ${notification.storefrontName}`,
        body: notification.promotionText,
        sound: 'default',
        priority: 'high',
        channelId: 'favorite-store-deals',
        data: {
          kind: 'favorite_store_deal',
          storefrontId: notification.storefrontId,
        },
      })),
    );

    const deviceNotRegistered = tickets.some(
      (ticket) => ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered',
    );

    if (deviceNotRegistered) {
      finalRecord = await saveFavoriteDealAlertRecord({
        ...finalRecord,
        devicePushToken: null,
      });
    } else if (tickets.some((ticket) => ticket.status === 'ok')) {
      deliveryMode = 'backend_push';
    }
  }

  return {
    notifications,
    deliveryMode,
    storage,
    state: finalRecord,
  };
}

export async function dispatchFavoriteDealAlertsForAllProfiles() {
  const profiles = await listProfiles();
  const settledResults = await Promise.allSettled(
    profiles.map(async (profile) => {
      const routeState = await getRouteState(profile.id);
      const result = await syncFavoriteDealAlerts({
        profileId: profile.id,
        savedStorefrontIds: routeState.savedStorefrontIds,
        allowNotifications: true,
      });

      return {
        profileId: profile.id,
        notifiedCount: result.deliveryMode === 'none' ? 0 : result.notifications.length,
        deliveryMode: result.deliveryMode,
      };
    }),
  );
  const results = settledResults.flatMap((result, index) => {
    if (result.status === 'fulfilled') {
      return [result.value];
    }

    console.warn(
      `[favoriteDealAlertService] failed to dispatch alerts for profile ${profiles[index]?.id ?? 'unknown'}:`,
      result.reason,
    );
    return [];
  });

  return {
    processedProfiles: profiles.length,
    notifiedProfiles: results.filter((result) => result.notifiedCount > 0).length,
    totalNotifications: results.reduce((sum, result) => sum + result.notifiedCount, 0),
    results,
  };
}

export async function dispatchFavoriteDealAlertsForStorefront(storefrontId: string) {
  const profiles = await listProfiles();
  const settledMatchingProfiles = await Promise.allSettled(
    profiles.map(async (profile) => {
      const routeState = await getRouteState(profile.id);
      if (!routeState.savedStorefrontIds.includes(storefrontId)) {
        return null;
      }

      const result = await syncFavoriteDealAlerts({
        profileId: profile.id,
        savedStorefrontIds: routeState.savedStorefrontIds,
        allowNotifications: true,
      });

      return {
        profileId: profile.id,
        notifiedCount:
          result.deliveryMode === 'none'
            ? 0
            : result.notifications.filter(
                (notification) => notification.storefrontId === storefrontId,
              ).length,
        deliveryMode: result.deliveryMode,
      };
    }),
  );
  const matchingProfiles = settledMatchingProfiles.flatMap((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value ? [result.value] : [];
    }

    console.warn(
      `[favoriteDealAlertService] failed to dispatch storefront alerts for profile ${profiles[index]?.id ?? 'unknown'}:`,
      result.reason,
    );
    return [];
  });

  return {
    storefrontId,
    processedProfiles: matchingProfiles.length,
    notifiedProfiles: matchingProfiles.filter((result) => result.notifiedCount > 0).length,
    totalNotifications: matchingProfiles.reduce((sum, result) => sum + result.notifiedCount, 0),
    results: matchingProfiles,
  };
}

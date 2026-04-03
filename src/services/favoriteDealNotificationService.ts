import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { brand } from '../config/brand';
import type { StorefrontSummary } from '../types/storefront';
import {
  clearRegisteredDevicePushToken,
  CUSTOMER_DEAL_NOTIFICATION_CHANNEL_ID,
  getRegisteredDevicePushToken,
  initializeDevicePushNotifications,
  requestDevicePushNotificationPermission,
} from './devicePushNotificationService';
import { createFavoriteStoreDealNotificationPayload } from './notificationPayloadService';
import type { FavoriteDealAlertState } from '../utils/favoriteDealAlerts';
import {
  EMPTY_FAVORITE_DEAL_ALERT_STATE,
  getFavoriteDealAlertChanges,
} from '../utils/favoriteDealAlerts';

const FAVORITE_DEAL_ALERTS_KEY = `${brand.storageNamespace}:favorite-deal-alerts:v1`;

let memoryState: FavoriteDealAlertState = EMPTY_FAVORITE_DEAL_ALERT_STATE;
let initializationPromise: Promise<FavoriteDealAlertState> | null = null;

function cloneState(state: FavoriteDealAlertState): FavoriteDealAlertState {
  return {
    hasHydrated: state.hasHydrated,
    activeDealFingerprintsByStorefrontId: {
      ...state.activeDealFingerprintsByStorefrontId,
    },
  };
}

async function persistState() {
  try {
    await AsyncStorage.setItem(FAVORITE_DEAL_ALERTS_KEY, JSON.stringify(memoryState));
  } catch {
    // Deal alert persistence should never block the app.
  }
}

export async function initializeCustomerDealNotifications() {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    await initializeDevicePushNotifications();

    try {
      const rawValue = await AsyncStorage.getItem(FAVORITE_DEAL_ALERTS_KEY);
      if (!rawValue) {
        memoryState = cloneState(EMPTY_FAVORITE_DEAL_ALERT_STATE);
        return cloneState(memoryState);
      }

      const parsed = JSON.parse(rawValue) as Partial<FavoriteDealAlertState>;
      memoryState = cloneState({
        hasHydrated: parsed.hasHydrated === true,
        activeDealFingerprintsByStorefrontId: parsed.activeDealFingerprintsByStorefrontId ?? {},
      });
      return cloneState(memoryState);
    } catch {
      memoryState = cloneState(EMPTY_FAVORITE_DEAL_ALERT_STATE);
      return cloneState(memoryState);
    }
  })();

  return initializationPromise;
}

export async function getRegisteredCustomerDealPushToken(options?: { prompt?: boolean }) {
  return getRegisteredDevicePushToken(options);
}

export async function clearRegisteredCustomerDealPushToken() {
  await clearRegisteredDevicePushToken();
}

export async function scheduleFavoriteDealNotification(options: {
  storefrontId: string;
  storefrontName: string;
  promotionText?: string | null;
}) {
  const hasPermission = await requestDevicePushNotificationPermission();
  if (!hasPermission) {
    return null;
  }

  const dealText = options.promotionText?.trim() || 'A saved storefront has a new deal waiting.';

  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: `Deal at ${options.storefrontName}`,
        body: dealText,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
        data: createFavoriteStoreDealNotificationPayload(options.storefrontId),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
        channelId: CUSTOMER_DEAL_NOTIFICATION_CHANNEL_ID,
      },
    });
  } catch {
    return null;
  }
}

export async function syncFavoriteDealNotifications(options: {
  savedSummaries: StorefrontSummary[];
  allowNotifications: boolean;
}) {
  await initializeCustomerDealNotifications();

  const { nextState, notifications } = getFavoriteDealAlertChanges({
    previousState: memoryState,
    savedSummaries: options.savedSummaries,
    allowNotifications: options.allowNotifications,
  });

  memoryState = cloneState(nextState);
  await persistState();

  if (options.allowNotifications) {
    for (const summary of notifications) {
      await scheduleFavoriteDealNotification({
        storefrontId: summary.id,
        storefrontName: summary.displayName,
        promotionText: summary.promotionText,
      });
    }
  }

  return {
    state: cloneState(memoryState),
    notifiedStorefrontIds: notifications.map((summary) => summary.id),
  };
}

export function getFavoriteDealNotificationState() {
  return cloneState(memoryState);
}

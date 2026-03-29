import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { brand } from '../config/brand';
import type { StorefrontSummary } from '../types/storefront';
import {
  EMPTY_FAVORITE_DEAL_ALERT_STATE,
  FavoriteDealAlertState,
  getFavoriteDealAlertChanges,
} from '../utils/favoriteDealAlerts';

const FAVORITE_DEAL_ALERTS_KEY = `${brand.storageNamespace}:favorite-deal-alerts:v1`;
const FAVORITE_DEAL_PUSH_TOKEN_KEY = `${brand.storageNamespace}:favorite-deal-push-token:v1`;
const FAVORITE_DEAL_NOTIFICATION_CHANNEL_ID = 'favorite-store-deals';
const EXPO_PROJECT_ID =
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() ||
  Constants.easConfig?.projectId ||
  Constants.expoConfig?.extra?.eas?.projectId ||
  null;
const isExpoGo = Constants.appOwnership === 'expo';

let memoryState: FavoriteDealAlertState = EMPTY_FAVORITE_DEAL_ALERT_STATE;
let initializationPromise: Promise<FavoriteDealAlertState> | null = null;
let memoryPushToken: string | null = null;

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

async function requestFavoriteDealNotificationPermission(prompt = true) {
  try {
    const currentPermission = await Notifications.getPermissionsAsync();
    if (currentPermission.status === 'granted') {
      return true;
    }

    if (!prompt) {
      return false;
    }

    const permission = await Notifications.requestPermissionsAsync();

    return permission.status === 'granted';
  } catch {
    return false;
  }
}

export async function initializeFavoriteDealNotifications() {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync(FAVORITE_DEAL_NOTIFICATION_CHANNEL_ID, {
          name: 'Favorite store deals',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 180, 80, 180],
        });
      } catch {
        // Channel setup should be best-effort only.
      }
    }

    try {
      const rawToken = await AsyncStorage.getItem(FAVORITE_DEAL_PUSH_TOKEN_KEY);
      memoryPushToken = rawToken?.trim() || null;
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

async function persistFavoriteDealPushToken(token: string | null) {
  memoryPushToken = token?.trim() || null;

  try {
    if (memoryPushToken) {
      await AsyncStorage.setItem(FAVORITE_DEAL_PUSH_TOKEN_KEY, memoryPushToken);
      return;
    }

    await AsyncStorage.removeItem(FAVORITE_DEAL_PUSH_TOKEN_KEY);
  } catch {
    // Push token persistence should never block the app.
  }
}

export async function getRegisteredFavoriteDealPushToken(options?: {
  prompt?: boolean;
}) {
  await initializeFavoriteDealNotifications();

  // Expo documents that remote push token registration is unavailable in Expo Go on Android
  // from SDK 53 onward. Return null so the app can keep using local notifications there.
  if (isExpoGo) {
    return null;
  }

  if (memoryPushToken) {
    return memoryPushToken;
  }

  const hasPermission = await requestFavoriteDealNotificationPermission(options?.prompt ?? false);
  if (!hasPermission) {
    return null;
  }

  try {
    if (!EXPO_PROJECT_ID) {
      return null;
    }

    const token = (
      await Notifications.getExpoPushTokenAsync({
        projectId: EXPO_PROJECT_ID,
      })
    ).data?.trim();

    if (!token) {
      return null;
    }

    await persistFavoriteDealPushToken(token);
    return token;
  } catch {
    return null;
  }
}

export async function clearRegisteredFavoriteDealPushToken() {
  await persistFavoriteDealPushToken(null);
}

export async function scheduleFavoriteDealNotification(options: {
  storefrontId: string;
  storefrontName: string;
  promotionText?: string | null;
}) {
  const hasPermission = await requestFavoriteDealNotificationPermission();
  if (!hasPermission) {
    return null;
  }

  const dealText =
    options.promotionText?.trim() || 'A saved storefront has a new deal waiting.';

  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: `Deal at ${options.storefrontName}`,
        body: dealText,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
        data: {
          kind: 'favorite_store_deal',
          storefrontId: options.storefrontId,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
        channelId: FAVORITE_DEAL_NOTIFICATION_CHANNEL_ID,
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
  await initializeFavoriteDealNotifications();

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

import { Platform } from 'react-native';

export const CUSTOMER_DEAL_NOTIFICATION_CHANNEL_ID = 'favorite-store-deals';
export const OWNER_ALERT_NOTIFICATION_CHANNEL_ID = 'owner-portal-alerts';

/**
 * Web does not support native push notifications. All functions in this module
 * return safe no-op defaults when running on web so that calling code doesn't
 * need platform checks at every call site.
 */
const isWeb = Platform.OS === 'web';

/* ---- Native-only imports (lazy so they never run on web) ---- */
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let SecureStore: typeof import('expo-secure-store') | null = null;
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let Notifications: typeof import('expo-notifications') | null = null;
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let Constants: typeof import('expo-constants').default | null = null;

if (!isWeb) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SecureStore = require('expo-secure-store');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Notifications = require('expo-notifications');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Constants = require('expo-constants').default;
}

// SecureStore (expo-secure-store) only accepts keys matching [A-Za-z0-9._-].
// The previous key `canopytrove:device-push-token:v1` contained `:` chars
// which triggered ensureValidKey() and failed every push token write/read
// with "Invalid key provided to SecureStore" — surfacing as a Sentry error.
// Using `_` as the namespace separator keeps the key human-readable AND
// SecureStore-valid. The `_v2` suffix avoids any chance of stomping on a
// pre-existing successfully-written key (none should exist on Android given
// the historical failure, but iOS may have written one before the validator
// got stricter).
const DEVICE_PUSH_TOKEN_KEY = isWeb
  ? ''
  : (() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { brand } = require('../config/brand');
      return `${brand.storageNamespace}_device_push_token_v2`;
    })();

const EXPO_PROJECT_ID = isWeb
  ? null
  : process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() ||
    Constants?.easConfig?.projectId ||
    Constants?.expoConfig?.extra?.eas?.projectId ||
    null;

const isExpoGo = isWeb ? false : Constants?.appOwnership === 'expo';

let initializationPromise: Promise<string | null> | null = null;
let memoryPushToken: string | null = null;
let notificationHandlerInitialized = false;

function initializeForegroundNotificationHandler() {
  if (isWeb || notificationHandlerInitialized) {
    return;
  }

  Notifications!.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  notificationHandlerInitialized = true;
}

async function persistDevicePushToken(token: string | null) {
  memoryPushToken = token?.trim() || null;

  if (isWeb) return;

  try {
    if (memoryPushToken) {
      await SecureStore!.setItemAsync(DEVICE_PUSH_TOKEN_KEY, memoryPushToken);
      return;
    }

    await SecureStore!.deleteItemAsync(DEVICE_PUSH_TOKEN_KEY);
  } catch {
    // Push token persistence should never block app startup.
  }
}

export async function requestDevicePushNotificationPermission(prompt = true) {
  if (isWeb) return false;

  try {
    const currentPermission = await Notifications!.getPermissionsAsync();
    if (currentPermission.status === 'granted') {
      return true;
    }

    if (!prompt) {
      return false;
    }

    const permission = await Notifications!.requestPermissionsAsync();
    return permission.status === 'granted';
  } catch {
    return false;
  }
}

export async function initializeDevicePushNotifications() {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    if (isWeb) return null;

    initializeForegroundNotificationHandler();

    if (Platform.OS === 'android') {
      try {
        await Notifications!.setNotificationChannelAsync(CUSTOMER_DEAL_NOTIFICATION_CHANNEL_ID, {
          name: 'Favorite store updates',
          importance: Notifications!.AndroidImportance.HIGH,
          vibrationPattern: [0, 180, 80, 180],
        });
        await Notifications!.setNotificationChannelAsync(OWNER_ALERT_NOTIFICATION_CHANNEL_ID, {
          name: 'Owner and runtime alerts',
          importance: Notifications!.AndroidImportance.HIGH,
          vibrationPattern: [0, 240, 120, 240],
        });
      } catch {
        // Channel setup is best-effort only.
      }
    }

    try {
      const rawToken = await SecureStore!.getItemAsync(DEVICE_PUSH_TOKEN_KEY);
      memoryPushToken = rawToken?.trim() || null;
    } catch {
      memoryPushToken = null;
    }

    return memoryPushToken;
  })();

  return initializationPromise;
}

export async function getRegisteredDevicePushToken(options?: { prompt?: boolean }) {
  await initializeDevicePushNotifications();

  if (isExpoGo) {
    return null;
  }

  if (memoryPushToken) {
    return memoryPushToken;
  }

  const hasPermission = await requestDevicePushNotificationPermission(options?.prompt ?? false);
  if (!hasPermission || !EXPO_PROJECT_ID) {
    return null;
  }

  try {
    const token = (
      await Notifications!.getExpoPushTokenAsync({
        projectId: EXPO_PROJECT_ID,
      })
    ).data?.trim();

    if (!token) {
      return null;
    }

    await persistDevicePushToken(token);
    return token;
  } catch {
    return null;
  }
}

export async function clearRegisteredDevicePushToken() {
  await persistDevicePushToken(null);
}

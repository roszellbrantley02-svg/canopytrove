import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { brand } from '../config/brand';

const DEVICE_PUSH_TOKEN_KEY = `${brand.storageNamespace}:device-push-token:v1`;
export const CUSTOMER_DEAL_NOTIFICATION_CHANNEL_ID = 'favorite-store-deals';
export const OWNER_ALERT_NOTIFICATION_CHANNEL_ID = 'owner-portal-alerts';
const EXPO_PROJECT_ID =
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() ||
  Constants.easConfig?.projectId ||
  Constants.expoConfig?.extra?.eas?.projectId ||
  null;
const isExpoGo = Constants.appOwnership === 'expo';

let initializationPromise: Promise<string | null> | null = null;
let memoryPushToken: string | null = null;
let notificationHandlerInitialized = false;

function initializeForegroundNotificationHandler() {
  if (notificationHandlerInitialized) {
    return;
  }

  Notifications.setNotificationHandler({
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

  try {
    if (memoryPushToken) {
      await AsyncStorage.setItem(DEVICE_PUSH_TOKEN_KEY, memoryPushToken);
      return;
    }

    await AsyncStorage.removeItem(DEVICE_PUSH_TOKEN_KEY);
  } catch {
    // Push token persistence should never block app startup.
  }
}

export async function requestDevicePushNotificationPermission(prompt = true) {
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

export async function initializeDevicePushNotifications() {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    initializeForegroundNotificationHandler();

    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync(CUSTOMER_DEAL_NOTIFICATION_CHANNEL_ID, {
          name: 'Favorite store deals',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 180, 80, 180],
        });
        await Notifications.setNotificationChannelAsync(OWNER_ALERT_NOTIFICATION_CHANNEL_ID, {
          name: 'Owner and runtime alerts',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 240, 120, 240],
        });
      } catch {
        // Channel setup is best-effort only.
      }
    }

    try {
      const rawToken = await AsyncStorage.getItem(DEVICE_PUSH_TOKEN_KEY);
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
      await Notifications.getExpoPushTokenAsync({
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

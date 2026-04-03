import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AnalyticsEventInput } from '../types/analytics';
import { INSTALL_ID_KEY, MAX_QUEUE_SIZE, QUEUE_KEY, createAnalyticsId } from './analyticsConfig';

export async function loadPersistedAnalyticsQueue() {
  try {
    const rawValue = await AsyncStorage.getItem(QUEUE_KEY);
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue) as AnalyticsEventInput[];
    return Array.isArray(parsed) ? parsed.slice(-MAX_QUEUE_SIZE) : [];
  } catch {
    return [];
  }
}

export async function persistAnalyticsQueue(events: AnalyticsEventInput[]) {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(events.slice(-MAX_QUEUE_SIZE)));
  } catch {
    // Analytics persistence must never block app flow.
  }
}

export async function ensureAnalyticsInstallId(currentInstallId: string) {
  if (currentInstallId) {
    return currentInstallId;
  }

  try {
    const storedInstallId = await AsyncStorage.getItem(INSTALL_ID_KEY);
    if (storedInstallId?.trim()) {
      return storedInstallId.trim();
    }
  } catch {
    // Ignore storage errors and fall back to a generated ID.
  }

  const nextInstallId = createAnalyticsId('install');
  try {
    await AsyncStorage.setItem(INSTALL_ID_KEY, nextInstallId);
  } catch {
    // Analytics persistence must never block app flow.
  }

  return nextInstallId;
}

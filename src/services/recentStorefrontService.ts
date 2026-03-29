import AsyncStorage from '@react-native-async-storage/async-storage';
import { brand } from '../config/brand';

const RECENT_STOREFRONTS_KEY = `${brand.storageNamespace}:recent-storefronts`;
const MAX_RECENT_STOREFRONTS = 8;

let memoryCachedRecentStorefrontIds: string[] | null = null;
const recentStorefrontListeners = new Set<(storefrontIds: string[]) => void>();

function notifyRecentStorefrontListeners(storefrontIds: string[]) {
  recentStorefrontListeners.forEach((listener) => {
    listener(storefrontIds);
  });
}

export function getCachedRecentStorefrontIds() {
  return memoryCachedRecentStorefrontIds ?? [];
}

export function subscribeToRecentStorefrontIds(listener: (storefrontIds: string[]) => void) {
  recentStorefrontListeners.add(listener);
  return () => {
    recentStorefrontListeners.delete(listener);
  };
}

export async function loadRecentStorefrontIds(): Promise<string[]> {
  try {
    const rawValue = await AsyncStorage.getItem(RECENT_STOREFRONTS_KEY);
    if (!rawValue) {
      return [];
    }

    const ids = JSON.parse(rawValue) as string[];
    memoryCachedRecentStorefrontIds = ids;
    notifyRecentStorefrontListeners(ids);
    return ids;
  } catch {
    return [];
  }
}

export async function saveRecentStorefrontIds(storefrontIds: string[]): Promise<void> {
  const normalizedIds = storefrontIds.slice(0, MAX_RECENT_STOREFRONTS);
  memoryCachedRecentStorefrontIds = normalizedIds;
  notifyRecentStorefrontListeners(normalizedIds);

  try {
    await AsyncStorage.setItem(RECENT_STOREFRONTS_KEY, JSON.stringify(normalizedIds));
  } catch {
    // Recent list persistence should not block app flow.
  }
}

export async function markStorefrontAsRecent(storefrontId: string): Promise<void> {
  const currentIds = memoryCachedRecentStorefrontIds ?? (await loadRecentStorefrontIds());
  const nextIds = [storefrontId, ...currentIds.filter((id) => id !== storefrontId)].slice(
    0,
    MAX_RECENT_STOREFRONTS
  );

  await saveRecentStorefrontIds(nextIds);
}

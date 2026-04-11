import AsyncStorage from '@react-native-async-storage/async-storage';
import { brand } from '../config/brand';
import type { BrowseSortKey, Coordinates, StorefrontGamificationState } from '../types/storefront';

const STOREFRONT_PREFERENCES_KEY_BASE = `${brand.storageNamespace}:storefront-preferences`;

function getPreferencesKey(accountId?: string | null) {
  return accountId
    ? `${STOREFRONT_PREFERENCES_KEY_BASE}:${accountId}`
    : STOREFRONT_PREFERENCES_KEY_BASE;
}

let memoryCachedPreferences: StoredStorefrontPreferences | null = null;
/** Tracks which account's preferences are in the memory cache. */
let memoryCachedAccountId: string | null = null;

export type StoredStorefrontPreferences = {
  profileId?: string;
  // Legacy migration fallback from the old route-specific profile key.
  routeProfileId?: string;
  selectedAreaId?: string;
  searchQuery?: string;
  locationQuery?: string;
  deviceLocationLabel?: string | null;
  browseSortKey?: BrowseSortKey;
  browseHotDealsOnly?: boolean;
  savedStorefrontIds?: string[];
  searchLocation?: Coordinates | null;
  searchLocationLabel?: string | null;
  gamificationState?: StorefrontGamificationState;
};

export function getCachedStorefrontPreferences(accountId?: string | null) {
  // Return cached preferences only if they belong to the requested account.
  if (accountId !== undefined && (accountId ?? null) !== memoryCachedAccountId) {
    return null;
  }
  return memoryCachedPreferences;
}

export async function loadStorefrontPreferences(
  accountId?: string | null,
): Promise<StoredStorefrontPreferences | null> {
  try {
    const key = getPreferencesKey(accountId);
    const rawValue = await AsyncStorage.getItem(key);

    // If scoped key has no data, try migrating from the global key (one-time migration)
    if (!rawValue && accountId) {
      const globalValue = await AsyncStorage.getItem(STOREFRONT_PREFERENCES_KEY_BASE);
      if (globalValue) {
        const globalPreferences = JSON.parse(globalValue) as StoredStorefrontPreferences;
        // Migrate: save under scoped key and clear the global key
        await AsyncStorage.setItem(key, globalValue);
        await AsyncStorage.removeItem(STOREFRONT_PREFERENCES_KEY_BASE);
        memoryCachedPreferences = globalPreferences;
        memoryCachedAccountId = accountId;
        return globalPreferences;
      }
    }

    if (!rawValue) {
      return null;
    }

    const preferences = JSON.parse(rawValue) as StoredStorefrontPreferences;
    memoryCachedPreferences = preferences;
    memoryCachedAccountId = accountId ?? null;
    return preferences;
  } catch {
    return null;
  }
}

export async function saveStorefrontPreferences(
  preferences: StoredStorefrontPreferences,
  accountId?: string | null,
): Promise<void> {
  memoryCachedPreferences = preferences;
  memoryCachedAccountId = accountId ?? null;

  try {
    const key = getPreferencesKey(accountId);
    await AsyncStorage.setItem(key, JSON.stringify(preferences));
  } catch {
    // Preference persistence should never block the app.
  }
}

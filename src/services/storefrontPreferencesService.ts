import AsyncStorage from '@react-native-async-storage/async-storage';
import { brand } from '../config/brand';
import {
  BrowseSortKey,
  Coordinates,
  StorefrontGamificationState,
} from '../types/storefront';

const STOREFRONT_PREFERENCES_KEY = `${brand.storageNamespace}:storefront-preferences`;

let memoryCachedPreferences: StoredStorefrontPreferences | null = null;

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

export function getCachedStorefrontPreferences() {
  return memoryCachedPreferences;
}

export async function loadStorefrontPreferences(): Promise<StoredStorefrontPreferences | null> {
  try {
    const rawValue = await AsyncStorage.getItem(STOREFRONT_PREFERENCES_KEY);
    if (!rawValue) {
      return null;
    }

    const preferences = JSON.parse(rawValue) as StoredStorefrontPreferences;
    memoryCachedPreferences = preferences;
    return preferences;
  } catch {
    return null;
  }
}

export async function saveStorefrontPreferences(
  preferences: StoredStorefrontPreferences
): Promise<void> {
  memoryCachedPreferences = preferences;

  try {
    await AsyncStorage.setItem(STOREFRONT_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Preference persistence should never block the app.
  }
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { brand } from '../config/brand';
import type { StoredStorefrontCommunityState } from './storefrontCommunityLocalShared';
import {
  cloneStorefrontCommunityState,
  EMPTY_STOREFRONT_COMMUNITY_STATE,
} from './storefrontCommunityLocalShared';

const STOREFRONT_COMMUNITY_KEY = `${brand.storageNamespace}:storefront-community`;

let memoryCachedCommunityState: StoredStorefrontCommunityState | null = null;

export async function saveStorefrontCommunityState(state: StoredStorefrontCommunityState) {
  const cloned = cloneStorefrontCommunityState(state);
  memoryCachedCommunityState = cloned;

  try {
    await AsyncStorage.setItem(STOREFRONT_COMMUNITY_KEY, JSON.stringify(cloned));
  } catch {
    // Community overlay persistence should never block the app.
  }
}

export function getCachedStorefrontCommunityState() {
  return memoryCachedCommunityState;
}

export async function loadStorefrontCommunityState(): Promise<StoredStorefrontCommunityState> {
  if (memoryCachedCommunityState) {
    return memoryCachedCommunityState;
  }

  try {
    const rawValue = await AsyncStorage.getItem(STOREFRONT_COMMUNITY_KEY);
    if (!rawValue) {
      memoryCachedCommunityState = cloneStorefrontCommunityState(EMPTY_STOREFRONT_COMMUNITY_STATE);
      return memoryCachedCommunityState;
    }

    const parsed = JSON.parse(rawValue) as Partial<StoredStorefrontCommunityState>;
    const normalized: StoredStorefrontCommunityState = {
      appReviewsByStorefrontId: parsed.appReviewsByStorefrontId ?? {},
      reportsByStorefrontId: parsed.reportsByStorefrontId ?? {},
      helpfulReviewsById: parsed.helpfulReviewsById ?? {},
    };
    memoryCachedCommunityState = cloneStorefrontCommunityState(normalized);
    return memoryCachedCommunityState;
  } catch {
    memoryCachedCommunityState = cloneStorefrontCommunityState(EMPTY_STOREFRONT_COMMUNITY_STATE);
    return memoryCachedCommunityState;
  }
}

export async function primeStoredStorefrontCommunityState() {
  await loadStorefrontCommunityState();
}

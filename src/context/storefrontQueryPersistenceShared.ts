import { normalizeGamificationState } from '../services/canopyTroveGamificationService';
import {
  saveStorefrontPreferences,
  type StoredStorefrontPreferences,
} from '../services/storefrontPreferencesService';
import type { BrowseSortKey, Coordinates, StorefrontGamificationState } from '../types/storefront';

export type StorefrontQueryPersistencePayload = {
  profileId: string;
  selectedAreaId: string;
  searchQuery: string;
  locationQuery: string;
  deviceLocationLabel: string | null;
  browseSortKey: BrowseSortKey;
  browseHotDealsOnly: boolean;
  savedStorefrontIds: string[];
  searchLocation: Coordinates | null;
  searchLocationLabel: string | null;
  gamificationState: StorefrontGamificationState;
};

export function buildStoredPreferencesPayload({
  storedPreferences,
  profileId,
  selectedAreaId,
  defaultAreaLabel,
  profileCreatedAt,
}: {
  storedPreferences: StoredStorefrontPreferences;
  profileId: string;
  selectedAreaId: string;
  defaultAreaLabel: string;
  profileCreatedAt?: string | null;
}) {
  return {
    profileId: storedPreferences.profileId ?? profileId,
    selectedAreaId: storedPreferences.selectedAreaId ?? selectedAreaId,
    searchQuery: storedPreferences.searchQuery ?? '',
    locationQuery: storedPreferences.locationQuery ?? defaultAreaLabel,
    browseSortKey: storedPreferences.browseSortKey ?? 'distance',
    browseHotDealsOnly: storedPreferences.browseHotDealsOnly ?? false,
    savedStorefrontIds: storedPreferences.savedStorefrontIds ?? [],
    deviceLocationLabel: storedPreferences.deviceLocationLabel ?? null,
    searchLocation: storedPreferences.searchLocation ?? null,
    searchLocationLabel: storedPreferences.searchLocationLabel ?? defaultAreaLabel,
    gamificationState:
      storedPreferences.gamificationState ??
      normalizeGamificationState(
        storedPreferences.profileId ?? profileId,
        undefined,
        profileCreatedAt,
      ),
  };
}

export function createStorefrontQueryPreferencesPayload(
  payload: StorefrontQueryPersistencePayload,
) {
  return JSON.stringify(payload);
}

export async function persistStorefrontQueryPreferences(
  payload: StorefrontQueryPersistencePayload,
  accountId?: string | null,
) {
  await saveStorefrontPreferences(payload, accountId);
}

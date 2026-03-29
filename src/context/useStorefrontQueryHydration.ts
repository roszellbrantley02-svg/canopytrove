import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { normalizeGamificationState } from '../services/canopyTroveGamificationService';
import { loadStorefrontPreferences, type StoredStorefrontPreferences } from '../services/storefrontPreferencesService';
import type { BrowseSortKey, Coordinates, StorefrontGamificationState } from '../types/storefront';
import { buildStoredPreferencesPayload } from './storefrontQueryPersistenceShared';

type UseStorefrontQueryHydrationArgs = {
  cachedPreferences: StoredStorefrontPreferences | null;
  profileId: string;
  profileCreatedAt?: string | null;
  defaultAreaLabel: string;
  selectedAreaId: string;
  setHasHydratedPreferences: Dispatch<SetStateAction<boolean>>;
  lastSavedPreferencesPayloadRef: React.MutableRefObject<string | null>;
  setSelectedAreaIdState: Dispatch<SetStateAction<string>>;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  setLocationQuery: Dispatch<SetStateAction<string>>;
  setBrowseSortKey: Dispatch<SetStateAction<BrowseSortKey>>;
  setBrowseHotDealsOnly: Dispatch<SetStateAction<boolean>>;
  setSavedStorefrontIds: Dispatch<SetStateAction<string[]>>;
  setSearchLocation: Dispatch<SetStateAction<Coordinates | null>>;
  setSearchLocationLabel: Dispatch<SetStateAction<string | null>>;
  setDeviceLocationLabel: Dispatch<SetStateAction<string | null>>;
  setGamificationState: Dispatch<SetStateAction<StorefrontGamificationState>>;
};

export function useStorefrontQueryHydration({
  cachedPreferences,
  profileId,
  profileCreatedAt,
  defaultAreaLabel,
  selectedAreaId,
  setHasHydratedPreferences,
  lastSavedPreferencesPayloadRef,
  setSelectedAreaIdState,
  setSearchQuery,
  setLocationQuery,
  setBrowseSortKey,
  setBrowseHotDealsOnly,
  setSavedStorefrontIds,
  setSearchLocation,
  setSearchLocationLabel,
  setDeviceLocationLabel,
  setGamificationState,
}: UseStorefrontQueryHydrationArgs) {
  useEffect(() => {
    if (cachedPreferences) {
      return;
    }

    let alive = true;

    void (async () => {
      const storedPreferences = await loadStorefrontPreferences();
      if (!alive) {
        return;
      }

      if (storedPreferences) {
        const payload = buildStoredPreferencesPayload({
          storedPreferences,
          profileId,
          selectedAreaId,
          defaultAreaLabel,
          profileCreatedAt,
        });
        lastSavedPreferencesPayloadRef.current = JSON.stringify(payload);

        if (storedPreferences.selectedAreaId) {
          setSelectedAreaIdState(storedPreferences.selectedAreaId);
        }

        if (typeof storedPreferences.searchQuery === 'string') {
          setSearchQuery(storedPreferences.searchQuery);
        }

        if (typeof storedPreferences.locationQuery === 'string') {
          setLocationQuery(storedPreferences.locationQuery);
        }

        if (storedPreferences.browseSortKey) {
          setBrowseSortKey(storedPreferences.browseSortKey);
        }

        if (storedPreferences.browseHotDealsOnly !== undefined) {
          setBrowseHotDealsOnly(storedPreferences.browseHotDealsOnly);
        }

        if (Array.isArray(storedPreferences.savedStorefrontIds)) {
          setSavedStorefrontIds(storedPreferences.savedStorefrontIds);
        }

        if (storedPreferences.gamificationState) {
          setGamificationState(
            normalizeGamificationState(
              storedPreferences.profileId ?? profileId,
              storedPreferences.gamificationState,
              profileCreatedAt
            )
          );
        }

        if (storedPreferences.searchLocation) {
          setSearchLocation(storedPreferences.searchLocation);
        }

        if (storedPreferences.searchLocationLabel !== undefined) {
          setSearchLocationLabel(storedPreferences.searchLocationLabel);
        }

        if (storedPreferences.deviceLocationLabel !== undefined) {
          setDeviceLocationLabel(storedPreferences.deviceLocationLabel ?? null);
        }
      }

      setHasHydratedPreferences(true);
    })();

    return () => {
      alive = false;
    };
  }, [
    cachedPreferences,
    defaultAreaLabel,
    lastSavedPreferencesPayloadRef,
    profileCreatedAt,
    profileId,
    selectedAreaId,
    setBrowseHotDealsOnly,
    setBrowseSortKey,
    setDeviceLocationLabel,
    setGamificationState,
    setHasHydratedPreferences,
    setLocationQuery,
    setSavedStorefrontIds,
    setSearchLocation,
    setSearchLocationLabel,
    setSearchQuery,
    setSelectedAreaIdState,
  ]);
}

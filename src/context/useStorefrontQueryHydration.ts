import type React from 'react';
import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { normalizeGamificationState } from '../services/canopyTroveGamificationService';
import {
  loadStorefrontPreferences,
  type StoredStorefrontPreferences,
} from '../services/storefrontPreferencesService';
import type { BrowseSortKey, Coordinates, StorefrontGamificationState } from '../types/storefront';
import { areGamificationStatesEqual, areStringArraysEqual } from './storefrontControllerShared';
import { buildStoredPreferencesPayload } from './storefrontQueryPersistenceShared';

type HydratableStorefrontQueryState = {
  selectedAreaId: string;
  searchQuery: string;
  locationQuery: string;
  browseSortKey: BrowseSortKey;
  browseHotDealsOnly: boolean;
  savedStorefrontIds: string[];
  searchLocation: Coordinates | null;
  searchLocationLabel: string | null;
  deviceLocationLabel: string | null;
  gamificationState: StorefrontGamificationState;
};

type UseStorefrontQueryHydrationArgs = {
  cachedPreferences: StoredStorefrontPreferences | null;
  profileId: string;
  accountId?: string | null;
  profileCreatedAt?: string | null;
  defaultAreaLabel: string;
  selectedAreaId: string;
  latestHydratableStateRef: React.MutableRefObject<HydratableStorefrontQueryState>;
  queryInputMutationCountRef: React.MutableRefObject<number>;
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
  accountId,
  profileCreatedAt,
  defaultAreaLabel,
  selectedAreaId,
  latestHydratableStateRef,
  queryInputMutationCountRef,
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
      const hydrationStartMutationCount = queryInputMutationCountRef.current;
      const hydrationStartState = latestHydratableStateRef.current;
      const storedPreferences = await loadStorefrontPreferences(accountId);
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

        if (queryInputMutationCountRef.current === hydrationStartMutationCount) {
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

          if (Object.prototype.hasOwnProperty.call(storedPreferences, 'searchLocation')) {
            setSearchLocation(storedPreferences.searchLocation ?? null);
          }

          if (storedPreferences.searchLocationLabel !== undefined) {
            setSearchLocationLabel(storedPreferences.searchLocationLabel);
          }

          if (storedPreferences.deviceLocationLabel !== undefined) {
            setDeviceLocationLabel(storedPreferences.deviceLocationLabel ?? null);
          }
        }

        if (
          Array.isArray(storedPreferences.savedStorefrontIds) &&
          areStringArraysEqual(
            latestHydratableStateRef.current.savedStorefrontIds,
            hydrationStartState.savedStorefrontIds,
          )
        ) {
          setSavedStorefrontIds(storedPreferences.savedStorefrontIds);
        }

        if (
          storedPreferences.gamificationState &&
          areGamificationStatesEqual(
            latestHydratableStateRef.current.gamificationState,
            hydrationStartState.gamificationState,
          )
        ) {
          setGamificationState(
            normalizeGamificationState(
              storedPreferences.profileId ?? profileId,
              storedPreferences.gamificationState,
              profileCreatedAt,
            ),
          );
        }
      }

      setHasHydratedPreferences(true);
    })();

    return () => {
      alive = false;
    };
  }, [
    accountId,
    cachedPreferences,
    defaultAreaLabel,
    lastSavedPreferencesPayloadRef,
    latestHydratableStateRef,
    profileCreatedAt,
    profileId,
    queryInputMutationCountRef,
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

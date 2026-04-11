import React, { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { type StoredStorefrontPreferences } from '../services/storefrontPreferencesService';
import type { BrowseSortKey, Coordinates, StorefrontGamificationState } from '../types/storefront';
import { useStorefrontQueryHydration } from './useStorefrontQueryHydration';
import { useStorefrontQuerySavePersistence } from './useStorefrontQuerySavePersistence';

type UseStorefrontQueryPersistenceArgs = {
  cachedPreferences: StoredStorefrontPreferences | null;
  profileId: string;
  accountId?: string | null;
  profileCreatedAt?: string | null;
  defaultAreaLabel: string;
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

export function useStorefrontQueryPersistence({
  cachedPreferences,
  profileId,
  accountId,
  profileCreatedAt,
  defaultAreaLabel,
  selectedAreaId,
  searchQuery,
  locationQuery,
  deviceLocationLabel,
  browseSortKey,
  browseHotDealsOnly,
  savedStorefrontIds,
  searchLocation,
  searchLocationLabel,
  gamificationState,
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
}: UseStorefrontQueryPersistenceArgs) {
  const [hasHydratedPreferences, setHasHydratedPreferences] = useState(Boolean(cachedPreferences));
  const lastSavedPreferencesPayloadRef = useRef<string | null>(null);
  const queryInputMutationCountRef = useRef(0);
  const lastPreferenceScopeKeyRef = useRef<string | null>(null);
  const latestHydratableStateRef = useRef({
    selectedAreaId,
    searchQuery,
    locationQuery,
    browseSortKey,
    browseHotDealsOnly,
    savedStorefrontIds,
    searchLocation,
    searchLocationLabel,
    deviceLocationLabel,
    gamificationState,
  });
  const preferenceScopeKey = accountId ?? '__guest__';

  React.useEffect(() => {
    if (lastPreferenceScopeKeyRef.current === preferenceScopeKey) {
      return;
    }

    lastPreferenceScopeKeyRef.current = preferenceScopeKey;
    queryInputMutationCountRef.current = 0;
    lastSavedPreferencesPayloadRef.current = null;
    setHasHydratedPreferences(Boolean(cachedPreferences));
  }, [cachedPreferences, preferenceScopeKey]);

  // Move updates into useEffect to avoid race conditions during hydration
  React.useEffect(() => {
    latestHydratableStateRef.current = {
      selectedAreaId,
      searchQuery,
      locationQuery,
      browseSortKey,
      browseHotDealsOnly,
      savedStorefrontIds,
      searchLocation,
      searchLocationLabel,
      deviceLocationLabel,
      gamificationState,
    };
  }, [
    selectedAreaId,
    searchQuery,
    locationQuery,
    browseSortKey,
    browseHotDealsOnly,
    savedStorefrontIds,
    searchLocation,
    searchLocationLabel,
    deviceLocationLabel,
    gamificationState,
  ]);

  const markQueryInputTouched = React.useCallback(() => {
    queryInputMutationCountRef.current += 1;
  }, []);

  useStorefrontQueryHydration({
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
  });

  useStorefrontQuerySavePersistence({
    hasHydratedPreferences,
    lastSavedPreferencesPayloadRef,
    accountId,
    profileId,
    selectedAreaId,
    searchQuery,
    locationQuery,
    deviceLocationLabel,
    browseSortKey,
    browseHotDealsOnly,
    savedStorefrontIds,
    searchLocation,
    searchLocationLabel,
    gamificationState,
  });

  return {
    hasHydratedPreferences,
    markQueryInputTouched,
  };
}

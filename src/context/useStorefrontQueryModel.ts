import React, { useCallback, useMemo, useState } from 'react';
import {
  BrowseSortKey,
  Coordinates,
  MarketArea,
  StorefrontGamificationState,
  StorefrontListQuery,
} from '../types/storefront';
import { getCachedMarketAreas } from '../services/marketAreaService';
import { getCachedDeviceLocation } from '../services/locationService';
import {
  StoredStorefrontPreferences,
} from '../services/storefrontPreferencesService';
import {
  getActiveStorefrontLocationState,
  getDefaultMarketArea,
} from './storefrontQueryShared';
import { useStorefrontQueryBootstrap } from './useStorefrontQueryBootstrap';
import { useStorefrontQueryLocationActions } from './useStorefrontQueryLocationActions';
import { useStorefrontQueryPersistence } from './useStorefrontQueryPersistence';

type UseStorefrontQueryModelArgs = {
  cachedPreferences: StoredStorefrontPreferences | null;
  profileId: string;
  profileCreatedAt?: string | null;
  savedStorefrontIds: string[];
  gamificationState: StorefrontGamificationState;
  setSavedStorefrontIds: React.Dispatch<React.SetStateAction<string[]>>;
  setGamificationState: React.Dispatch<React.SetStateAction<StorefrontGamificationState>>;
};

export function useStorefrontQueryModel({
  cachedPreferences,
  profileId,
  profileCreatedAt,
  savedStorefrontIds,
  gamificationState,
  setSavedStorefrontIds,
  setGamificationState,
}: UseStorefrontQueryModelArgs) {
  const [availableAreas, setAvailableAreas] = useState<MarketArea[]>(getCachedMarketAreas());
  const defaultArea = getDefaultMarketArea(availableAreas);
  const [selectedAreaId, setSelectedAreaIdState] = useState<string>(
    cachedPreferences?.selectedAreaId ?? defaultArea.id
  );
  const [searchQuery, setSearchQuery] = useState(cachedPreferences?.searchQuery ?? '');
  const [locationQuery, setLocationQuery] = useState(
    cachedPreferences?.locationQuery ?? defaultArea.label
  );
  const [deviceLocationLabel, setDeviceLocationLabel] = useState<string | null>(
    cachedPreferences?.deviceLocationLabel ?? null
  );
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [browseSortKey, setBrowseSortKey] = useState<BrowseSortKey>(
    cachedPreferences?.browseSortKey ?? 'distance'
  );
  const [browseHotDealsOnly, setBrowseHotDealsOnly] = useState(
    cachedPreferences?.browseHotDealsOnly ?? false
  );
  const [deviceLocation, setDeviceLocation] = useState<Coordinates | null>(() =>
    getCachedDeviceLocation()
  );
  const [searchLocation, setSearchLocation] = useState<Coordinates | null>(
    cachedPreferences?.searchLocation ?? null
  );
  const [searchLocationLabel, setSearchLocationLabel] = useState<string | null>(
    cachedPreferences?.searchLocationLabel ?? defaultArea.label
  );
  const selectedArea =
    availableAreas.find((area) => area.id === selectedAreaId) ?? defaultArea;
  const { activeLocation, activeLocationLabel, activeLocationMode } =
    getActiveStorefrontLocationState({
      deviceLocation,
      deviceLocationLabel,
      searchLocation,
      searchLocationLabel,
      selectedArea,
    });

  const setSelectedAreaId = useCallback(
    (value: string) => {
      const nextArea = availableAreas.find((area) => area.id === value) ?? defaultArea;
      setSelectedAreaIdState(nextArea.id);
      setSearchLocation(nextArea.center);
      setSearchLocationLabel(nextArea.label);
      setLocationQuery(nextArea.label);
      setLocationError(null);
    },
    [availableAreas, defaultArea]
  );
  const { applyLocationQuery, useDeviceLocation } = useStorefrontQueryLocationActions({
    availableAreas,
    locationQuery,
    setSelectedAreaIdState,
    setSearchLocation,
    setSearchLocationLabel,
    setLocationQuery,
    setLocationError,
    setIsResolvingLocation,
    setDeviceLocation,
    setDeviceLocationLabel,
  });

  const storefrontQuery = useMemo<StorefrontListQuery>(
    () => ({
      areaId: selectedAreaId,
      searchQuery,
      origin: activeLocation,
      locationLabel: activeLocationLabel,
      hotDealsOnly: browseHotDealsOnly,
    }),
    [activeLocation, activeLocationLabel, browseHotDealsOnly, searchQuery, selectedAreaId]
  );

  const { hasHydratedPreferences } = useStorefrontQueryPersistence({
    cachedPreferences,
    profileId,
    profileCreatedAt,
    defaultAreaLabel: defaultArea.label,
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
  });

  useStorefrontQueryBootstrap({
    availableAreas,
    selectedAreaId,
    searchLocation,
    deviceLocation,
    deviceLocationLabel,
    setAvailableAreas,
    setSelectedAreaIdState,
    setLocationQuery,
    setDeviceLocation,
    setDeviceLocationLabel,
  });

  return {
    availableAreas,
    selectedAreaId,
    selectedArea,
    searchQuery,
    locationQuery,
    deviceLocationLabel,
    locationError,
    isResolvingLocation,
    browseSortKey,
    browseHotDealsOnly,
    deviceLocation,
    searchLocation,
    activeLocation,
    activeLocationMode,
    activeLocationLabel,
    storefrontQuery,
    hasHydratedPreferences,
    setSelectedAreaId,
    setSearchQuery,
    setLocationQuery,
    setBrowseSortKey,
    setBrowseHotDealsOnly,
    setDeviceLocation,
    useDeviceLocation,
    applyLocationQuery,
  };
}

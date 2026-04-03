import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import type {
  BrowseSortKey,
  Coordinates,
  MarketArea,
  StorefrontGamificationState,
  StorefrontListQuery,
} from '../types/storefront';
import { getCachedMarketAreas } from '../services/marketAreaService';
import { getCachedDeviceLocation } from '../services/locationService';
import type { StoredStorefrontPreferences } from '../services/storefrontPreferencesService';
import { getActiveStorefrontLocationState, getDefaultMarketArea } from './storefrontQueryShared';
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
    cachedPreferences?.selectedAreaId ?? defaultArea.id,
  );
  const [searchQuery, setSearchQueryState] = useState(cachedPreferences?.searchQuery ?? '');
  const [locationQuery, setLocationQueryState] = useState(
    cachedPreferences?.locationQuery ?? defaultArea.label,
  );
  const [deviceLocationLabel, setDeviceLocationLabelState] = useState<string | null>(
    cachedPreferences?.deviceLocationLabel ?? null,
  );
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [browseSortKey, setBrowseSortKeyState] = useState<BrowseSortKey>(
    cachedPreferences?.browseSortKey ?? 'distance',
  );
  const [browseHotDealsOnly, setBrowseHotDealsOnlyState] = useState(
    cachedPreferences?.browseHotDealsOnly ?? false,
  );
  const [deviceLocation, setDeviceLocationState] = useState<Coordinates | null>(() =>
    getCachedDeviceLocation(),
  );
  const [searchLocation, setSearchLocationState] = useState<Coordinates | null>(
    cachedPreferences?.searchLocation ?? null,
  );
  const [searchLocationLabel, setSearchLocationLabelState] = useState<string | null>(
    cachedPreferences?.searchLocationLabel ?? defaultArea.label,
  );
  const selectedArea = availableAreas.find((area) => area.id === selectedAreaId) ?? defaultArea;
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
      setSearchLocationState(nextArea.center);
      setSearchLocationLabelState(nextArea.label);
      setLocationQueryState(nextArea.label);
      setLocationError(null);
    },
    [availableAreas, defaultArea],
  );

  const storefrontQuery = useMemo<StorefrontListQuery>(
    () => ({
      areaId: selectedArea.id,
      searchQuery,
      origin: activeLocation,
      locationLabel: activeLocationLabel,
      hotDealsOnly: browseHotDealsOnly,
    }),
    [activeLocation, activeLocationLabel, browseHotDealsOnly, searchQuery, selectedArea.id],
  );

  const { hasHydratedPreferences, markQueryInputTouched } = useStorefrontQueryPersistence({
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
    setSearchQuery: setSearchQueryState,
    setLocationQuery: setLocationQueryState,
    setBrowseSortKey: setBrowseSortKeyState,
    setBrowseHotDealsOnly: setBrowseHotDealsOnlyState,
    setSavedStorefrontIds,
    setSearchLocation: setSearchLocationState,
    setSearchLocationLabel: setSearchLocationLabelState,
    setDeviceLocationLabel: setDeviceLocationLabelState,
    setGamificationState,
  });

  const { applyLocationQuery, useDeviceLocation } = useStorefrontQueryLocationActions({
    availableAreas,
    locationQuery,
    markQueryInputTouched,
    setSelectedAreaIdState,
    setSearchLocation: setSearchLocationState,
    setSearchLocationLabel: setSearchLocationLabelState,
    setLocationQuery: setLocationQueryState,
    setLocationError,
    setIsResolvingLocation,
    setDeviceLocation: setDeviceLocationState,
    setDeviceLocationLabel: setDeviceLocationLabelState,
  });

  const setSearchQuery = useCallback(
    (value: string) => {
      markQueryInputTouched();
      setSearchQueryState(value);
    },
    [markQueryInputTouched],
  );
  const setLocationQuery = useCallback(
    (value: string) => {
      markQueryInputTouched();
      setLocationQueryState(value);
    },
    [markQueryInputTouched],
  );
  const setBrowseSortKey = useCallback(
    (value: BrowseSortKey) => {
      markQueryInputTouched();
      setBrowseSortKeyState(value);
    },
    [markQueryInputTouched],
  );
  const setBrowseHotDealsOnly = useCallback(
    (value: boolean) => {
      markQueryInputTouched();
      setBrowseHotDealsOnlyState(value);
    },
    [markQueryInputTouched],
  );
  const setDeviceLocation = useCallback(
    (value: Coordinates | null) => {
      markQueryInputTouched();
      setDeviceLocationState(value);
    },
    [markQueryInputTouched],
  );
  const setTrackedSelectedAreaId = useCallback(
    (value: string) => {
      markQueryInputTouched();
      setSelectedAreaId(value);
    },
    [markQueryInputTouched, setSelectedAreaId],
  );

  useStorefrontQueryBootstrap({
    availableAreas,
    selectedAreaId,
    searchLocation,
    deviceLocation,
    deviceLocationLabel,
    setAvailableAreas,
    setSelectedAreaIdState,
    setLocationQuery: setLocationQueryState,
    setDeviceLocation: setDeviceLocationState,
    setDeviceLocationLabel: setDeviceLocationLabelState,
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
    setSelectedAreaId: setTrackedSelectedAreaId,
    setSearchQuery,
    setLocationQuery,
    setBrowseSortKey,
    setBrowseHotDealsOnly,
    setDeviceLocation,
    useDeviceLocation,
    applyLocationQuery,
  };
}

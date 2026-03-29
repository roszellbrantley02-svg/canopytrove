import React from 'react';
import { findNearestArea, getBestAvailableDeviceLocation, resolveSearchLocation } from '../services/locationService';
import { Coordinates, MarketArea } from '../types/storefront';

type UseStorefrontQueryLocationActionsArgs = {
  availableAreas: MarketArea[];
  locationQuery: string;
  setSelectedAreaIdState: React.Dispatch<React.SetStateAction<string>>;
  setSearchLocation: React.Dispatch<React.SetStateAction<Coordinates | null>>;
  setSearchLocationLabel: React.Dispatch<React.SetStateAction<string | null>>;
  setLocationQuery: React.Dispatch<React.SetStateAction<string>>;
  setLocationError: React.Dispatch<React.SetStateAction<string | null>>;
  setIsResolvingLocation: React.Dispatch<React.SetStateAction<boolean>>;
  setDeviceLocation: React.Dispatch<React.SetStateAction<Coordinates | null>>;
  setDeviceLocationLabel: React.Dispatch<React.SetStateAction<string | null>>;
};

export function useStorefrontQueryLocationActions({
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
}: UseStorefrontQueryLocationActionsArgs) {
  const useDeviceLocation = React.useCallback(async () => {
    setIsResolvingLocation(true);
    setLocationError(null);

    try {
      const result = await getBestAvailableDeviceLocation();
      if (!result.coordinates) {
        setSearchLocation(null);
        setSearchLocationLabel(null);
        setDeviceLocationLabel(null);
        setLocationError('Allow location access to show the nearest dispensaries.');
        return false;
      }

      const nearestArea = findNearestArea(availableAreas, result.coordinates);
      setDeviceLocation(result.coordinates);
      setDeviceLocationLabel(null);
      setSelectedAreaIdState(nearestArea.id);
      setLocationQuery(nearestArea.label);
      setSearchLocation(null);
      setSearchLocationLabel(null);
      return true;
    } finally {
      setIsResolvingLocation(false);
    }
  }, [
    availableAreas,
    setDeviceLocation,
    setDeviceLocationLabel,
    setIsResolvingLocation,
    setLocationError,
    setLocationQuery,
    setSearchLocation,
    setSearchLocationLabel,
    setSelectedAreaIdState,
  ]);

  const resolveAndApplyLocation = React.useCallback(
    async (queryValue: string) => {
      if (!queryValue.trim()) {
        setLocationError('Enter a city, ZIP, or area first.');
        return false;
      }

      setIsResolvingLocation(true);
      setLocationError(null);

      try {
        const result = await resolveSearchLocation(queryValue, availableAreas);
        if (!result.coordinates) {
          setLocationError('Location not found. Try a New York city or ZIP.');
          return false;
        }

        const nearestArea = findNearestArea(availableAreas, result.coordinates);
        setSelectedAreaIdState(nearestArea.id);
        setLocationQuery(result.label ?? queryValue.trim());
        setSearchLocation(result.coordinates);
        setSearchLocationLabel(result.label ?? nearestArea.label);
        return true;
      } finally {
        setIsResolvingLocation(false);
      }
    },
    [
      availableAreas,
      setIsResolvingLocation,
      setLocationError,
      setLocationQuery,
      setSearchLocation,
      setSearchLocationLabel,
      setSelectedAreaIdState,
    ]
  );

  const applyLocationQuery = React.useCallback(() => {
    return resolveAndApplyLocation(locationQuery);
  }, [locationQuery, resolveAndApplyLocation]);

  return {
    applyLocationQuery,
    useDeviceLocation,
  };
}

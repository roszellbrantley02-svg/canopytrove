import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { getAvailableMarketAreas, getCachedMarketAreas } from '../services/marketAreaService';
import {
  findNearestArea,
  getBestAvailableDeviceLocation,
  resolveDeviceLocationLabel,
} from '../services/locationService';
import type { Coordinates, MarketArea } from '../types/storefront';

type UseStorefrontQueryBootstrapArgs = {
  availableAreas: MarketArea[];
  selectedAreaId: string;
  searchLocation: Coordinates | null;
  deviceLocation: Coordinates | null;
  deviceLocationLabel: string | null;
  setAvailableAreas: Dispatch<SetStateAction<MarketArea[]>>;
  setSelectedAreaIdState: Dispatch<SetStateAction<string>>;
  setLocationQuery: Dispatch<SetStateAction<string>>;
  setDeviceLocation: Dispatch<SetStateAction<Coordinates | null>>;
  setDeviceLocationLabel: Dispatch<SetStateAction<string | null>>;
};

export function useStorefrontQueryBootstrap({
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
}: UseStorefrontQueryBootstrapArgs) {
  useEffect(() => {
    let alive = true;

    void (async () => {
      const nextAreas = await getAvailableMarketAreas();
      if (!alive || !nextAreas.length) {
        return;
      }

      setAvailableAreas(nextAreas);
    })();

    return () => {
      alive = false;
    };
  }, [setAvailableAreas]);

  useEffect(() => {
    if (availableAreas.some((area) => area.id === selectedAreaId)) {
      return;
    }

    const nextArea = availableAreas[0] ?? getCachedMarketAreas()[0];
    setSelectedAreaIdState(nextArea.id);
    if (!searchLocation) {
      setLocationQuery(nextArea.label);
    }
  }, [availableAreas, searchLocation, selectedAreaId, setLocationQuery, setSelectedAreaIdState]);

  useEffect(() => {
    if (deviceLocation) {
      return;
    }

    let alive = true;

    void (async () => {
      const result = await getBestAvailableDeviceLocation();
      if (!alive || !result.coordinates) {
        return;
      }

      const nearestArea = findNearestArea(availableAreas, result.coordinates);
      setDeviceLocation(result.coordinates);
      setDeviceLocationLabel(null);
      setSelectedAreaIdState((currentAreaId) => {
        if (searchLocation) {
          return currentAreaId;
        }

        return nearestArea.id;
      });

      if (!searchLocation) {
        setLocationQuery(nearestArea.label);
      }
    })();

    return () => {
      alive = false;
    };
  }, [
    availableAreas,
    deviceLocation,
    searchLocation,
    setDeviceLocation,
    setDeviceLocationLabel,
    setLocationQuery,
    setSelectedAreaIdState,
  ]);

  useEffect(() => {
    if (!deviceLocation || searchLocation || deviceLocationLabel) {
      return;
    }

    let alive = true;

    void (async () => {
      const nearestArea = findNearestArea(availableAreas, deviceLocation);
      const resolvedDeviceLocationLabel = await resolveDeviceLocationLabel(
        deviceLocation,
        nearestArea.label
      );
      if (!alive) {
        return;
      }

      setDeviceLocationLabel(resolvedDeviceLocationLabel);
      setLocationQuery((current) => {
        const normalizedCurrent = current.trim();
        if (!normalizedCurrent || normalizedCurrent === nearestArea.label) {
          return resolvedDeviceLocationLabel ?? nearestArea.label;
        }

        return current;
      });
    })();

    return () => {
      alive = false;
    };
  }, [
    availableAreas,
    deviceLocation,
    deviceLocationLabel,
    searchLocation,
    setDeviceLocationLabel,
    setLocationQuery,
  ]);
}

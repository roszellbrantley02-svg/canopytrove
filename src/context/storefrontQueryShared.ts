import { getCachedMarketAreas } from '../services/marketAreaService';
import { Coordinates, MarketArea } from '../types/storefront';

export function getDefaultMarketArea(availableAreas: MarketArea[]) {
  return availableAreas[0] ?? getCachedMarketAreas()[0];
}

export function getActiveStorefrontLocationState({
  deviceLocation,
  deviceLocationLabel,
  searchLocation,
  searchLocationLabel,
  selectedArea,
}: {
  deviceLocation: Coordinates | null;
  deviceLocationLabel: string | null;
  searchLocation: Coordinates | null;
  searchLocationLabel: string | null;
  selectedArea: MarketArea;
}) {
  const activeLocation = searchLocation ?? deviceLocation ?? selectedArea.center;
  const activeLocationMode: 'search' | 'device' | 'fallback' = searchLocation
    ? 'search'
    : deviceLocation
      ? 'device'
      : 'fallback';
  const activeLocationLabel =
    activeLocationMode === 'search'
      ? searchLocationLabel ?? selectedArea.label
      : activeLocationMode === 'device'
        ? deviceLocationLabel ?? `Near ${selectedArea.label}`
        : selectedArea.label;

  return {
    activeLocation,
    activeLocationLabel,
    activeLocationMode,
  };
}

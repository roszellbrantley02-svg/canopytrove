import AsyncStorage from '@react-native-async-storage/async-storage';
import { brand } from '../config/brand';
import { storefrontApiBaseUrl, storefrontSourceMode } from '../config/storefrontSourceConfig';
import { mockAreas } from '../data/mockAreas';
import { MarketArea } from '../types/storefront';
import { getStorefrontBackendMarketAreas } from './storefrontBackendService';

const MARKET_AREAS_CACHE_KEY = `${brand.storageNamespace}:market-areas`;

let memoryCachedAreas: MarketArea[] | null = null;

export function getCachedMarketAreas() {
  return memoryCachedAreas ?? mockAreas;
}

export async function primeStoredMarketAreas() {
  try {
    const rawValue = await AsyncStorage.getItem(MARKET_AREAS_CACHE_KEY);
    if (!rawValue) {
      return null;
    }

    const areas = JSON.parse(rawValue) as MarketArea[];
    if (areas.length) {
      memoryCachedAreas = areas;
    }

    return areas;
  } catch {
    return null;
  }
}

async function saveStoredMarketAreas(areas: MarketArea[]) {
  try {
    await AsyncStorage.setItem(MARKET_AREAS_CACHE_KEY, JSON.stringify(areas));
  } catch {
    // Market-area caching should not block render flow.
  }
}

export async function getAvailableMarketAreas(): Promise<MarketArea[]> {
  await primeStoredMarketAreas();

  if (storefrontSourceMode === 'api' && storefrontApiBaseUrl) {
    try {
      const areas = await getStorefrontBackendMarketAreas();
      if (areas.length) {
        memoryCachedAreas = areas;
        void saveStoredMarketAreas(areas);
        return areas;
      }
    } catch {
      return memoryCachedAreas ?? mockAreas;
    }
  }

  if (memoryCachedAreas?.length) {
    return memoryCachedAreas;
  }

  memoryCachedAreas = mockAreas;
  return mockAreas;
}

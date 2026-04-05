import { Platform } from 'react-native';
import { storefrontApiBaseUrl, storefrontSourceMode } from '../config/storefrontSourceConfig';

/* expo-location has no web implementation — lazy-require on native only. */
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let Location: typeof import('expo-location') | null = null;
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Location = require('expo-location');
}
import { resolveStorefrontBackendLocation } from './storefrontBackendService';
import type { MarketArea } from '../types/storefront';
import type { SearchLocationResult } from './locationServiceShared';
import {
  findAreaByQuery,
  formatResolvedLabel,
  scoreResolvedAddress,
} from './locationServiceShared';

const locationSearchCache = new Map<string, SearchLocationResult>();
const locationSearchInFlight = new Map<string, Promise<SearchLocationResult>>();

export async function resolveSearchLocation(
  query: string,
  areas: MarketArea[],
): Promise<SearchLocationResult> {
  const cacheKey = query.trim().toLowerCase();
  const cached = locationSearchCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const pending = locationSearchInFlight.get(cacheKey);
  if (pending) {
    return pending;
  }

  const task = (async (): Promise<SearchLocationResult> => {
    const areaMatch = findAreaByQuery(areas, query);
    if (areaMatch) {
      const result: SearchLocationResult = {
        coordinates: areaMatch.center,
        label: areaMatch.label,
        source: 'area',
      };
      locationSearchCache.set(cacheKey, result);
      return result;
    }

    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      const result: SearchLocationResult = {
        coordinates: null,
        label: null,
        source: 'unavailable',
      };
      locationSearchCache.set(cacheKey, result);
      return result;
    }

    if (storefrontSourceMode === 'api' && storefrontApiBaseUrl) {
      try {
        const backendResult = await resolveStorefrontBackendLocation(normalizedQuery);
        if (backendResult.coordinates) {
          const result: SearchLocationResult = {
            coordinates: backendResult.coordinates,
            label: backendResult.label ?? normalizedQuery,
            source:
              backendResult.source === 'area'
                ? 'area'
                : backendResult.source === 'summary'
                  ? 'geocode'
                  : 'unavailable',
          };
          locationSearchCache.set(cacheKey, result);
          return result;
        }
      } catch {
        // Fall through to Expo-based geocoding.
      }
    }

    /* expo-location geocoding is native-only. On web, if the backend
       didn't resolve the query, we fall through to 'unavailable'. */
    if (Location) {
      const candidates = normalizedQuery.toLowerCase().includes('ny')
        ? [normalizedQuery]
        : [`${normalizedQuery}, New York`, `${normalizedQuery}, NY`, normalizedQuery];

      let bestMatch: SearchLocationResult | null = null;
      let bestScore = -1;

      for (const candidate of candidates) {
        try {
          const matches = await Location.geocodeAsync(candidate);
          if (!matches.length) {
            continue;
          }

          for (const match of matches.slice(0, 3)) {
            let address: Awaited<ReturnType<typeof Location.reverseGeocodeAsync>>[number] | null =
              null;

            try {
              const reverseMatches = await Location.reverseGeocodeAsync({
                latitude: match.latitude,
                longitude: match.longitude,
              });
              address = reverseMatches[0] ?? null;
            } catch {
              address = null;
            }

            const score = scoreResolvedAddress(normalizedQuery, address);
            if (score > bestScore) {
              bestScore = score;
              bestMatch = {
                coordinates: {
                  latitude: match.latitude,
                  longitude: match.longitude,
                },
                label: formatResolvedLabel(normalizedQuery, address),
                source: 'geocode',
              };
            }
          }
        } catch {
          continue;
        }
      }

      if (bestMatch && bestMatch.coordinates && bestScore >= 4) {
        locationSearchCache.set(cacheKey, bestMatch);
        return bestMatch;
      }
    }

    const result: SearchLocationResult = {
      coordinates: null,
      label: null,
      source: 'unavailable',
    };
    locationSearchCache.set(cacheKey, result);
    return result;
  })();

  locationSearchInFlight.set(cacheKey, task);

  try {
    return await task;
  } finally {
    locationSearchInFlight.delete(cacheKey);
  }
}

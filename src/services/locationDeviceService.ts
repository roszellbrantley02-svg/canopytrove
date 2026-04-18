import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { brand } from '../config/brand';
import type { Coordinates } from '../types/storefront';
import type { DeviceLocationResult } from './locationServiceShared';
import { createCoordinatesCacheKey, formatResolvedLabel } from './locationServiceShared';

/* expo-location has no web implementation — lazy-require on native only. */
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let Location: typeof import('expo-location') | null = null;
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Location = require('expo-location');
}

const DEVICE_LOCATION_CACHE_KEY = `${brand.storageNamespace}:device-location`;
const DEVICE_LOCATION_TTL_MS = 15 * 60 * 1000;
const DEVICE_LOCATION_LABEL_CACHE_LIMIT = 24;

const deviceLocationLabelCache = new Map<string, string>();
let memoryCachedDeviceLocation: Coordinates | null = null;
let deviceLocationCachedAt = 0;
let deviceLocationInFlight: Promise<DeviceLocationResult> | null = null;

export async function getBestAvailableDeviceLocation(): Promise<DeviceLocationResult> {
  if (deviceLocationInFlight) {
    return deviceLocationInFlight;
  }

  const task = (async (): Promise<DeviceLocationResult> => {
    try {
      if (Platform.OS === 'web') {
        return await getWebDeviceLocation();
      }

      const currentPermission = await Location!.getForegroundPermissionsAsync();
      const permission =
        currentPermission.status === 'granted'
          ? currentPermission
          : await Location!.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        return { coordinates: null, source: 'unavailable' };
      }

      const current = await Location!.getCurrentPositionAsync({
        accuracy: Location!.Accuracy.High,
      });
      const coordinates = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };
      void cacheDeviceLocation(coordinates);

      return {
        coordinates,
        source: 'current',
      };
    } catch {
      return { coordinates: null, source: 'unavailable' };
    } finally {
      deviceLocationInFlight = null;
    }
  })();

  deviceLocationInFlight = task;
  return task;
}

/**
 * Silent probe — returns the device location ONLY if permission was already
 * granted in a previous session. Never triggers the native permission prompt.
 * Used by silent bootstrap paths so first-time users aren't cold-prompted for
 * location before they understand what the app does. Use
 * `getBestAvailableDeviceLocation` instead when the request is driven by an
 * explicit user tap.
 */
export async function getPassiveDeviceLocation(): Promise<DeviceLocationResult> {
  try {
    if (Platform.OS === 'web') {
      // Web: fall back to the cached reading; Browser Geolocation API doesn't
      // expose a pre-check equivalent that's reliable across vendors.
      const cached = getCachedDeviceLocation();
      return cached
        ? { coordinates: cached, source: 'lastKnown' }
        : { coordinates: null, source: 'unavailable' };
    }

    const currentPermission = await Location!.getForegroundPermissionsAsync();
    if (currentPermission.status !== 'granted') {
      const cached = getCachedDeviceLocation();
      return cached
        ? { coordinates: cached, source: 'lastKnown' }
        : { coordinates: null, source: 'unavailable' };
    }

    const current = await Location!.getCurrentPositionAsync({
      accuracy: Location!.Accuracy.High,
    });
    const coordinates = {
      latitude: current.coords.latitude,
      longitude: current.coords.longitude,
    };
    void cacheDeviceLocation(coordinates);
    return { coordinates, source: 'current' };
  } catch {
    return { coordinates: null, source: 'unavailable' };
  }
}

export function getCachedDeviceLocation() {
  if (!memoryCachedDeviceLocation) {
    return null;
  }

  if (Date.now() - deviceLocationCachedAt > DEVICE_LOCATION_TTL_MS) {
    return null;
  }

  return memoryCachedDeviceLocation;
}

async function cacheDeviceLocation(coordinates: Coordinates) {
  memoryCachedDeviceLocation = coordinates;
  deviceLocationCachedAt = Date.now();

  try {
    await AsyncStorage.setItem(
      DEVICE_LOCATION_CACHE_KEY,
      JSON.stringify({
        coordinates,
        cachedAt: deviceLocationCachedAt,
      }),
    );
  } catch {
    // Device-location caching should not block app flow.
  }
}

export async function primeStoredDeviceLocation() {
  if (getCachedDeviceLocation()) {
    return getCachedDeviceLocation();
  }

  try {
    const rawValue = await AsyncStorage.getItem(DEVICE_LOCATION_CACHE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as {
      coordinates?: Coordinates | null;
      cachedAt?: number;
    };
    if (!parsed.coordinates || !parsed.cachedAt) {
      return null;
    }

    if (Date.now() - parsed.cachedAt > DEVICE_LOCATION_TTL_MS) {
      return null;
    }

    memoryCachedDeviceLocation = parsed.coordinates;
    deviceLocationCachedAt = parsed.cachedAt;
    return parsed.coordinates;
  } catch {
    return null;
  }
}

/**
 * Browser Geolocation API wrapper. Returns coordinates via the
 * standard `navigator.geolocation.getCurrentPosition` API.
 */
function getWebDeviceLocation(): Promise<DeviceLocationResult> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({ coordinates: null, source: 'unavailable' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        void cacheDeviceLocation(coordinates);
        resolve({ coordinates, source: 'current' });
      },
      () => {
        // Geolocation failed or was denied — return cached location if
        // available so callers still have something to work with.
        const cached = getCachedDeviceLocation();
        resolve(
          cached
            ? { coordinates: cached, source: 'lastKnown' }
            : { coordinates: null, source: 'unavailable' },
        );
      },
      { enableHighAccuracy: true, timeout: 8_000, maximumAge: 60_000 },
    );
  });
}

export async function resolveDeviceLocationLabel(
  coordinates: Coordinates,
  fallbackLabel?: string | null,
) {
  const cacheKey = createCoordinatesCacheKey(coordinates);
  const cached = deviceLocationLabelCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const nextFallbackLabel = fallbackLabel?.trim() || 'Current location';

  if (Platform.OS === 'web') {
    // On web, reverse geocoding is handled via the backend Google Places
    // gateway. For now, return the fallback label. A full web implementation
    // can call the backend reverse-geocode endpoint later.
    return nextFallbackLabel;
  }

  try {
    const reverseMatches = await Location!.reverseGeocodeAsync({
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    });
    const label = formatResolvedLabel(nextFallbackLabel, reverseMatches[0] ?? null);
    if (deviceLocationLabelCache.has(cacheKey)) {
      deviceLocationLabelCache.delete(cacheKey);
    }
    deviceLocationLabelCache.set(cacheKey, label);
    while (deviceLocationLabelCache.size > DEVICE_LOCATION_LABEL_CACHE_LIMIT) {
      const oldestCacheKey = deviceLocationLabelCache.keys().next().value;
      if (!oldestCacheKey) {
        break;
      }

      deviceLocationLabelCache.delete(oldestCacheKey);
    }
    return label;
  } catch {
    return nextFallbackLabel;
  }
}

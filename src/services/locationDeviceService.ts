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

/**
 * Hard ceiling for how long we'll wait for a fresh GPS fix before giving up
 * and returning whatever `lastKnown` value we have (possibly null). Android
 * was observed hanging on `getCurrentPositionAsync` for 20-30+ seconds with
 * `Accuracy.High` on cold GPS — the user reported "took forever and didn't
 * seem to work". 8s is long enough for a warm fix on all tested devices
 * and short enough that the UI isn't visibly frozen.
 */
const LOCATION_FIX_TIMEOUT_MS = 8_000;

/**
 * Last-known positions older than this are treated as stale and we prefer
 * to wait for a fresh fix. OS-reported lastKnown can be multi-hour on
 * rarely-used devices. 5 minutes is enough overlap that foreground
 * re-requests feel instant without silently handing back a wildly wrong
 * stale coordinate.
 */
const LAST_KNOWN_MAX_AGE_MS = 5 * 60 * 1000;

type ExpoLocationModule = NonNullable<typeof Location>;

/**
 * Race a lastKnown lookup against a fresh getCurrent call. Returns the
 * first usable coordinate — if lastKnown returns instantly (the common
 * case on Android once the OS has ever resolved location) the UI doesn't
 * wait on the cold GPS fix. If neither resolves before
 * LOCATION_FIX_TIMEOUT_MS, resolves null so callers can short-circuit to
 * their own stored cache.
 *
 * Using `Accuracy.Balanced` instead of `High` because the dispensary-
 * discovery use case only needs ~100m accuracy to pick "nearby" shops —
 * Balanced is ~5-10x faster on Android (cell + wifi trilateration instead
 * of a full GPS lock) and drops battery draw too.
 */
async function fetchLocationFast(mod: ExpoLocationModule): Promise<Coordinates | null> {
  const deadline = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), LOCATION_FIX_TIMEOUT_MS),
  );

  const lastKnown = (async () => {
    try {
      const result = await mod.getLastKnownPositionAsync({
        maxAge: LAST_KNOWN_MAX_AGE_MS,
        requiredAccuracy: 200,
      });
      if (!result) {
        return null;
      }
      return {
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
      };
    } catch {
      return null;
    }
  })();

  const fresh = (async () => {
    try {
      const result = await mod.getCurrentPositionAsync({
        accuracy: mod.Accuracy.Balanced,
      });
      return {
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
      };
    } catch {
      return null;
    }
  })();

  // First usable coordinate wins. `Promise.race` can't filter by truthiness
  // on its own, so resolve each leg to either coords-or-never and race with
  // the deadline — whichever fires first returns. If lastKnown is null the
  // leg simply never resolves (not "resolves null"), leaving the race to
  // either the fresh fix or the deadline.
  return new Promise<Coordinates | null>((resolve) => {
    let settled = false;
    const finish = (value: Coordinates | null) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(value);
    };
    lastKnown.then((value) => {
      if (value) {
        finish(value);
      }
    });
    fresh.then((value) => {
      if (value) {
        finish(value);
      }
    });
    // If neither leg produces a value, the deadline resolves null and we
    // bubble it up so callers fall back to their stored cache.
    deadline.then(() => finish(null));
  });
}

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

      // Race lastKnown vs fresh Balanced-accuracy fix; whichever wins the
      // race gets returned first. On Android this drops the "find me"
      // latency from 15-30s cold-GPS to near-instant when the OS already
      // has a recent fix.
      const coordinates = await fetchLocationFast(Location!);
      if (!coordinates) {
        // Neither lastKnown nor a fresh fix arrived in time. Hand back
        // whatever we persisted from a prior session rather than showing
        // "location unavailable" when we do have something on disk.
        const cached = getCachedDeviceLocation();
        return cached
          ? { coordinates: cached, source: 'lastKnown' }
          : { coordinates: null, source: 'unavailable' };
      }
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

    const coordinates = await fetchLocationFast(Location!);
    if (!coordinates) {
      const cached = getCachedDeviceLocation();
      return cached
        ? { coordinates: cached, source: 'lastKnown' }
        : { coordinates: null, source: 'unavailable' };
    }
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

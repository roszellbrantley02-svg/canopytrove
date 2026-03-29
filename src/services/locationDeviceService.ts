import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { brand } from '../config/brand';
import { Coordinates } from '../types/storefront';
import {
  createCoordinatesCacheKey,
  DeviceLocationResult,
  formatResolvedLabel,
} from './locationServiceShared';

const DEVICE_LOCATION_CACHE_KEY = `${brand.storageNamespace}:device-location`;
const DEVICE_LOCATION_TTL_MS = 15 * 60 * 1000;

const deviceLocationLabelCache = new Map<string, string>();
let memoryCachedDeviceLocation: Coordinates | null = null;
let deviceLocationCachedAt = 0;
let deviceLocationInFlight: Promise<DeviceLocationResult> | null = null;

export async function getBestAvailableDeviceLocation(): Promise<DeviceLocationResult> {
  const cachedCoordinates = getCachedDeviceLocation();
  if (cachedCoordinates) {
    return {
      coordinates: cachedCoordinates,
      source: 'lastKnown',
    };
  }

  const storedCoordinates = await primeStoredDeviceLocation();
  if (storedCoordinates) {
    return {
      coordinates: storedCoordinates,
      source: 'lastKnown',
    };
  }

  if (deviceLocationInFlight) {
    return deviceLocationInFlight;
  }

  const task = (async (): Promise<DeviceLocationResult> => {
    try {
      const currentPermission = await Location.getForegroundPermissionsAsync();
      const permission =
        currentPermission.status === 'granted'
          ? currentPermission
          : await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        return { coordinates: null, source: 'unavailable' };
      }

      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown?.coords) {
        const coordinates = {
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
        };
        void cacheDeviceLocation(coordinates);
        return {
          coordinates,
          source: 'lastKnown',
        };
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
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
      })
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

export async function resolveDeviceLocationLabel(
  coordinates: Coordinates,
  fallbackLabel?: string | null
) {
  const cacheKey = createCoordinatesCacheKey(coordinates);
  const cached = deviceLocationLabelCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const nextFallbackLabel = fallbackLabel?.trim() || 'Current location';

  try {
    const reverseMatches = await Location.reverseGeocodeAsync({
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    });
    const label = formatResolvedLabel(nextFallbackLabel, reverseMatches[0] ?? null);
    deviceLocationLabelCache.set(cacheKey, label);
    return label;
  } catch {
    return nextFallbackLabel;
  }
}

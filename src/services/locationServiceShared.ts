import * as Location from 'expo-location';
import { Coordinates, MarketArea } from '../types/storefront';

export type DeviceLocationResult = {
  coordinates: Coordinates | null;
  source: 'current' | 'lastKnown' | 'unavailable';
};

export type SearchLocationResult = {
  coordinates: Coordinates | null;
  label: string | null;
  source: 'area' | 'geocode' | 'unavailable';
};

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function calculateDistanceMiles(origin: Coordinates, destination: Coordinates) {
  const earthRadiusMiles = 3958.8;
  const deltaLatitude = toRadians(destination.latitude - origin.latitude);
  const deltaLongitude = toRadians(destination.longitude - origin.longitude);
  const latitudeA = toRadians(origin.latitude);
  const latitudeB = toRadians(destination.latitude);

  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(deltaLongitude / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMiles * c;
}

export function normalizeQuery(value: string) {
  return value.trim().toLowerCase();
}

export function createCoordinatesCacheKey(coordinates: Coordinates) {
  return `${coordinates.latitude.toFixed(3)}:${coordinates.longitude.toFixed(3)}`;
}

export function normalizeName(value?: string | null) {
  return value?.trim().toLowerCase() ?? '';
}

export function isZipQuery(value: string) {
  return /^\d{5}$/.test(value.trim());
}

export function isNewYorkAddress(address?: Location.LocationGeocodedAddress | null) {
  if (!address) {
    return false;
  }

  const region = normalizeName(address.region);
  const country = normalizeName(address.country);
  const isoCountryCode = normalizeName(address.isoCountryCode);

  return (
    region === 'new york' ||
    region === 'ny' ||
    (country === 'united states' && isoCountryCode === 'us' && region.includes('new york'))
  );
}

export function formatResolvedLabel(
  fallbackQuery: string,
  address?: Location.LocationGeocodedAddress | null
) {
  if (!address) {
    return fallbackQuery.trim();
  }

  const city = address.city?.trim();
  const region = address.region?.trim();
  const postalCode = address.postalCode?.trim();

  if (city && postalCode) {
    return `${city}, ${postalCode}`;
  }

  if (city && region) {
    return `${city}, ${region}`;
  }

  if (postalCode && region) {
    return `${postalCode}, ${region}`;
  }

  return city || postalCode || fallbackQuery.trim();
}

export function scoreResolvedAddress(query: string, address?: Location.LocationGeocodedAddress | null) {
  if (!address) {
    return -1;
  }

  let score = 0;
  const normalizedQuery = normalizeQuery(query);
  const city = normalizeName(address.city);
  const region = normalizeName(address.region);
  const postalCode = normalizeName(address.postalCode);

  if (isNewYorkAddress(address)) {
    score += 5;
  }

  if (isZipQuery(query) && postalCode === normalizedQuery) {
    score += 4;
  }

  if (!isZipQuery(query) && city && (city.includes(normalizedQuery) || normalizedQuery.includes(city))) {
    score += 4;
  }

  if (
    normalizedQuery.includes('ny') ||
    normalizedQuery.includes('new york') ||
    region === 'new york' ||
    region === 'ny'
  ) {
    score += 1;
  }

  return score;
}

export function findAreaByQuery(areas: MarketArea[], query: string): MarketArea | null {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) {
    return null;
  }

  return (
    areas.find((area) => {
      const values = [area.label, area.subtitle].map((entry) => normalizeQuery(entry));
      return values.some((entry) => entry.includes(normalizedQuery) || normalizedQuery.includes(entry));
    }) ?? null
  );
}

export function findNearestArea(areas: MarketArea[], coordinates: Coordinates): MarketArea {
  return areas.reduce((closest, area) => {
    const currentDistance = calculateDistanceMiles(coordinates, area.center);
    const closestDistance = calculateDistanceMiles(coordinates, closest.center);
    return currentDistance < closestDistance ? area : closest;
  }, areas[0]);
}

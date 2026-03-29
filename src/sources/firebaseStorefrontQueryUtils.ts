import { BrowseSortKey, Coordinates, StorefrontSummary } from '../types/storefront';
import { StorefrontSourceSummaryQuery, StorefrontSummaryPage } from './storefrontSource';

export function getSearchNarrowing(searchQuery?: string) {
  const normalizedQuery = searchQuery?.trim();
  if (!normalizedQuery) {
    return {
      zip: null,
      city: null,
    };
  }

  if (/^\d{5}$/.test(normalizedQuery)) {
    return {
      zip: normalizedQuery,
      city: null,
    };
  }

  if (/^[a-zA-Z.\-'\s]+$/.test(normalizedQuery)) {
    const city = normalizedQuery
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

    return {
      zip: null,
      city: city || null,
    };
  }

  return {
    zip: null,
    city: null,
  };
}

export function applySearch(items: StorefrontSummary[], searchQuery?: string) {
  const queryValue = searchQuery?.trim().toLowerCase();
  if (!queryValue) {
    return items;
  }

  return items.filter((item) => {
    const haystack = [
      item.displayName,
      item.legalName,
      item.addressLine1,
      item.city,
      item.zip,
      item.promotionText ?? '',
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(queryValue);
  });
}

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

export function milesToLatitudeDelta(radiusMiles: number) {
  return radiusMiles / 69;
}

export function milesToLongitudeDelta(radiusMiles: number, latitude: number) {
  const longitudeMiles = Math.max(10, Math.cos(toRadians(latitude)) * 69.172);
  return radiusMiles / longitudeMiles;
}

export function filterByRadius(
  summaries: StorefrontSummary[],
  origin?: Coordinates,
  radiusMiles?: number
) {
  if (!origin || !radiusMiles) {
    return summaries;
  }

  return summaries.filter((summary) => {
    return calculateDistanceMiles(origin, summary.coordinates) <= radiusMiles;
  });
}

export function sortItems(items: StorefrontSummary[], sortKey: BrowseSortKey = 'distance') {
  const sorted = [...items];

  switch (sortKey) {
    case 'rating':
      return sorted.sort((a, b) => b.rating - a.rating);
    case 'reviews':
      return sorted.sort((a, b) => b.reviewCount - a.reviewCount);
    case 'distance':
    default:
      return sorted.sort((a, b) => a.distanceMiles - b.distanceMiles);
  }
}

export function paginate(
  items: StorefrontSummary[],
  query?: StorefrontSourceSummaryQuery
): StorefrontSummaryPage {
  const offset = Math.max(0, query?.offset ?? 0);
  const limit =
    typeof query?.limit === 'number' && Number.isFinite(query.limit)
      ? Math.max(0, query.limit)
      : null;

  return {
    items: limit === null ? items.slice(offset) : items.slice(offset, offset + limit),
    total: items.length,
    limit,
    offset,
  };
}

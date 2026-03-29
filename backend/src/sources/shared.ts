import { Coordinates, StorefrontSummaryApiDocument, StorefrontSummarySortKey } from '../types';
import { StorefrontSummaryPage, StorefrontSummaryQuery } from './types';

export function toRadians(value: number) {
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

export function estimateTravelMinutes(distanceMiles: number) {
  if (distanceMiles <= 0.15) {
    return 2;
  }

  return Math.max(3, Math.round(distanceMiles * 1.6 + 1));
}

export function applyOriginMetrics(
  items: StorefrontSummaryApiDocument[],
  origin?: Coordinates
): StorefrontSummaryApiDocument[] {
  if (!origin) {
    return items;
  }

  return items.map((item) => {
    const distanceMiles = Number(
      calculateDistanceMiles(origin, {
        latitude: item.latitude,
        longitude: item.longitude,
      }).toFixed(1)
    );

    return {
      ...item,
      distanceMiles,
      travelMinutes: estimateTravelMinutes(distanceMiles),
      mapPreviewLabel: `${distanceMiles.toFixed(1)} mi route preview`,
    };
  });
}

export function filterByRadius(
  items: StorefrontSummaryApiDocument[],
  origin?: Coordinates,
  radiusMiles?: number
) {
  if (!origin || !radiusMiles) {
    return items;
  }

  return items.filter((item) => item.distanceMiles <= radiusMiles);
}

export function sortByDistance(items: StorefrontSummaryApiDocument[]) {
  return [...items].sort((a, b) => a.distanceMiles - b.distanceMiles);
}

export function sortSummaries(
  items: StorefrontSummaryApiDocument[],
  sortKey: StorefrontSummarySortKey = 'distance'
) {
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

export function paginateSummaries(
  items: StorefrontSummaryApiDocument[],
  limit?: number,
  offset = 0
): StorefrontSummaryPage {
  const safeOffset = Math.max(0, offset);
  const safeLimit = typeof limit === 'number' && Number.isFinite(limit) ? Math.max(0, limit) : null;

  return {
    items: safeLimit === null ? items.slice(safeOffset) : items.slice(safeOffset, safeOffset + safeLimit),
    total: items.length,
    limit: safeLimit,
    offset: safeOffset,
  };
}

function withDistanceMetrics(
  item: StorefrontSummaryApiDocument,
  distanceMiles: number
): StorefrontSummaryApiDocument {
  const roundedDistanceMiles = Number(distanceMiles.toFixed(1));

  return {
    ...item,
    distanceMiles: roundedDistanceMiles,
    travelMinutes: estimateTravelMinutes(roundedDistanceMiles),
    mapPreviewLabel: `${roundedDistanceMiles.toFixed(1)} mi route preview`,
  };
}

export function milesToLatitudeDelta(radiusMiles: number) {
  return radiusMiles / 69;
}

export function milesToLongitudeDelta(radiusMiles: number, latitude: number) {
  const longitudeMiles = Math.max(10, Math.cos(toRadians(latitude)) * 69.172);
  return radiusMiles / longitudeMiles;
}

export function createSummaryScopeCacheKey(query: StorefrontSummaryQuery) {
  return JSON.stringify({
    areaId: query.areaId ?? '',
    searchQuery: query.searchQuery?.trim().toLowerCase() ?? '',
    origin: query.origin
      ? {
          latitude: Number(query.origin.latitude.toFixed(4)),
          longitude: Number(query.origin.longitude.toFixed(4)),
        }
      : null,
    radiusMiles: query.radiusMiles ?? null,
    sortKey: query.sortKey ?? 'distance',
  });
}

export function createNearbySummaryCacheKey(query: StorefrontSummaryQuery) {
  return JSON.stringify({
    areaId: query.areaId ?? '',
    origin: query.origin
      ? {
          latitude: Number(query.origin.latitude.toFixed(3)),
          longitude: Number(query.origin.longitude.toFixed(3)),
        }
      : null,
    radiusMiles: query.radiusMiles ?? null,
    limit: query.limit ?? null,
  });
}

export function isNearbySummaryQuery(query: StorefrontSummaryQuery) {
  return (
    Boolean(query.origin) &&
    !query.searchQuery?.trim() &&
    (query.sortKey === undefined || query.sortKey === 'distance') &&
    (query.offset ?? 0) === 0 &&
    typeof query.limit === 'number' &&
    query.limit > 0 &&
    typeof query.radiusMiles === 'number' &&
    query.radiusMiles > 0
  );
}

export function selectNearestSummaryPage(
  items: StorefrontSummaryApiDocument[],
  origin: Coordinates,
  radiusMiles: number,
  limit: number
): StorefrontSummaryPage {
  const safeLimit = Math.max(1, limit);
  const nearestItems: StorefrontSummaryApiDocument[] = [];
  let total = 0;

  for (const item of items) {
    const distanceMiles = calculateDistanceMiles(origin, {
      latitude: item.latitude,
      longitude: item.longitude,
    });

    if (distanceMiles > radiusMiles) {
      continue;
    }

    total += 1;
    const candidate = withDistanceMetrics(item, distanceMiles);

    let insertAt = nearestItems.findIndex(
      (current) => current.distanceMiles > candidate.distanceMiles
    );
    if (insertAt === -1) {
      insertAt = nearestItems.length;
    }

    if (insertAt < safeLimit) {
      nearestItems.splice(insertAt, 0, candidate);
      if (nearestItems.length > safeLimit) {
        nearestItems.pop();
      }
    } else if (nearestItems.length < safeLimit) {
      nearestItems.push(candidate);
    }
  }

  return {
    items: nearestItems,
    total,
    limit: safeLimit,
    offset: 0,
  };
}

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

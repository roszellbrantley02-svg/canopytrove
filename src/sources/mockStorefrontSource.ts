import { storefrontSeedRecords } from '../data/storefrontSeedRecords';
import { toStorefrontDetails, toStorefrontSummary } from '../adapters/storefrontAdapter';
import type { BrowseSortKey, Coordinates, StorefrontSummary } from '../types/storefront';
import type { StorefrontRecord } from '../types/storefrontRecord';
import type {
  StorefrontSource,
  StorefrontSourceSummaryQuery,
  StorefrontSummaryPage,
} from './storefrontSource';

const allRecords = [...storefrontSeedRecords];
const recordIndex = new Map(allRecords.map((record) => [record.id, record]));

function cloneRecord(record: StorefrontRecord): StorefrontRecord {
  return {
    ...record,
    coordinates: { ...record.coordinates },
    hours: [...record.hours],
    promotionBadges: [...(record.promotionBadges ?? [])],
    appReviews: record.appReviews.map((review) => ({ ...review, tags: [...review.tags] })),
    photoUrls: [...record.photoUrls],
    amenities: [...record.amenities],
  };
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function calculateDistanceMiles(origin: Coordinates, destination: Coordinates) {
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

function estimateTravelMinutes(distanceMiles: number) {
  if (distanceMiles <= 0.15) {
    return 2;
  }

  return Math.max(3, Math.round(distanceMiles * 1.6 + 1));
}

function withOriginMetrics(items: StorefrontSummary[], origin?: Coordinates) {
  if (!origin) {
    return items;
  }

  return items.map((item) => {
    const distanceMiles = Number(calculateDistanceMiles(origin, item.coordinates).toFixed(1));
    return {
      ...item,
      distanceMiles,
      travelMinutes: estimateTravelMinutes(distanceMiles),
      mapPreviewLabel: `${distanceMiles.toFixed(1)} mi route preview`,
    };
  });
}

function applySearch(items: StorefrontRecord[], searchQuery?: string) {
  const query = searchQuery?.trim().toLowerCase();
  if (!query) {
    return items;
  }

  return items.filter((record) => {
    const haystack = [
      record.displayName,
      record.legalName,
      record.addressLine1,
      record.city,
      record.zip,
      record.promotionText ?? '',
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  });
}

function sortItems(items: StorefrontSummary[], sortKey: BrowseSortKey = 'distance') {
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

function paginate(
  items: StorefrontSummary[],
  query?: StorefrontSourceSummaryQuery,
): StorefrontSummaryPage {
  const offset = Math.max(0, query?.offset ?? 0);
  const limit = query?.limit ?? null;
  const pagedItems = limit === null ? items.slice(offset) : items.slice(offset, offset + limit);

  return {
    items: pagedItems,
    total: items.length,
    limit,
    offset,
  };
}

function buildSummaryList(query?: StorefrontSourceSummaryQuery) {
  const areaId = query?.areaId;
  const origin = query?.origin;
  const radiusMiles = query?.radiusMiles;

  const filtered = applySearch(allRecords, query?.searchQuery)
    .filter((record) => (areaId ? record.marketId === areaId : true))
    .filter((record) => {
      if (!origin || !radiusMiles) {
        return true;
      }

      return calculateDistanceMiles(origin, record.coordinates) <= radiusMiles;
    })
    .map((record) => toStorefrontSummary(cloneRecord(record)));

  return sortItems(withOriginMetrics(filtered, origin), query?.sortKey);
}

export const mockStorefrontSource: StorefrontSource = {
  async getAllSummaries() {
    return allRecords.map((record) => toStorefrontSummary(cloneRecord(record)));
  },

  async getSummariesByIds(storefrontIds) {
    return storefrontIds
      .map((id) => recordIndex.get(id))
      .filter((record): record is StorefrontRecord => Boolean(record))
      .map((record) => toStorefrontSummary(cloneRecord(record)));
  },

  async getSummaryPage(query) {
    return paginate(buildSummaryList(query), query);
  },

  async getSummaries(query) {
    return (await this.getSummaryPage(query)).items;
  },

  async getDetailsById(storefrontId) {
    const record = recordIndex.get(storefrontId);
    return record ? toStorefrontDetails(cloneRecord(record)) : null;
  },
};

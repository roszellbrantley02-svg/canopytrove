import { storefrontSource } from '../sources';
import { StorefrontSummaryPage } from '../sources/storefrontSource';
import {
  BrowseSortKey,
  Coordinates,
  StorefrontListQuery,
  StorefrontSummary,
} from '../types/storefront';
import { applyStorefrontPromotionOverrides } from '../services/storefrontPromotionOverrideService';
import { sortSummariesByPriorityPlacement } from '../utils/ownerPromotionPlacement';

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

export function withQueryMetrics(items: StorefrontSummary[], origin: Coordinates) {
  return items.map((item) => {
    const distanceMiles = Number(calculateDistanceMiles(origin, item.coordinates).toFixed(1));
    const travelMinutes = estimateTravelMinutes(distanceMiles);

    return {
      ...item,
      distanceMiles,
      travelMinutes,
      mapPreviewLabel: `${distanceMiles.toFixed(1)} mi route preview`,
    };
  });
}

export function filterByRadius(items: StorefrontSummary[], radiusMiles: number) {
  return items.filter((item) => item.distanceMiles <= radiusMiles);
}

export function dedupeById(items: StorefrontSummary[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }

    seen.add(item.id);
    return true;
  });
}

export function sortByRequestedIdOrder(items: StorefrontSummary[], storefrontIds: string[]) {
  const idOrder = new Map(storefrontIds.map((id, index) => [id, index]));

  return [...items].sort((left, right) => {
    const leftIndex = idOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = idOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex;
  });
}

export function sortBrowseResults(items: StorefrontSummary[], sortKey: BrowseSortKey) {
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

export function filterHotDeals(items: StorefrontSummary[], hotDealsOnly?: boolean) {
  if (!hotDealsOnly) {
    return items;
  }

  return items.filter((item) => Boolean(item.promotionText?.trim()));
}

export function matchesSearchQuery(item: StorefrontSummary, searchQuery: string) {
  const searchValue = searchQuery.trim().toLowerCase();
  if (!searchValue) {
    return true;
  }

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

  return haystack.includes(searchValue);
}

export function paginateItems(items: StorefrontSummary[], limit: number, offset = 0): StorefrontSummaryPage {
  const safeOffset = Math.max(0, offset);
  const safeLimit = Math.max(0, limit);

  return {
    items: items.slice(safeOffset, safeOffset + safeLimit),
    total: items.length,
    limit: safeLimit,
    offset: safeOffset,
  };
}

export function normalizeBrowseAreaId(areaId?: string) {
  const normalizedAreaId = areaId?.trim().toLowerCase();
  if (!normalizedAreaId || normalizedAreaId === 'all' || normalizedAreaId === 'nearby') {
    return undefined;
  }

  return areaId;
}

export function filterByArea(items: StorefrontSummary[], areaId?: string) {
  if (!areaId) {
    return items;
  }

  return items.filter((item) => item.marketId === areaId);
}

export async function getAllBrowseCandidates(
  query: StorefrontListQuery,
  sortKey: BrowseSortKey
) {
  const normalizedAreaId = normalizeBrowseAreaId(query.areaId);
  const allSummaries = withQueryMetrics(
    await applyStorefrontPromotionOverrides(await storefrontSource.getAllSummaries()),
    query.origin
  );

  return sortSummariesByPriorityPlacement(
    sortBrowseResults(
      dedupeById(
        filterHotDeals(
          filterByArea(allSummaries, normalizedAreaId).filter((item) =>
            matchesSearchQuery(item, query.searchQuery)
          ),
          query.hotDealsOnly
        )
      ),
      sortKey
    ),
    {
      surface: query.hotDealsOnly ? 'hot_deals' : 'browse',
      areaId: query.areaId,
    }
  );
}

async function getScopedPage(
  query: StorefrontListQuery,
  radiusMiles: number,
  sortKey: BrowseSortKey,
  limit: number,
  offset = 0
) {
  return storefrontSource.getSummaryPage({
    areaId: normalizeBrowseAreaId(query.areaId),
    searchQuery: query.searchQuery,
    origin: query.origin,
    radiusMiles,
    sortKey,
    limit,
    offset,
    prioritySurface: query.hotDealsOnly ? 'hot_deals' : 'browse',
  });
}

export async function getOriginDrivenPage(
  query: StorefrontListQuery,
  radiusMiles: number,
  sortKey: BrowseSortKey,
  limit: number,
  offset = 0,
  minimumCount = limit
) {
  const scopedPage = await getScopedPage(query, radiusMiles, sortKey, limit, offset);
  if ((!query.hotDealsOnly && scopedPage.total >= minimumCount) || !query.areaId) {
    if (!query.hotDealsOnly) {
      return scopedPage;
    }

    const filteredItems = filterHotDeals(scopedPage.items, true);
    return {
      ...scopedPage,
      items: filteredItems,
      total: filteredItems.length,
    };
  }

  if (query.hotDealsOnly) {
    const allSummaries = withQueryMetrics(
      await applyStorefrontPromotionOverrides(await storefrontSource.getAllSummaries()),
      query.origin
    );
    const filteredItems = sortBrowseResults(
      dedupeById(
        filterHotDeals(
          filterByRadius(
            allSummaries.filter((item) => matchesSearchQuery(item, query.searchQuery)),
            radiusMiles
          ),
          true
        )
      ),
      sortKey
    );

    return paginateItems(filteredItems, limit, offset);
  }

  if (scopedPage.total >= minimumCount || !query.areaId) {
    return scopedPage;
  }

  const originPage = await storefrontSource.getSummaryPage({
    searchQuery: query.searchQuery,
    origin: query.origin,
    radiusMiles,
    sortKey,
    limit,
    offset,
  });
  if (originPage.total > 0) {
    return originPage;
  }

  const hasStorefrontSearch = Boolean(query.searchQuery.trim());
  if (hasStorefrontSearch) {
    const statewideSearchPage = await storefrontSource.getSummaryPage({
      searchQuery: query.searchQuery,
      origin: query.origin,
      sortKey,
      limit,
      offset,
    });

    if (statewideSearchPage.total > 0) {
      return statewideSearchPage;
    }
  }

  const allSummaries = withQueryMetrics(
    (await applyStorefrontPromotionOverrides(await storefrontSource.getAllSummaries())).filter((item) =>
      matchesSearchQuery(item, query.searchQuery)
    ),
    query.origin
  );
  const items = sortBrowseResults(
    dedupeById(filterHotDeals(filterByRadius(allSummaries, radiusMiles), query.hotDealsOnly)),
    sortKey
  );

  return paginateItems(items, limit, offset);
}

export async function getBrowsePage(
  query: StorefrontListQuery,
  sortKey: BrowseSortKey,
  limit: number,
  offset = 0
) {
  if (query.hotDealsOnly) {
    return paginateItems(await getAllBrowseCandidates(query, sortKey), limit, offset);
  }

  const normalizedAreaId = normalizeBrowseAreaId(query.areaId);
  const page = await storefrontSource.getSummaryPage({
    areaId: normalizedAreaId,
    searchQuery: query.searchQuery,
    origin: query.origin,
    sortKey,
    limit,
    offset,
    prioritySurface: query.hotDealsOnly ? 'hot_deals' : 'browse',
  });

  if (page.total > 0 || offset > 0) {
    return page;
  }

  return paginateItems(
    await getAllBrowseCandidates(
      {
        ...query,
        hotDealsOnly: false,
      },
      sortKey
    ),
    limit,
    offset
  );
}

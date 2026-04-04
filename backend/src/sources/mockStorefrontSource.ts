import {
  mockStorefrontDetailDocuments,
  mockStorefrontSummaryDocuments,
} from '../../../src/data/mockFirestoreSeed';
import { StorefrontDetailApiDocument, StorefrontSummaryApiDocument } from '../types';
import {
  applyOriginMetrics,
  createNearbySummaryCacheKey,
  createSummaryScopeCacheKey,
  filterByRadius,
  isNearbySummaryQuery,
  paginateSummaries,
  selectNearestSummaryPage,
  sortSummaries,
} from './shared';
import { StorefrontBackendSource } from './types';

const allSummaries = Object.entries(mockStorefrontSummaryDocuments).map(([id, document]) => ({
  id,
  ...document,
}));

const detailById = new Map(
  Object.entries(mockStorefrontDetailDocuments).map(([id, document]) => [
    id,
    { storefrontId: id, ...document },
  ]),
);
const SCOPED_SUMMARY_TTL_MS = 20_000;
const NEARBY_SUMMARY_TTL_MS = 90_000;
const scopedSummaryCache = new Map<
  string,
  { expiresAt: number; items: StorefrontSummaryApiDocument[] }
>();
const scopedSummaryInFlight = new Map<string, Promise<StorefrontSummaryApiDocument[]>>();
const nearbySummaryCache = new Map<
  string,
  { expiresAt: number; page: ReturnType<typeof selectNearestSummaryPage> }
>();
const nearbySummaryInFlight = new Map<
  string,
  Promise<ReturnType<typeof selectNearestSummaryPage>>
>();

export function clearMockStorefrontSourceCache() {
  scopedSummaryCache.clear();
  scopedSummaryInFlight.clear();
  nearbySummaryCache.clear();
  nearbySummaryInFlight.clear();
}

function applySearch(items: StorefrontSummaryApiDocument[], searchQuery?: string) {
  const query = searchQuery?.trim().toLowerCase();
  if (!query) {
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

    return haystack.includes(query);
  });
}

async function getScopedSummaries(query: Parameters<StorefrontBackendSource['getSummaryPage']>[0]) {
  const cacheKey = createSummaryScopeCacheKey(query);
  const cached = scopedSummaryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.items;
  }

  const pending = scopedSummaryInFlight.get(cacheKey);
  if (pending) {
    return pending;
  }

  const task = (async () => {
    const scoped = query.areaId
      ? allSummaries.filter((item) => item.marketId === query.areaId)
      : allSummaries;

    const items = sortSummaries(
      filterByRadius(
        applyOriginMetrics(applySearch(scoped, query.searchQuery), query.origin),
        query.origin,
        query.radiusMiles,
      ),
      query.sortKey,
    );

    scopedSummaryCache.set(cacheKey, {
      items,
      expiresAt: Date.now() + SCOPED_SUMMARY_TTL_MS,
    });
    return items;
  })();

  scopedSummaryInFlight.set(cacheKey, task);

  try {
    return await task;
  } finally {
    scopedSummaryInFlight.delete(cacheKey);
  }
}

async function getNearbySummaryPage(
  query: Parameters<StorefrontBackendSource['getSummaryPage']>[0],
) {
  const cacheKey = createNearbySummaryCacheKey(query);
  const cached = nearbySummaryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.page;
  }

  const pending = nearbySummaryInFlight.get(cacheKey);
  if (pending) {
    return pending;
  }

  const task = (async () => {
    const scoped = query.areaId
      ? allSummaries.filter((item) => item.marketId === query.areaId)
      : allSummaries;
    const page = selectNearestSummaryPage(scoped, query.origin!, query.radiusMiles!, query.limit!);

    nearbySummaryCache.set(cacheKey, {
      page,
      expiresAt: Date.now() + NEARBY_SUMMARY_TTL_MS,
    });

    return page;
  })();

  nearbySummaryInFlight.set(cacheKey, task);

  try {
    return await task;
  } finally {
    nearbySummaryInFlight.delete(cacheKey);
  }
}

export const mockStorefrontSource: StorefrontBackendSource = {
  async getAllSummaries() {
    return allSummaries;
  },

  async getSummariesByIds(ids) {
    const idSet = new Set(ids);
    return allSummaries.filter((item) => idSet.has(item.id));
  },

  async getSummaryPage(query) {
    if (isNearbySummaryQuery(query)) {
      return getNearbySummaryPage(query);
    }

    return paginateSummaries(await getScopedSummaries(query), query.limit, query.offset);
  },

  async getSummaries(query) {
    return (await this.getSummaryPage(query)).items;
  },

  async getDetailsById(storefrontId) {
    return (detailById.get(storefrontId) as StorefrontDetailApiDocument | undefined) ?? null;
  },
};

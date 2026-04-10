import { storefrontSource } from '../sources';
import type { BrowseSortKey, BrowseSummaryResult, StorefrontListQuery } from '../types/storefront';
import {
  browseSummariesCache,
  browseSummariesInFlight,
  createBrowseKey,
  createNearbyKey,
  createSavedKey,
  nearbySummariesCache,
  nearbySummariesInFlight,
  NEARBY_RADIUS_MILES,
  primeSharedSummaryPool,
  resolveWithCache,
  savedSummariesCache,
  savedSummariesInFlight,
} from './storefrontRepositoryCache';
import {
  dedupeById,
  getBrowsePage,
  sortByRequestedIdOrder,
} from './storefrontRepositorySummaryUtils';
import { applyStorefrontPromotionOverrides } from '../services/storefrontPromotionOverrideService';

export async function getSavedSummaries(storefrontIds: string[]) {
  if (!storefrontIds.length) {
    return [];
  }

  const key = createSavedKey(storefrontIds);

  return applyStorefrontPromotionOverrides(
    await resolveWithCache(key, savedSummariesCache, savedSummariesInFlight, async () => {
      const savedSummaries = await storefrontSource.getSummariesByIds(storefrontIds);
      return sortByRequestedIdOrder(dedupeById(savedSummaries), storefrontIds);
    }),
  );
}

export async function getNearbySummaries(query: StorefrontListQuery) {
  const key = createNearbyKey(query);

  const items = await resolveWithCache(
    key,
    nearbySummariesCache,
    nearbySummariesInFlight,
    async () => {
      const nearbyPage = await storefrontSource.getSummaryPage({
        searchQuery: '',
        origin: query.origin,
        radiusMiles: NEARBY_RADIUS_MILES,
        sortKey: 'distance',
        limit: 3,
        offset: 0,
        prioritySurface: 'nearby',
      });

      if (nearbyPage.total >= 3 || nearbyPage.items.length === 0) {
        return nearbyPage.items;
      }

      return (
        await storefrontSource.getSummaryPage({
          searchQuery: '',
          origin: query.origin,
          radiusMiles: NEARBY_RADIUS_MILES,
          sortKey: 'distance',
          limit: 3,
          offset: 0,
          prioritySurface: 'nearby',
        })
      ).items;
    },
  );

  // Prime shared pool so Browse/Hot Deals can show data immediately
  primeSharedSummaryPool(items);

  return applyStorefrontPromotionOverrides(items);
}

export async function getBrowseSummaries(
  query: StorefrontListQuery,
  sortKey: BrowseSortKey = 'distance',
  limit = 4,
  offset = 0,
): Promise<BrowseSummaryResult> {
  const key = createBrowseKey(query, sortKey, limit, offset);

  const result = await resolveWithCache(
    key,
    browseSummariesCache,
    browseSummariesInFlight,
    async () => {
      const page = await getBrowsePage(query, sortKey, limit, offset);

      return {
        items: page.items,
        total: page.total,
        limit,
        offset,
        hasMore: page.offset + page.items.length < page.total,
      };
    },
  );

  const enhancedItems = await applyStorefrontPromotionOverrides(result.items);

  // Prime shared pool so other tabs can show data immediately
  primeSharedSummaryPool(enhancedItems);

  return {
    ...result,
    items: enhancedItems,
  };
}

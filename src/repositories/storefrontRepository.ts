import type { BrowseSortKey, StorefrontDetails, StorefrontListQuery } from '../types/storefront';
import { clearStorefrontRepositoryCacheEntries } from './storefrontRepositoryCache';
import {
  getBrowseSummaries,
  getNearbySummaries,
  getSavedSummaries,
} from './storefrontRepositorySummaries';
import {
  getCachedStorefrontDetails,
  getStorefrontDetails,
  invalidateStorefrontDetails,
  prefetchStorefrontDetails,
  prefetchStorefrontDetailsBatch,
  primeStorefrontDetails,
  subscribeToCachedStorefrontDetails,
} from './storefrontRepositoryDetails';

export function clearStorefrontRepositoryCache() {
  clearStorefrontRepositoryCacheEntries();
}

export const storefrontRepository = {
  getSavedSummaries,
  getNearbySummaries,
  getBrowseSummaries,
  async prefetchBrowseSummaries(
    query: StorefrontListQuery,
    sortKey: BrowseSortKey = 'distance',
    limit = 4,
    offset = 0,
  ) {
    await getBrowseSummaries(query, sortKey, limit, offset);
  },
  prefetchStorefrontDetails,
  prefetchStorefrontDetailsBatch,
  getStorefrontDetails,
  getCachedStorefrontDetails,
  subscribeToCachedStorefrontDetails,
  primeStorefrontDetails(storefrontId: string, detail: StorefrontDetails | null) {
    primeStorefrontDetails(storefrontId, detail);
  },
  invalidateStorefrontDetails,
};

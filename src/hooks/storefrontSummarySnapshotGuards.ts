import type {
  BrowseSummaryResult,
  StorefrontListQuery,
  StorefrontSummary,
} from '../types/storefront';

export function shouldPersistBrowseSnapshot(
  query: StorefrontListQuery,
  result: BrowseSummaryResult,
) {
  if (result.items.length > 0) {
    return true;
  }

  const normalizedAreaId = query.areaId?.trim().toLowerCase();
  return Boolean(
    query.searchQuery.trim() ||
    query.hotDealsOnly ||
    (normalizedAreaId && normalizedAreaId !== 'all' && normalizedAreaId !== 'nearby'),
  );
}

export function shouldKeepCachedBrowseResults(
  query: StorefrontListQuery,
  cached: BrowseSummaryResult | null,
  result: BrowseSummaryResult,
) {
  return (
    !shouldPersistBrowseSnapshot(query, result) &&
    Boolean(cached?.items.length) &&
    result.items.length === 0
  );
}

export function shouldPersistNearbySnapshot(summaries: StorefrontSummary[]) {
  return summaries.length > 0;
}

export function shouldKeepWarmNearbyResults(
  cached: StorefrontSummary[] | null,
  fallback: StorefrontSummary[] | null,
  nextData: StorefrontSummary[],
) {
  return nextData.length === 0 && Boolean(cached?.length || fallback?.length);
}

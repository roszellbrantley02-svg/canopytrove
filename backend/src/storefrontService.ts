import { backendStorefrontSource } from './sources';
import { Coordinates, StorefrontSummarySortKey } from './types';
import type { OwnerPromotionPlacementSurface } from '../../src/types/ownerPortal';
import { sortSummariesByPriorityPlacement } from '../../src/utils/ownerPromotionPlacement';
import {
  getCachedStorefrontDetail,
  getCachedStorefrontSummariesByIds,
  getCachedStorefrontSummaryPage,
  invalidateCachedStorefrontDetail,
} from './services/storefrontCacheService';
import {
  backfillGooglePlaceIdsForSummaries,
  getCachedGooglePlacesEnrichment,
  getGooglePlacesEnrichment,
  hasInFlightGooglePlacesEnrichment,
  hasGooglePlacesConfig,
  prewarmGooglePlacesEnrichmentForSummaries,
} from './services/googlePlacesService';
import { hasStorefrontOwnerClaim } from './services/ownerClaimPresenceService';
import {
  applyOwnerWorkspaceDetailEnhancements,
  applyOwnerWorkspaceSummaryEnhancements,
} from './services/ownerPortalWorkspaceService';
import { listStorefrontAppReviews } from './services/storefrontCommunityService';

function hasMeaningfulHours(hours: string[]) {
  return hours.some((entry) => !/hours not published yet/i.test(entry));
}

function normalizeDetailString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function paginateSummaryItems<T>(items: T[], limit?: number, offset = 0) {
  const safeOffset = Math.max(0, offset);
  const safeLimit =
    typeof limit === 'number' && Number.isFinite(limit) ? Math.max(0, limit) : null;

  return {
    items:
      safeLimit === null
        ? items.slice(safeOffset)
        : items.slice(safeOffset, safeOffset + safeLimit),
    total: items.length,
    limit: safeLimit,
    offset: safeOffset,
  };
}

export async function getStorefrontSummaries(query: {
  areaId?: string;
  searchQuery?: string;
  origin?: Coordinates;
  radiusMiles?: number;
  sortKey?: StorefrontSummarySortKey;
  limit?: number;
  offset?: number;
  prioritySurface?: OwnerPromotionPlacementSurface;
}) {
  const prioritySurface = query.prioritySurface;
  const baseQuery = {
    areaId: query.areaId,
    searchQuery: query.searchQuery,
    origin: query.origin,
    radiusMiles: query.radiusMiles,
    sortKey: query.sortKey,
    limit: query.limit,
    offset: query.offset,
  };

  const payload = prioritySurface
    ? await (async () => {
        const fullQuery = {
          ...baseQuery,
          limit: undefined,
          offset: undefined,
        };
        const fullPayload = await getCachedStorefrontSummaryPage(fullQuery, () =>
          backendStorefrontSource.getSummaryPage(fullQuery)
        );
        const enhancedItems = await Promise.all(
          fullPayload.items.map((item) => applyOwnerWorkspaceSummaryEnhancements(item))
        );
        const rankedItems = sortSummariesByPriorityPlacement(enhancedItems, {
          surface: prioritySurface,
          areaId: query.areaId,
        });
        return paginateSummaryItems(rankedItems, query.limit, query.offset ?? 0);
      })()
    : await (async () => {
        const basePayload = await getCachedStorefrontSummaryPage(baseQuery, () =>
          backendStorefrontSource.getSummaryPage(baseQuery)
        );

        return {
          ...basePayload,
          items: await Promise.all(
            basePayload.items.map((item) => applyOwnerWorkspaceSummaryEnhancements(item))
          ),
        };
      })();

  backfillGooglePlaceIdsForSummaries(payload.items, 8);

  const offset = query.offset ?? 0;
  const limit = query.limit ?? payload.items.length;
  if (offset === 0 && limit <= 4) {
    prewarmGooglePlacesEnrichmentForSummaries(payload.items, Math.min(limit, 3));
  }

  return {
    ...payload,
  };
}

export async function getStorefrontSummariesByIds(ids: string[]) {
  return Promise.all(
    (
      await getCachedStorefrontSummariesByIds(ids, () => backendStorefrontSource.getSummariesByIds(ids))
    ).map((item) => applyOwnerWorkspaceSummaryEnhancements(item))
  );
}

export async function getStorefrontDetail(storefrontId: string) {
  const summary = await backendStorefrontSource
    .getSummariesByIds([storefrontId])
    .then((items) => items[0] ?? null);
  const cachedGoogleEnrichment = summary
    ? getCachedGooglePlacesEnrichment(summary.id)
    : null;
  const shouldAwaitGoogleEnrichment = Boolean(
    summary &&
      hasGooglePlacesConfig() &&
      (cachedGoogleEnrichment || summary.placeId?.trim() || hasInFlightGooglePlacesEnrichment(summary.id))
  );

  const loadDetail = async (googleEnrichmentMode: 'await' | 'background') => {
    const [baseDetail, appReviews, googleEnrichment, hasOwnerClaim] = await Promise.all([
      backendStorefrontSource.getDetailsById(storefrontId),
      listStorefrontAppReviews(storefrontId),
      googleEnrichmentMode === 'await'
        ? Promise.resolve(cachedGoogleEnrichment).then((value) => value ?? (summary ? getGooglePlacesEnrichment(summary) : null))
        : Promise.resolve(cachedGoogleEnrichment),
      hasStorefrontOwnerClaim(storefrontId),
    ]);
    if (!baseDetail) {
      return null;
    }

    if (googleEnrichmentMode === 'background' && summary && hasGooglePlacesConfig()) {
      void getGooglePlacesEnrichment(summary).finally(() => {
        invalidateCachedStorefrontDetail(storefrontId);
      });
    }

    const detail = {
      ...baseDetail,
      phone: normalizeDetailString(baseDetail.phone) ?? normalizeDetailString(googleEnrichment?.phone) ?? null,
      website:
        normalizeDetailString(baseDetail.website) ??
        normalizeDetailString(googleEnrichment?.website) ??
        null,
      hours: hasMeaningfulHours(baseDetail.hours)
        ? baseDetail.hours
        : googleEnrichment?.hours?.length
          ? googleEnrichment.hours
          : [],
      openNow:
        typeof baseDetail.openNow === 'boolean'
          ? baseDetail.openNow
          : typeof googleEnrichment?.openNow === 'boolean'
            ? googleEnrichment.openNow
            : null,
      hasOwnerClaim,
      appReviewCount: appReviews.length,
      appReviews,
    };

    return applyOwnerWorkspaceDetailEnhancements(detail);
  };

  if (summary && hasGooglePlacesConfig() && !shouldAwaitGoogleEnrichment) {
    return loadDetail('background');
  }

  return getCachedStorefrontDetail(storefrontId, async () => {
    const detail = await loadDetail(shouldAwaitGoogleEnrichment ? 'await' : 'background');
    if (!detail || !hasGooglePlacesConfig()) {
      return detail;
    }

    return detail;
  }, shouldAwaitGoogleEnrichment ? undefined : 500);
}

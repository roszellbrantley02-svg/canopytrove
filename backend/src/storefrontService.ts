import { backendStorefrontSource } from './sources';
import {
  Coordinates,
  StorefrontDetailApiDocument,
  StorefrontSummaryApiDocument,
  StorefrontSummarySortKey,
} from './types';
import type { OwnerPromotionPlacementSurface } from '../../src/types/ownerPortal';
import { sortSummariesByPriorityPlacement } from '../../src/utils/ownerPromotionPlacement';
import { resolveStorefrontOpenNow } from '../../src/utils/storefrontOperationalStatus';
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

const SUMMARY_GOOGLE_ENRICHMENT_TIMEOUT_MS = 1_500;
const DETAIL_BASE_TIMEOUT_MS = 2_500;
const DETAIL_QUERY_TIMEOUT_MS = 1_500;
const DETAIL_ENHANCEMENT_TIMEOUT_MS = 1_500;

class StorefrontDataUnavailableError extends Error {
  readonly statusCode = 503;

  constructor(message: string) {
    super(message);
    this.name = 'StorefrontDataUnavailableError';
  }
}

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

async function withTimeoutFallback<T>(promise: Promise<T>, fallbackValue: T, timeoutMs: number) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => {
      resolve(fallbackValue);
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } catch {
    return fallbackValue;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
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

function stripMemberOnlySummaryPromotionFields(summary: StorefrontSummaryApiDocument) {
  return {
    ...summary,
    promotionText: summary.promotionText,
    promotionBadges: summary.promotionBadges,
    promotionExpiresAt: summary.promotionExpiresAt,
    activePromotionId: summary.activePromotionId,
    activePromotionCount: summary.activePromotionCount ?? 0,
    promotionPlacementSurfaces: [],
    promotionPlacementScope: null,
    thumbnailUrl: null,
  } satisfies StorefrontSummaryApiDocument;
}

function stripMemberOnlyDetailPromotionFields(detail: StorefrontDetailApiDocument) {
  const visiblePhotoUrls = detail.photoUrls.slice(0, 2);

  return {
    ...detail,
    activePromotions: [],
    photoCount: detail.photoUrls.length,
    photoUrls: visiblePhotoUrls,
    appReviews: detail.appReviews.map((review) => ({
      ...review,
      photoUrls: [],
    })),
  } satisfies StorefrontDetailApiDocument;
}

async function enhanceSummary(
  summary: StorefrontSummaryApiDocument,
  includeMemberDeals: boolean
) {
  const enhanced = await applyOwnerWorkspaceSummaryEnhancements(summary);
  const googleEnrichment = hasGooglePlacesConfig()
    ? await withTimeoutFallback(
        getGooglePlacesEnrichment(enhanced),
        getCachedGooglePlacesEnrichment(enhanced.id),
        SUMMARY_GOOGLE_ENRICHMENT_TIMEOUT_MS
      )
    : null;
  const runtimeEnhanced = googleEnrichment
    ? {
        ...enhanced,
        openNow:
          typeof googleEnrichment.openNow === 'boolean'
            ? googleEnrichment.openNow
            : enhanced.openNow,
        menuUrl: enhanced.menuUrl ?? normalizeDetailString(googleEnrichment.website) ?? null,
      }
    : enhanced;

  return includeMemberDeals
    ? runtimeEnhanced
    : stripMemberOnlySummaryPromotionFields(runtimeEnhanced);
}

async function enhanceDetail(
  detail: StorefrontDetailApiDocument,
  includeMemberDeals: boolean
) {
  const enhanced = await applyOwnerWorkspaceDetailEnhancements(detail);
  return includeMemberDeals
    ? enhanced
    : stripMemberOnlyDetailPromotionFields(enhanced);
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
}, options?: {
  includeMemberDeals?: boolean;
}) {
  const includeMemberDeals = options?.includeMemberDeals === true;
  const prioritySurface = includeMemberDeals ? query.prioritySurface : undefined;
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
        const enhancedResults = await Promise.allSettled(
          fullPayload.items.map((item) => enhanceSummary(item, includeMemberDeals))
        );
        const enhancedItems = enhancedResults
          .filter((r): r is PromiseFulfilledResult<typeof fullPayload.items[number]> => r.status === 'fulfilled')
          .map((r) => r.value);
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
          items: (await Promise.allSettled(
            basePayload.items.map((item) => enhanceSummary(item, includeMemberDeals))
          ))
            .filter((r): r is PromiseFulfilledResult<typeof basePayload.items[number]> => r.status === 'fulfilled')
            .map((r) => r.value),
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

export async function getStorefrontSummariesByIds(ids: string[], options?: {
  includeMemberDeals?: boolean;
}) {
  const includeMemberDeals = options?.includeMemberDeals === true;
  const cached = await getCachedStorefrontSummariesByIds(ids, () =>
    backendStorefrontSource.getSummariesByIds(ids)
  );
  const enhancedResults = await Promise.allSettled(
    cached.map((item) => enhanceSummary(item, includeMemberDeals))
  );
  return enhancedResults
    .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof enhanceSummary>>> => r.status === 'fulfilled')
    .map((r) => r.value);
}

export async function getStorefrontDetail(storefrontId: string, options?: {
  includeMemberDeals?: boolean;
}) {
  const includeMemberDeals = options?.includeMemberDeals === true;
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
    const [resolvedBaseDetail, appReviews, googleEnrichment, hasOwnerClaim] = await Promise.all([
      withTimeoutFallback(
        backendStorefrontSource.getDetailsById(storefrontId),
        null,
        DETAIL_BASE_TIMEOUT_MS
      ),
      withTimeoutFallback(listStorefrontAppReviews(storefrontId), [], DETAIL_QUERY_TIMEOUT_MS),
      googleEnrichmentMode === 'await'
        ? withTimeoutFallback(
            Promise.resolve(cachedGoogleEnrichment).then(
              (value) => value ?? (summary ? getGooglePlacesEnrichment(summary) : null)
            ),
            cachedGoogleEnrichment,
            DETAIL_QUERY_TIMEOUT_MS
          )
        : Promise.resolve(cachedGoogleEnrichment),
      withTimeoutFallback(hasStorefrontOwnerClaim(storefrontId), false, DETAIL_QUERY_TIMEOUT_MS),
    ]);
    const baseDetail = resolvedBaseDetail;
    if (!baseDetail) {
      if (summary) {
        throw new StorefrontDataUnavailableError(
          `Storefront detail is unavailable for published storefront ${storefrontId}.`
        );
      }

      return null;
    }

    if (googleEnrichmentMode === 'background' && summary && hasGooglePlacesConfig()) {
      void withTimeoutFallback(
        getGooglePlacesEnrichment(summary),
        null,
        DETAIL_BASE_TIMEOUT_MS
      )
        .catch((error) => {
          console.warn(`[storefrontService] background Google enrichment failed for ${storefrontId}:`, error);
        })
        .finally(() => {
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
      openNow: resolveStorefrontOpenNow({
        liveOpenNow: googleEnrichment?.openNow,
        summaryOpenNow: summary?.openNow,
        detailOpenNow: baseDetail.openNow,
      }),
      hasOwnerClaim,
      photoCount: baseDetail.photoUrls.length,
      appReviewCount: appReviews.length,
      appReviews,
    };

    return withTimeoutFallback(
      enhanceDetail(detail, includeMemberDeals),
      includeMemberDeals ? detail : stripMemberOnlyDetailPromotionFields(detail),
      DETAIL_ENHANCEMENT_TIMEOUT_MS
    );
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

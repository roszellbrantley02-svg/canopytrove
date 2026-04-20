import { backendStorefrontSource } from './sources';
import { logger } from './observability/logger';
import {
  Coordinates,
  StorefrontDetailApiDocument,
  StorefrontSummaryApiDocument,
  StorefrontSummarySortKey,
} from './types';
import type { OwnerPromotionPlacementSurface } from './utils/ownerPromotionPlacement';
import { sortSummariesByPriorityPlacement } from './utils/ownerPromotionPlacement';
import {
  resolveStorefrontOpenNow,
  computeOpenNowFromHours,
} from './utils/storefrontOperationalStatus';
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
import type { ViewerContext } from './services/ownerPortalWorkspaceData';
import { listStorefrontAppReviews } from './services/storefrontCommunityService';
import {
  attachOcmVerificationToDetail,
  attachOcmVerificationToSummaries,
} from './services/storefrontOcmEnrichment';
import {
  attachPaymentMethodsToDetail,
  attachPaymentMethodsToSummaries,
} from './services/paymentMethodsService';

const SUMMARY_GOOGLE_ENRICHMENT_TIMEOUT_MS = 1_500;
const SUMMARY_DETAIL_FALLBACK_TIMEOUT_MS = 400;
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

type TimedResolution<T> =
  | { status: 'fulfilled'; value: T }
  | { status: 'timeout' }
  | { status: 'rejected'; error: unknown };

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

async function resolveWithTimeoutStatus<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<TimedResolution<T>> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<TimedResolution<T>>((resolve) => {
    timeoutId = setTimeout(() => {
      resolve({ status: 'timeout' });
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      promise
        .then((value) => ({ status: 'fulfilled', value }) as const)
        .catch((error) => ({ status: 'rejected', error }) as const),
      timeoutPromise,
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function paginateSummaryItems<T>(items: T[], limit?: number, offset = 0) {
  const safeOffset = Math.max(0, offset);
  const safeLimit = typeof limit === 'number' && Number.isFinite(limit) ? Math.max(0, limit) : null;

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
  // Keep the promotion teaser (id, text, badges, count) visible to guests as a
  // discovery hook. Only strip: thumbnailUrl (owner profile media) and
  // placement routing data (internal).
  return {
    ...summary,
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

function stripAndroidSummaryCommerceFields(summary: StorefrontSummaryApiDocument) {
  return {
    ...summary,
    promotionText: null,
    promotionBadges: [],
    promotionExpiresAt: null,
    activePromotionId: null,
    activePromotionCount: 0,
    promotionPlacementSurfaces: [],
    promotionPlacementScope: null,
    ownerFeaturedBadges: [],
    ownerCardSummary: null,
    thumbnailUrl: null,
    menuUrl: null,
    premiumCardVariant: 'standard',
  } satisfies StorefrontSummaryApiDocument;
}

function stripAndroidDetailCommerceFields(detail: StorefrontDetailApiDocument) {
  return {
    ...detail,
    menuUrl: null,
    activePromotions: [],
    photoCount: 0,
    photoUrls: [],
    ownerFeaturedBadges: [],
    editorialSummary: null,
    appReviews: detail.appReviews.map((review) => ({
      ...review,
      photoUrls: [],
    })),
  } satisfies StorefrontDetailApiDocument;
}

function createPublishedStorefrontDetailFallback(input: {
  storefrontId: string;
  summary: StorefrontSummaryApiDocument;
  appReviews: StorefrontDetailApiDocument['appReviews'];
  googleEnrichment?: {
    phone?: string | null;
    website?: string | null;
    hours?: string[];
    openNow?: boolean | null;
  } | null;
  hasOwnerClaim: boolean;
}): StorefrontDetailApiDocument {
  const hours = input.googleEnrichment?.hours?.length ? input.googleEnrichment.hours : [];
  const photoUrls = input.summary.thumbnailUrl ? [input.summary.thumbnailUrl] : [];

  return {
    storefrontId: input.storefrontId,
    phone: normalizeDetailString(input.googleEnrichment?.phone) ?? null,
    website: normalizeDetailString(input.googleEnrichment?.website) ?? null,
    hours,
    openNow: resolveStorefrontOpenNow({
      hours,
      liveOpenNow: input.googleEnrichment?.openNow,
      summaryOpenNow: input.summary.openNow,
      detailOpenNow: null,
    }),
    hasOwnerClaim: input.hasOwnerClaim,
    menuUrl: input.summary.menuUrl ?? null,
    verifiedOwnerBadgeLabel: input.summary.verifiedOwnerBadgeLabel ?? null,
    favoriteFollowerCount: input.summary.favoriteFollowerCount ?? null,
    ownerFeaturedBadges: input.summary.ownerFeaturedBadges ?? [],
    activePromotions: [],
    photoCount: photoUrls.length,
    appReviewCount: input.appReviews.length,
    appReviews: input.appReviews,
    photoUrls,
    amenities: [],
    editorialSummary: input.summary.ownerCardSummary ?? null,
    routeMode: 'verified',
  };
}

async function enhanceSummary(
  summary: StorefrontSummaryApiDocument,
  includeMemberDeals: boolean,
  viewerContext?: ViewerContext,
  clientPlatform?: 'android' | 'ios' | 'web',
) {
  const enhanced = await applyOwnerWorkspaceSummaryEnhancements(summary, viewerContext);
  const fallbackDetailPromise = hasMeaningfulHours(enhanced.hours ?? [])
    ? Promise.resolve(null)
    : withTimeoutFallback(
        getCachedStorefrontDetail(summary.id, () =>
          backendStorefrontSource.getDetailsById(summary.id),
        ),
        null,
        SUMMARY_DETAIL_FALLBACK_TIMEOUT_MS,
      );
  const googleEnrichment = hasGooglePlacesConfig()
    ? await withTimeoutFallback(
        getGooglePlacesEnrichment(enhanced),
        getCachedGooglePlacesEnrichment(enhanced.id),
        SUMMARY_GOOGLE_ENRICHMENT_TIMEOUT_MS,
      )
    : null;
  const fallbackDetail = await fallbackDetailPromise;
  const fallbackDetailHours = hasMeaningfulHours(fallbackDetail?.hours ?? [])
    ? fallbackDetail!.hours
    : null;
  const resolvedHours = hasMeaningfulHours(enhanced.hours ?? [])
    ? enhanced.hours!
    : (fallbackDetailHours ?? (googleEnrichment?.hours?.length ? googleEnrichment.hours : []));
  const runtimeEnhanced: StorefrontSummaryApiDocument = googleEnrichment
    ? {
        ...enhanced,
        // Keep summary cards aligned with detail screens by preferring the
        // same stored owner/detail hours before falling back to Google.
        hours: resolvedHours,
        openNow:
          computeOpenNowFromHours(resolvedHours.length ? resolvedHours : null) ??
          (typeof googleEnrichment.openNow === 'boolean'
            ? googleEnrichment.openNow
            : typeof fallbackDetail?.openNow === 'boolean'
              ? fallbackDetail.openNow
              : enhanced.openNow),
        menuUrl: enhanced.menuUrl ?? normalizeDetailString(googleEnrichment.website) ?? null,
      }
    : {
        ...enhanced,
        hours: resolvedHours,
        openNow:
          computeOpenNowFromHours(resolvedHours.length ? resolvedHours : null) ??
          (typeof fallbackDetail?.openNow === 'boolean'
            ? fallbackDetail.openNow
            : enhanced.openNow),
      };

  let finalResult: StorefrontSummaryApiDocument = includeMemberDeals
    ? runtimeEnhanced
    : stripMemberOnlySummaryPromotionFields(runtimeEnhanced);

  if (clientPlatform === 'android') {
    finalResult = stripAndroidSummaryCommerceFields(finalResult);
  }

  return finalResult;
}

async function enhanceDetail(
  detail: StorefrontDetailApiDocument,
  includeMemberDeals: boolean,
  viewerContext?: ViewerContext,
  clientPlatform?: 'android' | 'ios' | 'web',
) {
  const enhanced = await applyOwnerWorkspaceDetailEnhancements(detail, viewerContext);
  let result = includeMemberDeals ? enhanced : stripMemberOnlyDetailPromotionFields(enhanced);

  if (clientPlatform === 'android') {
    result = stripAndroidDetailCommerceFields(result);
  }

  return result;
}

export async function getStorefrontSummaries(
  query: {
    areaId?: string;
    searchQuery?: string;
    origin?: Coordinates;
    radiusMiles?: number;
    sortKey?: StorefrontSummarySortKey;
    limit?: number;
    offset?: number;
    prioritySurface?: OwnerPromotionPlacementSurface;
  },
  options?: {
    includeMemberDeals?: boolean;
    viewerContext?: ViewerContext;
    clientPlatform?: 'android' | 'ios' | 'web';
  },
) {
  const includeMemberDeals = options?.includeMemberDeals === true;
  const viewerContext = options?.viewerContext;
  const clientPlatform = options?.clientPlatform;
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
          backendStorefrontSource.getSummaryPage(fullQuery),
        );
        const enhancedResults = await Promise.allSettled(
          fullPayload.items.map((item) =>
            enhanceSummary(item, includeMemberDeals, viewerContext, clientPlatform),
          ),
        );
        const enhancedItems = enhancedResults.flatMap((result) =>
          result.status === 'fulfilled' ? [result.value] : [],
        );
        const rankedItems = sortSummariesByPriorityPlacement(enhancedItems, {
          surface: prioritySurface,
          areaId: query.areaId,
        });
        return paginateSummaryItems(rankedItems, query.limit, query.offset ?? 0);
      })()
    : await (async () => {
        const basePayload = await getCachedStorefrontSummaryPage(baseQuery, () =>
          backendStorefrontSource.getSummaryPage(baseQuery),
        );

        return {
          ...basePayload,
          items: (
            await Promise.allSettled(
              basePayload.items.map((item) =>
                enhanceSummary(item, includeMemberDeals, viewerContext, clientPlatform),
              ),
            )
          ).flatMap((result) => (result.status === 'fulfilled' ? [result.value] : [])),
        };
      })();

  backfillGooglePlaceIdsForSummaries(payload.items, 1);

  // Prewarming disabled — enrichment is fetched on-demand when a user
  // taps a storefront. Removing speculative API calls to control costs.
  // const offset = query.offset ?? 0;
  // const limit = query.limit ?? payload.items.length;
  // if (offset === 0 && limit <= 4) {
  //   prewarmGooglePlacesEnrichmentForSummaries(payload.items, Math.min(limit, 3));
  // }

  const itemsWithOcm = await attachOcmVerificationToSummaries(payload.items);
  const itemsWithPayments = await attachPaymentMethodsToSummaries(itemsWithOcm);

  return {
    ...payload,
    items: itemsWithPayments,
  };
}

export async function getStorefrontSummariesByIds(
  ids: string[],
  options?: {
    includeMemberDeals?: boolean;
    viewerContext?: ViewerContext;
    clientPlatform?: 'android' | 'ios' | 'web';
  },
) {
  const includeMemberDeals = options?.includeMemberDeals === true;
  const viewerContext = options?.viewerContext;
  const clientPlatform = options?.clientPlatform;
  const cached = await getCachedStorefrontSummariesByIds(ids, () =>
    backendStorefrontSource.getSummariesByIds(ids),
  );
  const enhancedResults = await Promise.allSettled(
    cached.map((item) => enhanceSummary(item, includeMemberDeals, viewerContext, clientPlatform)),
  );
  const items = enhancedResults.flatMap((result) =>
    result.status === 'fulfilled' ? [result.value] : [],
  );
  const withOcm = await attachOcmVerificationToSummaries(items);
  return attachPaymentMethodsToSummaries(withOcm);
}

export async function resolveStorefrontBySlug(slug: string) {
  const allSummaries = await backendStorefrontSource.getAllSummaries();
  // Exact match first
  const exact = allSummaries.find((s) => s.id === slug);
  if (exact) return exact.id;
  // Prefix match: slug is a prefix of the full ID (e.g. "the-coughie-shop" matches "the-coughie-shop-new-york-10001")
  const prefixMatch = allSummaries.find((s) => s.id.startsWith(slug + '-'));
  if (prefixMatch) return prefixMatch.id;
  return null;
}

export async function getStorefrontDetail(
  storefrontId: string,
  options?: {
    includeMemberDeals?: boolean;
    viewerContext?: ViewerContext;
    clientPlatform?: 'android' | 'ios' | 'web';
  },
) {
  const includeMemberDeals = options?.includeMemberDeals === true;
  const viewerContext = options?.viewerContext;
  const clientPlatform = options?.clientPlatform;
  const summary = await backendStorefrontSource
    .getSummariesByIds([storefrontId])
    .then((items) => items[0] ?? null);
  const cachedGoogleEnrichment = summary ? getCachedGooglePlacesEnrichment(summary.id) : null;
  const shouldAwaitGoogleEnrichment = Boolean(
    summary &&
    hasGooglePlacesConfig() &&
    (cachedGoogleEnrichment ||
      summary.placeId?.trim() ||
      hasInFlightGooglePlacesEnrichment(summary.id)),
  );

  const loadDetail = async (googleEnrichmentMode: 'await' | 'background') => {
    const [baseDetailResult, appReviews, googleEnrichment, hasOwnerClaim] = await Promise.all([
      resolveWithTimeoutStatus(
        backendStorefrontSource.getDetailsById(storefrontId),
        DETAIL_BASE_TIMEOUT_MS,
      ),
      withTimeoutFallback(
        listStorefrontAppReviews(storefrontId, viewerContext?.profileId ?? null),
        [],
        DETAIL_QUERY_TIMEOUT_MS,
      ),
      googleEnrichmentMode === 'await'
        ? withTimeoutFallback(
            Promise.resolve(cachedGoogleEnrichment).then(
              (value) => value ?? (summary ? getGooglePlacesEnrichment(summary) : null),
            ),
            cachedGoogleEnrichment,
            DETAIL_QUERY_TIMEOUT_MS,
          )
        : Promise.resolve(cachedGoogleEnrichment),
      withTimeoutFallback(hasStorefrontOwnerClaim(storefrontId), false, DETAIL_QUERY_TIMEOUT_MS),
    ]);
    let baseDetail = baseDetailResult.status === 'fulfilled' ? baseDetailResult.value : null;
    if (!baseDetail) {
      if (summary) {
        if (baseDetailResult.status === 'fulfilled') {
          throw new StorefrontDataUnavailableError(
            `Storefront detail is unavailable for published storefront ${storefrontId}.`,
          );
        }

        const degradedFrom =
          baseDetailResult.status === 'timeout' ? 'timeout' : 'transient backend error';
        logger.warn(
          `[storefrontService] base detail fetch degraded for ${storefrontId}; serving published fallback from summary after ${degradedFrom}.`,
          baseDetailResult.status === 'rejected'
            ? {
                error:
                  baseDetailResult.error instanceof Error
                    ? baseDetailResult.error.message
                    : String(baseDetailResult.error),
              }
            : undefined,
        );
        baseDetail = createPublishedStorefrontDetailFallback({
          storefrontId,
          summary,
          appReviews,
          googleEnrichment,
          hasOwnerClaim,
        });
      } else {
        return null;
      }
    }

    // DEFENSIVE: Cross-check that we're not serving a hidden storefront detail.
    // If summary is available, verify visibility consistency.
    if (summary && baseDetail) {
      const isSummaryVisible = summary.isVisible !== false;
      if (!isSummaryVisible) {
        logger.warn(
          `[storefrontService] refusing to serve detail for hidden storefront ${storefrontId}`,
        );
        return null;
      }
    }

    if (googleEnrichmentMode === 'background' && summary && hasGooglePlacesConfig()) {
      void withTimeoutFallback(getGooglePlacesEnrichment(summary), null, DETAIL_BASE_TIMEOUT_MS)
        .catch((error) => {
          logger.warn(
            `[storefrontService] background Google enrichment failed for ${storefrontId}`,
            { error: error instanceof Error ? error.message : String(error) },
          );
        })
        .finally(() => {
          invalidateCachedStorefrontDetail(storefrontId);
        });
    }

    const detail = {
      ...baseDetail,
      phone:
        normalizeDetailString(baseDetail.phone) ??
        normalizeDetailString(googleEnrichment?.phone) ??
        null,
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
        hours: hasMeaningfulHours(baseDetail.hours)
          ? baseDetail.hours
          : googleEnrichment?.hours?.length
            ? googleEnrichment.hours
            : [],
        liveOpenNow: googleEnrichment?.openNow,
        summaryOpenNow: summary?.openNow,
        detailOpenNow: baseDetail.openNow,
      }),
      hasOwnerClaim,
      photoCount: baseDetail.photoUrls.length,
      appReviewCount: appReviews.length,
      appReviews,
    };

    const enhancedDetail = await withTimeoutFallback(
      enhanceDetail(detail, includeMemberDeals, viewerContext, clientPlatform),
      clientPlatform === 'android'
        ? stripAndroidDetailCommerceFields(detail)
        : includeMemberDeals
          ? detail
          : stripMemberOnlyDetailPromotionFields(detail),
      DETAIL_ENHANCEMENT_TIMEOUT_MS,
    );
    const withOcm = await attachOcmVerificationToDetail(enhancedDetail, summary);
    return attachPaymentMethodsToDetail(withOcm, summary);
  };

  if (summary && hasGooglePlacesConfig() && !shouldAwaitGoogleEnrichment) {
    return loadDetail('background');
  }

  // Viewer-specific results (member requests) include audience-filtered
  // promotions, so they must not be served from or stored in the shared
  // storefront-level detail cache.  Only anonymous requests are cacheable.
  if (viewerContext) {
    return loadDetail(shouldAwaitGoogleEnrichment ? 'await' : 'background');
  }

  return getCachedStorefrontDetail(
    storefrontId,
    async () => {
      const detail = await loadDetail(shouldAwaitGoogleEnrichment ? 'await' : 'background');
      if (!detail || !hasGooglePlacesConfig()) {
        return detail;
      }

      return detail;
    },
    shouldAwaitGoogleEnrichment ? undefined : 500,
  );
}
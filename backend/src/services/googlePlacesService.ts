import { StorefrontSummaryApiDocument } from '../types';
import { requestGoogleJson } from './googlePlacesClient';
import { matchPlaceId } from './googlePlacesMatching';
import {
  BACKGROUND_CONCURRENCY,
  clearGooglePlacesCaches,
  DETAIL_TTL_MS,
  detailCache,
  detailInFlight,
  googlePlacesCacheLimits,
  GooglePlaceDetailResponse,
  hasGooglePlacesConfig,
  isFresh,
  normalizeHours,
  resolveCached,
  storefrontEnrichmentCache,
  storefrontEnrichmentInFlight,
} from './googlePlacesShared';

export { hasGooglePlacesConfig } from './googlePlacesShared';

async function loadPlaceDetail(placeId: string) {
  return resolveCached(
    placeId,
    detailCache,
    detailInFlight,
    DETAIL_TTL_MS,
    googlePlacesCacheLimits.detail,
    async () => {
      const payload = await requestGoogleJson<GooglePlaceDetailResponse>(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
        {
          method: 'GET',
        },
        'id,websiteUri,nationalPhoneNumber,businessStatus,location,regularOpeningHours.weekdayDescriptions,currentOpeningHours.openNow,currentOpeningHours.weekdayDescriptions',
      );

      if (!payload?.id) {
        return null;
      }

      // Prefer currentOpeningHours (accounts for holidays & special hours)
      // over regularOpeningHours (fixed weekly schedule).
      const currentHours = normalizeHours(payload.currentOpeningHours?.weekdayDescriptions);
      const regularHours = normalizeHours(payload.regularOpeningHours?.weekdayDescriptions);

      return {
        phone: typeof payload.nationalPhoneNumber === 'string' ? payload.nationalPhoneNumber : null,
        website: typeof payload.websiteUri === 'string' ? payload.websiteUri : null,
        hours: currentHours.length > 0 ? currentHours : regularHours,
        openNow:
          typeof payload.currentOpeningHours?.openNow === 'boolean'
            ? payload.currentOpeningHours.openNow
            : null,
        businessStatus: typeof payload.businessStatus === 'string' ? payload.businessStatus : null,
        location:
          typeof payload.location?.latitude === 'number' &&
          typeof payload.location?.longitude === 'number'
            ? {
                latitude: payload.location.latitude,
                longitude: payload.location.longitude,
              }
            : null,
      };
    },
  );
}

async function runBackgroundSummaryTasks(
  summaries: StorefrontSummaryApiDocument[],
  worker: (summary: StorefrontSummaryApiDocument) => Promise<void>,
) {
  const queue = [...summaries];
  const workers = Array.from({ length: Math.min(BACKGROUND_CONCURRENCY, queue.length) }, () =>
    (async () => {
      while (queue.length) {
        const next = queue.shift();
        if (!next) {
          return;
        }

        try {
          await worker(next);
        } catch {
          // Background work should never affect request flow.
        }
      }
    })(),
  );

  await Promise.allSettled(workers);
}

export async function getGooglePlacesEnrichment(summary: StorefrontSummaryApiDocument) {
  const cached = storefrontEnrichmentCache.get(summary.id);
  if (isFresh(cached)) {
    return cached!.value;
  }

  if (cached) {
    storefrontEnrichmentCache.delete(summary.id);
  }

  if (!hasGooglePlacesConfig()) {
    return null;
  }

  return resolveCached(
    summary.id,
    storefrontEnrichmentCache,
    storefrontEnrichmentInFlight,
    DETAIL_TTL_MS,
    googlePlacesCacheLimits.storefrontEnrichment,
    async () => {
      const placeId = await matchPlaceId(summary);
      if (!placeId) {
        return null;
      }
      return loadPlaceDetail(placeId);
    },
  );
}

export function getCachedGooglePlacesEnrichment(storefrontId: string) {
  const cached = storefrontEnrichmentCache.get(storefrontId);
  if (!isFresh(cached)) {
    storefrontEnrichmentCache.delete(storefrontId);
    return null;
  }

  return cached?.value ?? null;
}

export function hasInFlightGooglePlacesEnrichment(storefrontId: string) {
  return storefrontEnrichmentInFlight.has(storefrontId);
}

export function clearGooglePlacesServiceCache() {
  clearGooglePlacesCaches();
}

export function backfillGooglePlaceIdsForSummaries(
  summaries: StorefrontSummaryApiDocument[],
  maxCount = 8,
) {
  if (!hasGooglePlacesConfig()) {
    return;
  }

  const candidates = summaries
    .filter((summary) => !summary.placeId?.trim())
    .slice(0, Math.max(0, maxCount));
  if (!candidates.length) {
    return;
  }

  void runBackgroundSummaryTasks(candidates, async (summary) => {
    await matchPlaceId(summary);
  });
}

export function prewarmGooglePlacesEnrichmentForSummaries(
  summaries: StorefrontSummaryApiDocument[],
  maxCount = 3,
) {
  if (!hasGooglePlacesConfig()) {
    return;
  }

  const candidates = summaries.slice(0, Math.max(0, maxCount));
  if (!candidates.length) {
    return;
  }

  void runBackgroundSummaryTasks(candidates, async (summary) => {
    await getGooglePlacesEnrichment(summary);
  });
}

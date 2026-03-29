import { StorefrontSummaryApiDocument } from '../types';
import { requestGoogleJson } from './googlePlacesClient';
import { matchPlaceId } from './googlePlacesMatching';
import {
  BACKGROUND_CONCURRENCY,
  clearGooglePlacesCaches,
  DETAIL_TTL_MS,
  detailCache,
  detailInFlight,
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
    async () => {
      const payload = await requestGoogleJson<GooglePlaceDetailResponse>(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
        {
          method: 'GET',
        },
        'id,websiteUri,nationalPhoneNumber,regularOpeningHours.weekdayDescriptions,currentOpeningHours.openNow'
      );

      if (!payload?.id) {
        return null;
      }

      return {
        phone: typeof payload.nationalPhoneNumber === 'string' ? payload.nationalPhoneNumber : null,
        website: typeof payload.websiteUri === 'string' ? payload.websiteUri : null,
        hours: normalizeHours(payload.regularOpeningHours?.weekdayDescriptions),
        openNow: typeof payload.currentOpeningHours?.openNow === 'boolean' ? payload.currentOpeningHours.openNow : null,
      };
    }
  );
}

async function runBackgroundSummaryTasks(
  summaries: StorefrontSummaryApiDocument[],
  worker: (summary: StorefrontSummaryApiDocument) => Promise<void>
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
    })()
  );

  await Promise.allSettled(workers);
}

export async function getGooglePlacesEnrichment(summary: StorefrontSummaryApiDocument) {
  if (!hasGooglePlacesConfig()) {
    return null;
  }

  return resolveCached(
    summary.id,
    storefrontEnrichmentCache,
    storefrontEnrichmentInFlight,
    DETAIL_TTL_MS,
    async () => {
      const placeId = await matchPlaceId(summary);
      if (!placeId) {
        return null;
      }
      return loadPlaceDetail(placeId);
    }
  );
}

export function getCachedGooglePlacesEnrichment(storefrontId: string) {
  const cached = storefrontEnrichmentCache.get(storefrontId);
  if (!isFresh(cached)) {
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
  maxCount = 8
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
  maxCount = 3
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

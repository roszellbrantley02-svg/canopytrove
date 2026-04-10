import { storefrontSourceMode } from '../config/storefrontSourceConfig';
import { mergeLocalStorefrontCommunityIntoDetail } from '../services/storefrontCommunityLocalService';
import { requestJson } from '../services/storefrontBackendHttp';
import { storefrontSource } from '../sources';
import type { StorefrontDetails } from '../types/storefront';
import {
  getFreshDetail,
  invalidateStorefrontDetailsCache,
  primeStorefrontDetailsCache,
  resolveDetailWithCache,
  subscribeToFreshDetail,
} from './storefrontRepositoryCache';

const API_PENDING_DETAIL_TTL_MS = 1_000;
const API_ENRICHED_DETAIL_TTL_MS = 45_000;

function getApiDetailTtlMs(detail: StorefrontDetails | null) {
  if (!detail) {
    return API_PENDING_DETAIL_TTL_MS;
  }

  return detail.hours.length || detail.website || detail.phone
    ? API_ENRICHED_DETAIL_TTL_MS
    : API_PENDING_DETAIL_TTL_MS;
}

export async function getStorefrontDetails(
  storefrontId: string,
): Promise<StorefrontDetails | null> {
  return resolveDetailWithCache(
    storefrontId,
    async () => {
      const detail = await storefrontSource.getDetailsById(storefrontId);
      if (!detail) {
        return detail;
      }

      if (storefrontSourceMode === 'api') {
        return detail;
      }

      return mergeLocalStorefrontCommunityIntoDetail(detail);
    },
    storefrontSourceMode === 'api' ? getApiDetailTtlMs : undefined,
  );
}

export async function prefetchStorefrontDetails(storefrontId: string): Promise<void> {
  await getStorefrontDetails(storefrontId);
}

/**
 * Prefetch multiple storefront details in a single HTTP request.
 * Falls back to individual fetches if the batch endpoint is unavailable
 * or the source mode is not API.
 */
export async function prefetchStorefrontDetailsBatch(storefrontIds: string[]): Promise<void> {
  if (!storefrontIds.length) {
    return;
  }

  // Filter out IDs that are already cached
  const uncachedIds = storefrontIds.filter((id) => !getFreshDetail(id));
  if (!uncachedIds.length) {
    return;
  }

  // Only use batch endpoint in API mode
  if (storefrontSourceMode !== 'api') {
    await Promise.allSettled(uncachedIds.map((id) => getStorefrontDetails(id)));
    return;
  }

  try {
    const response = await requestJson<{ items: Record<string, StorefrontDetails | null> }>(
      `/storefront-details/batch?ids=${uncachedIds.join(',')}`,
    );

    if (response?.items) {
      for (const [id, detail] of Object.entries(response.items)) {
        if (detail) {
          primeStorefrontDetailsCache(id, detail);
        }
      }
    }
  } catch {
    // Batch endpoint unavailable — fall back to individual fetches
    await Promise.allSettled(uncachedIds.map((id) => getStorefrontDetails(id)));
  }
}

export function getCachedStorefrontDetails(storefrontId: string) {
  return getFreshDetail(storefrontId);
}

export function subscribeToCachedStorefrontDetails(storefrontId: string, listener: () => void) {
  return subscribeToFreshDetail(storefrontId, listener);
}

export function primeStorefrontDetails(storefrontId: string, detail: StorefrontDetails | null) {
  primeStorefrontDetailsCache(storefrontId, detail);
}

export function invalidateStorefrontDetails(storefrontId: string) {
  invalidateStorefrontDetailsCache(storefrontId);
}

import { storefrontSourceMode } from '../config/storefrontSourceConfig';
import { mergeLocalStorefrontCommunityIntoDetail } from '../services/storefrontCommunityLocalService';
import { storefrontSource } from '../sources';
import type { StorefrontDetails } from '../types/storefront';
import {
  getFreshDetail,
  invalidateStorefrontDetailsCache,
  primeStorefrontDetailsCache,
  resolveDetailWithCache,
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

export function getCachedStorefrontDetails(storefrontId: string) {
  return getFreshDetail(storefrontId);
}

export function primeStorefrontDetails(storefrontId: string, detail: StorefrontDetails | null) {
  primeStorefrontDetailsCache(storefrontId, detail);
}

export function invalidateStorefrontDetails(storefrontId: string) {
  invalidateStorefrontDetailsCache(storefrontId);
}

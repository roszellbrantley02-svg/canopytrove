import { storefrontApiBaseUrl } from '../config/storefrontSourceConfig';
import {
  fromStorefrontDetailApiDocument,
  fromStorefrontSummaryApiDocument,
} from '../adapters/apiStorefrontAdapter';
import type {
  StorefrontDetailApiDocument,
  StorefrontSummariesApiResponse,
  StorefrontSummaryApiDocument,
} from '../types/storefrontApi';
import { getCanopyTroveAuthIdToken } from '../services/canopyTroveAuthService';
import type {
  StorefrontSource,
  StorefrontSourceSummaryQuery,
  StorefrontSummaryPage,
} from './storefrontSource';

const API_REQUEST_TIMEOUT_MS = 6_000;

function normalizeAreaId(areaId?: string | null) {
  const normalized = areaId?.trim().toLowerCase();
  if (!normalized || normalized === 'all' || normalized === 'nearby') {
    return null;
  }

  return areaId ?? null;
}

function createUrl(pathname: string, searchParams?: Record<string, string | null | undefined>) {
  if (!storefrontApiBaseUrl) {
    return null;
  }

  const url = new URL(
    pathname,
    storefrontApiBaseUrl.endsWith('/') ? storefrontApiBaseUrl : `${storefrontApiBaseUrl}/`,
  );
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value) {
        url.searchParams.set(key, value);
      }
    }
  }

  return url.toString();
}

function requestJson<T>(url: string): Promise<T>;
function requestJson<T>(url: string, options: { allowNotFound: true }): Promise<T | null>;
async function requestJson<T>(
  url: string,
  options?: {
    allowNotFound?: boolean;
  },
): Promise<T | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, API_REQUEST_TIMEOUT_MS);

  try {
    const headers = new Headers();
    let idToken: string | null = null;
    try {
      // Public storefront reads should degrade to guest access if auth refresh is stale.
      idToken = await getCanopyTroveAuthIdToken();
    } catch {
      idToken = null;
    }
    if (idToken) {
      headers.set('Authorization', `Bearer ${idToken}`);
    }

    const response = await fetch(url, {
      headers,
      signal: controller.signal,
    });
    if (!response.ok) {
      if (response.status === 404 && options?.allowNotFound) {
        return null;
      }

      throw new Error(`Storefront API request failed with ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

function toSummaryResult(items: StorefrontSummaryApiDocument[]) {
  return items.map((item) => fromStorefrontSummaryApiDocument(item));
}

function toSummaryPage(response: StorefrontSummariesApiResponse): StorefrontSummaryPage {
  return {
    items: toSummaryResult(response.items ?? []),
    total: response.total ?? response.items?.length ?? 0,
    limit: response.limit ?? null,
    offset: response.offset ?? 0,
  };
}

function toQueryParams(query?: StorefrontSourceSummaryQuery) {
  return {
    areaId: normalizeAreaId(query?.areaId),
    searchQuery: query?.searchQuery?.trim() || null,
    originLat: query?.origin ? String(query.origin.latitude) : null,
    originLng: query?.origin ? String(query.origin.longitude) : null,
    radiusMiles: query?.radiusMiles ? String(query.radiusMiles) : null,
    sortKey: query?.sortKey ?? null,
    limit: typeof query?.limit === 'number' ? String(query.limit) : null,
    offset: typeof query?.offset === 'number' ? String(query.offset) : null,
    prioritySurface: query?.prioritySurface ?? null,
  };
}

export const apiStorefrontSource: StorefrontSource = {
  async getAllSummaries() {
    return (await this.getSummaryPage()).items;
  },

  async getSummariesByIds(storefrontIds) {
    if (!storefrontIds.length) {
      return [];
    }

    const url = createUrl('storefront-summaries/by-ids', {
      ids: storefrontIds.join(','),
    });
    if (!url) {
      return [];
    }

    const response = await requestJson<StorefrontSummariesApiResponse>(url);
    return toSummaryResult(response.items ?? []);
  },

  async getSummaryPage(query) {
    const url = createUrl('storefront-summaries', toQueryParams(query));
    if (!url) {
      return { items: [], total: 0, limit: query?.limit ?? null, offset: query?.offset ?? 0 };
    }

    const response = await requestJson<StorefrontSummariesApiResponse>(url);
    return toSummaryPage(response);
  },

  async getSummaries(query) {
    return (await this.getSummaryPage(query)).items;
  },

  async getDetailsById(storefrontId) {
    const url = createUrl(`storefront-details/${storefrontId}`);
    if (!url) {
      return null;
    }

    const response = await requestJson<StorefrontDetailApiDocument>(url, {
      allowNotFound: true,
    });
    return response ? fromStorefrontDetailApiDocument(response) : null;
  },
};

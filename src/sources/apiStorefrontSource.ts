import { Platform } from 'react-native';
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
import { getCanopyTroveStorefrontReadIdToken } from '../services/canopyTroveAuthService';
import type {
  StorefrontSource,
  StorefrontSourceSummaryQuery,
  StorefrontSummaryPage,
} from './storefrontSource';

const API_REQUEST_TIMEOUT_MS = 10_000;
const API_RETRY_DELAY_MS = 1_500;
// Two retries (three attempts total) so a transient edge 426 can clear on
// the next try without the user ever seeing an error state.
const API_MAX_RETRIES = 2;

function getClientPlatformHeader(): string {
  if (Platform.OS === 'android') return 'android';
  if (Platform.OS === 'ios') return 'ios';
  return 'web';
}

class StorefrontApiHttpError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number) {
    super(`Storefront API request failed with ${statusCode}`);
    this.name = 'StorefrontApiHttpError';
    this.statusCode = statusCode;
  }
}

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

async function singleRequestJson<T>(
  url: string,
  options?: { allowNotFound?: boolean },
): Promise<T | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, API_REQUEST_TIMEOUT_MS);

  try {
    const headers = new Headers();
    let idToken: string | null = null;
    try {
      idToken = await getCanopyTroveStorefrontReadIdToken();
    } catch {
      idToken = null;
    }
    if (idToken) {
      headers.set('Authorization', `Bearer ${idToken}`);
    }
    headers.set('X-Client-Platform', getClientPlatformHeader());

    const response = await fetch(url, {
      headers,
      signal: controller.signal,
    });
    if (!response.ok) {
      if (response.status === 404 && options?.allowNotFound) {
        return null;
      }

      throw new StorefrontApiHttpError(response.status);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

function requestJson<T>(url: string): Promise<T>;
function requestJson<T>(url: string, options: { allowNotFound: true }): Promise<T | null>;
async function requestJson<T>(
  url: string,
  options?: {
    allowNotFound?: boolean;
  },
): Promise<T | null> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= API_MAX_RETRIES; attempt++) {
    try {
      return await singleRequestJson<T>(url, options);
    } catch (error) {
      lastError = error;

      // Only retry on network/timeout errors, not on 4xx responses.
      // Note: `DOMException` is not a global on Hermes, so we name-check
      // AbortError on the Error base class instead of `instanceof DOMException`
      // — that avoids a ReferenceError on iOS/Android while still catching
      // fetch aborts on web.
      const isAbortError = error instanceof Error && error.name === 'AbortError';
      // 426 Upgrade Required is surfaced by GCP's edge layer (Cloud Run / L7
      // LB / Cloud Armor), not by our Express backend — our handlers never
      // emit it. When it does appear it's almost always transient: a cold-
      // start protocol-upgrade race on the LB path, a dropped TLS session
      // handshake, or a momentary HTTP/2 negotiation glitch on cellular.
      // Retrying once almost always succeeds, and it degrades gracefully
      // into the regular failure surface if it doesn't.
      const isRetryable =
        error instanceof TypeError ||
        isAbortError ||
        (error instanceof StorefrontApiHttpError &&
          [408, 426, 429, 502, 503, 504].includes(error.statusCode));

      if (error instanceof StorefrontApiHttpError && error.statusCode === 426) {
        // Log the URL so we can triage if/when 426 re-emerges in the wild.
        // Kept on console.warn rather than a logger dep to avoid pulling
        // any non-RN module into this edge path.
        console.warn('[apiStorefrontSource] 426 Upgrade Required — retrying', {
          url,
          attempt,
        });
      }

      if (!isRetryable || attempt >= API_MAX_RETRIES) {
        break;
      }

      await new Promise<void>((resolve) => {
        setTimeout(resolve, API_RETRY_DELAY_MS);
      });
    }
  }

  throw lastError;
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

/** Resolve a URL slug to a Firestore storefront ID via the backend. */
export async function resolveStorefrontSlug(slug: string): Promise<string | null> {
  const url = createUrl(`storefronts/resolve`, { slug });
  if (!url) {
    return null;
  }

  try {
    const response = await requestJson<{ storefrontId?: string | null }>(url, {
      allowNotFound: true,
    });
    return response?.storefrontId ?? null;
  } catch {
    return null;
  }
}

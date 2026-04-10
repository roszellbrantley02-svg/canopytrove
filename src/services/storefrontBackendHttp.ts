import { Platform } from 'react-native';
import { storefrontApiBaseUrl } from '../config/storefrontSourceConfig';
import type { Coordinates, MarketArea } from '../types/storefront';
import { getCanopyTroveAuthCacheKey, getCanopyTroveAuthIdToken } from './canopyTroveAuthService';
import { getCachedAppProfile } from './appProfileService';

export type StorefrontBackendHealth = {
  ok: boolean;
  source?: {
    requestedMode?: string;
    activeMode?: string;
    fallbackReason?: string | null;
  };
  profileStorage?: 'memory' | 'firestore';
  routeStateStorage?: 'memory' | 'firestore';
  gamificationStorage?: 'memory' | 'firestore';
  authVerification?: 'firebase-admin' | 'disabled';
  allowDevSeed?: boolean;
};

export type StorefrontBackendSeedStatus = {
  enabled: boolean;
  counts: {
    summaryCount: number;
    detailCount: number;
  };
};

export type StorefrontBackendLocationResolution = {
  coordinates: Coordinates | null;
  label: string | null;
  source: 'area' | 'summary' | 'unavailable';
};

export type StorefrontBackendMarketArea = MarketArea;

export type TierAccessErrorPayload = {
  code: 'TIER_ACCESS_DENIED';
  requiredTier: string;
  currentTier: string;
};

export class BackendTierAccessError extends Error {
  public readonly code = 'TIER_ACCESS_DENIED' as const;
  public readonly requiredTier: string;
  public readonly currentTier: string;

  constructor(message: string, requiredTier: string, currentTier: string) {
    super(message);
    this.requiredTier = requiredTier;
    this.currentTier = currentTier;
  }
}

export function isBackendTierAccessError(error: unknown): error is BackendTierAccessError {
  return error instanceof BackendTierAccessError;
}

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const backendGetCache = new Map<string, CacheEntry<unknown>>();
const backendGetInFlight = new Map<string, Promise<unknown>>();
const backendMutationInFlight = new Set<string>();
const BACKEND_REQUEST_TIMEOUT_MS = 6_000;
const _BACKEND_AI_REQUEST_TIMEOUT_MS = 25_000;
const BACKEND_GET_CACHE_LIMIT = 96;

export const backendCacheTtls = {
  health: 10_000,
  seedStatus: 10_000,
  marketAreas: 5 * 60_000,
  location: 5 * 60_000,
  profile: 15_000,
  profileState: 3_000,
  communitySafety: 3_000,
  leaderboard: 15_000,
} as const;

function createBackendUrl(pathname: string) {
  if (!storefrontApiBaseUrl) {
    throw new Error('Storefront API base URL is not configured.');
  }

  return `${storefrontApiBaseUrl.replace(/\/+$/, '')}${pathname}`;
}

function getFreshCachedValue<T>(cacheKey: string) {
  const cached = backendGetCache.get(cacheKey) as CacheEntry<T> | undefined;
  if (!cached || cached.expiresAt <= Date.now()) {
    if (cached) {
      backendGetCache.delete(cacheKey);
    }
    return null;
  }

  return cached.value;
}

function pruneBackendGetCache(now = Date.now()) {
  backendGetCache.forEach((entry, cacheKey) => {
    if (entry.expiresAt <= now) {
      backendGetCache.delete(cacheKey);
    }
  });

  while (backendGetCache.size > BACKEND_GET_CACHE_LIMIT) {
    const oldestCacheKey = backendGetCache.keys().next().value;
    if (!oldestCacheKey) {
      break;
    }

    backendGetCache.delete(oldestCacheKey);
  }
}

function setCachedValue<T>(cacheKey: string, value: T, ttlMs: number) {
  backendGetCache.delete(cacheKey);
  backendGetCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
  pruneBackendGetCache();
}

export function clearCachedValue(cacheKeyPrefix: string) {
  Array.from(backendGetCache.keys()).forEach((cacheKey) => {
    if (cacheKey.startsWith(cacheKeyPrefix)) {
      backendGetCache.delete(cacheKey);
    }
  });
}

function getClientPlatformHeader(): string {
  if (Platform.OS === 'android') return 'android';
  if (Platform.OS === 'ios') return 'ios';
  return 'web';
}

async function buildRequestHeaders(headers?: HeadersInit) {
  const nextHeaders = new Headers(headers);
  const idToken = await getCanopyTroveAuthIdToken();
  const profileId = getCachedAppProfile()?.id?.trim();
  if (idToken) {
    nextHeaders.set('Authorization', `Bearer ${idToken}`);
  }
  if (profileId) {
    nextHeaders.set('X-Canopy-Profile-Id', profileId);
  }
  nextHeaders.set('X-Client-Platform', getClientPlatformHeader());

  return nextHeaders;
}

export function createProfileCacheKey(profileId: string) {
  return `profile:${profileId}:${getCanopyTroveAuthCacheKey()}`;
}

export function createCanonicalProfileCacheKey() {
  return `profile:canonical:${getCanopyTroveAuthCacheKey()}`;
}

export function createProfileStateCacheKey(profileId: string) {
  return `profile-state:${profileId}:${getCanopyTroveAuthCacheKey()}`;
}

export function createCommunitySafetyCacheKey(profileId: string) {
  return `community-safety:${profileId}:${getCanopyTroveAuthCacheKey()}`;
}

export function createLeaderboardRankCacheKey(profileId: string) {
  return `leaderboard-rank:${profileId}`;
}

async function throwBackendError(response: Response): Promise<never> {
  try {
    const payload = (await response.json()) as {
      error?: unknown;
      code?: unknown;
      requiredTier?: unknown;
      currentTier?: unknown;
      requestId?: unknown;
    };

    // Detect tier access errors and throw a typed error
    if (
      payload.code === 'TIER_ACCESS_DENIED' &&
      typeof payload.requiredTier === 'string' &&
      typeof payload.currentTier === 'string'
    ) {
      const errorText =
        typeof payload.error === 'string' && payload.error.trim()
          ? payload.error.trim()
          : 'This feature requires a higher plan.';
      throw new BackendTierAccessError(errorText, payload.requiredTier, payload.currentTier);
    }

    const errorText =
      typeof payload.error === 'string' && payload.error.trim()
        ? payload.error.trim()
        : `Backend request failed with ${response.status}`;
    const requestId =
      typeof payload.requestId === 'string' && payload.requestId.trim()
        ? payload.requestId.trim()
        : null;
    throw new Error(requestId ? `${errorText} (request ${requestId})` : errorText);
  } catch (parseError) {
    if (
      parseError instanceof BackendTierAccessError ||
      (parseError instanceof Error &&
        parseError.message !== `Backend request failed with ${response.status}`)
    ) {
      throw parseError;
    }
    throw new Error(`Backend request failed with ${response.status}`);
  }
}

export async function requestJson<T>(
  pathname: string,
  init?: RequestInit,
  options?: { cacheKey?: string; ttlMs?: number; timeoutMs?: number },
): Promise<T> {
  const cacheKey = !init?.method || init.method === 'GET' ? options?.cacheKey : undefined;
  const ttlMs = options?.ttlMs ?? 0;
  const method = init?.method || 'GET';
  const isMutation = method !== 'GET';

  // For mutations (POST, PUT, DELETE), check if a request is already in-flight
  if (isMutation) {
    const mutationKey = `${method}:${pathname}`;
    if (backendMutationInFlight.has(mutationKey)) {
      throw new Error(`Request already in progress: ${method} ${pathname}`);
    }
  }

  if (cacheKey && ttlMs > 0) {
    pruneBackendGetCache();
    const cached = getFreshCachedValue<T>(cacheKey);
    if (cached) {
      return cached;
    }

    const pending = backendGetInFlight.get(cacheKey) as Promise<T> | undefined;
    if (pending) {
      return pending;
    }
  }

  const request = (async () => {
    const controller = new AbortController();
    const effectiveTimeout = options?.timeoutMs ?? BACKEND_REQUEST_TIMEOUT_MS;
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, effectiveTimeout);

    try {
      const headers = await buildRequestHeaders(init?.headers);
      const response = await fetch(createBackendUrl(pathname), {
        ...init,
        headers,
        signal: controller.signal,
      });
      if (!response.ok) {
        await throwBackendError(response);
      }

      const payload = (await response.json()) as T;
      if (cacheKey && ttlMs > 0) {
        setCachedValue(cacheKey, payload, ttlMs);
      }
      return payload;
    } finally {
      clearTimeout(timeoutId);
    }
  })();

  if (isMutation) {
    const mutationKey = `${method}:${pathname}`;
    backendMutationInFlight.add(mutationKey);
    try {
      return await request;
    } finally {
      backendMutationInFlight.delete(mutationKey);
    }
  }

  if (cacheKey && ttlMs > 0) {
    backendGetInFlight.set(cacheKey, request);
    try {
      return await request;
    } finally {
      backendGetInFlight.delete(cacheKey);
    }
  }

  return request;
}

/**
 * Send a raw binary body (e.g. image bytes) to the backend with auth
 * headers. Unlike `requestJson`, does NOT set Content-Type to JSON —
 * the caller controls the Content-Type. The response is parsed as JSON.
 */
export async function requestRawUpload<T>(
  pathname: string,
  body: Blob | ArrayBuffer,
  options: {
    method?: string;
    contentType: string;
    extraHeaders?: Record<string, string>;
    timeoutMs?: number;
  },
): Promise<T> {
  const controller = new AbortController();
  const effectiveTimeout = options.timeoutMs ?? BACKEND_REQUEST_TIMEOUT_MS;
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, effectiveTimeout);

  try {
    const headers = await buildRequestHeaders();
    headers.set('Content-Type', options.contentType);
    if (options.extraHeaders) {
      for (const [key, value] of Object.entries(options.extraHeaders)) {
        headers.set(key, value);
      }
    }

    const response = await fetch(createBackendUrl(pathname), {
      method: options.method ?? 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      await throwBackendError(response);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

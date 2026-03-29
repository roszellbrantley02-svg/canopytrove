import { storefrontApiBaseUrl } from '../config/storefrontSourceConfig';
import { Coordinates, MarketArea } from '../types/storefront';
import { getCanopyTroveAuthCacheKey, getCanopyTroveAuthIdToken } from './canopyTroveAuthService';

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

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const backendGetCache = new Map<string, CacheEntry<unknown>>();
const backendGetInFlight = new Map<string, Promise<unknown>>();
const BACKEND_REQUEST_TIMEOUT_MS = 6_000;

export const backendCacheTtls = {
  health: 10_000,
  seedStatus: 10_000,
  marketAreas: 5 * 60_000,
  location: 5 * 60_000,
  profile: 15_000,
  profileState: 3_000,
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
    return null;
  }

  return cached.value;
}

function setCachedValue<T>(cacheKey: string, value: T, ttlMs: number) {
  backendGetCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

export function clearCachedValue(cacheKeyPrefix: string) {
  Array.from(backendGetCache.keys()).forEach((cacheKey) => {
    if (cacheKey.startsWith(cacheKeyPrefix)) {
      backendGetCache.delete(cacheKey);
    }
  });
}

async function buildRequestHeaders(headers?: HeadersInit) {
  const nextHeaders = new Headers(headers);
  const idToken = await getCanopyTroveAuthIdToken();
  if (idToken) {
    nextHeaders.set('Authorization', `Bearer ${idToken}`);
  }

  return nextHeaders;
}

export function createProfileCacheKey(profileId: string) {
  return `profile:${profileId}:${getCanopyTroveAuthCacheKey()}`;
}

export function createProfileStateCacheKey(profileId: string) {
  return `profile-state:${profileId}:${getCanopyTroveAuthCacheKey()}`;
}

export function createLeaderboardRankCacheKey(profileId: string) {
  return `leaderboard-rank:${profileId}`;
}

export async function requestJson<T>(
  pathname: string,
  init?: RequestInit,
  options?: { cacheKey?: string; ttlMs?: number }
): Promise<T> {
  const cacheKey = !init?.method || init.method === 'GET' ? options?.cacheKey : undefined;
  const ttlMs = options?.ttlMs ?? 0;

  if (cacheKey && ttlMs > 0) {
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
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, BACKEND_REQUEST_TIMEOUT_MS);

    try {
      const headers = await buildRequestHeaders(init?.headers);
      const response = await fetch(createBackendUrl(pathname), {
        ...init,
        headers,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Backend request failed with ${response.status}`);
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

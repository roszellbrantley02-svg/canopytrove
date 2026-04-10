import type {
  AppProfile,
  GamificationLeaderboardResponse,
  StorefrontProfileState,
} from '../types/storefront';
import type {
  StorefrontBackendHealth,
  StorefrontBackendLocationResolution,
  StorefrontBackendMarketArea,
  StorefrontBackendSeedStatus,
} from './storefrontBackendHttp';
import {
  backendCacheTtls,
  createCanonicalProfileCacheKey,
  createLeaderboardRankCacheKey,
  createProfileCacheKey,
  createProfileStateCacheKey,
  requestJson,
} from './storefrontBackendHttp';

export function getStorefrontBackendHealth() {
  return requestJson<StorefrontBackendHealth>('/health', undefined, {
    cacheKey: 'health',
    ttlMs: backendCacheTtls.health,
  });
}

export function getStorefrontBackendSeedStatus() {
  return requestJson<StorefrontBackendSeedStatus>('/admin/seed-status', undefined, {
    cacheKey: 'seed-status',
    ttlMs: backendCacheTtls.seedStatus,
  });
}

export function resolveStorefrontBackendLocation(query: string) {
  return requestJson<StorefrontBackendLocationResolution>(
    `/resolve-location?query=${encodeURIComponent(query)}`,
    undefined,
    {
      cacheKey: `resolve-location:${query.trim().toLowerCase()}`,
      ttlMs: backendCacheTtls.location,
    },
  );
}

export function getStorefrontBackendMarketAreas() {
  return requestJson<StorefrontBackendMarketArea[]>('/market-areas', undefined, {
    cacheKey: 'market-areas',
    ttlMs: backendCacheTtls.marketAreas,
  });
}

export function getStorefrontBackendProfile(profileId: string) {
  return requestJson<AppProfile>(`/profiles/${encodeURIComponent(profileId)}`, undefined, {
    cacheKey: createProfileCacheKey(profileId),
    ttlMs: backendCacheTtls.profile,
  });
}

export function getStorefrontBackendCanonicalProfile() {
  return requestJson<AppProfile>('/profiles/me/canonical', undefined, {
    cacheKey: createCanonicalProfileCacheKey(),
    ttlMs: backendCacheTtls.profile,
  });
}

export function getStorefrontBackendProfileState(profileId: string) {
  return requestJson<StorefrontProfileState>(
    `/profile-state/${encodeURIComponent(profileId)}`,
    undefined,
    {
      cacheKey: createProfileStateCacheKey(profileId),
      ttlMs: backendCacheTtls.profileState,
    },
  );
}

export function getStorefrontBackendLeaderboard(limit = 25, offset = 0) {
  return requestJson<GamificationLeaderboardResponse>(
    `/leaderboard?limit=${encodeURIComponent(String(limit))}&offset=${encodeURIComponent(String(offset))}`,
    undefined,
    {
      cacheKey: `leaderboard:${limit}:${offset}`,
      ttlMs: backendCacheTtls.leaderboard,
    },
  );
}

export function getStorefrontBackendLeaderboardRank(profileId: string) {
  return requestJson<{ profileId: string; rank: number; total: number }>(
    `/leaderboard/${encodeURIComponent(profileId)}/rank`,
    undefined,
    {
      cacheKey: createLeaderboardRankCacheKey(profileId),
      ttlMs: backendCacheTtls.leaderboard,
    },
  );
}

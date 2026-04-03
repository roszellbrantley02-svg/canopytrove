import { getCachedMarketAreas, primeStoredMarketAreas } from './marketAreaService';
import { ensureAppProfile } from './appProfileService';
import { primeStoredDeviceLocation } from './locationService';
import { getCachedRecentStorefrontIds, loadRecentStorefrontIds } from './recentStorefrontService';
import { primeStoredStorefrontCommunityState } from './storefrontCommunityLocalService';
import { loadStorefrontPreferences } from './storefrontPreferencesService';
import {
  loadBrowseSummarySnapshot,
  loadLatestNearbySummarySnapshot,
  loadNearbySummarySnapshot,
  loadStorefrontDetailSnapshot,
} from './storefrontSummarySnapshotService';
import type { BrowseSortKey, MarketArea, StorefrontListQuery } from '../types/storefront';

const DEFAULT_BROWSE_LIMIT = 4;

function resolveSelectedArea(areas: MarketArea[], selectedAreaId?: string) {
  return areas.find((area) => area.id === selectedAreaId) ?? areas[0];
}

function createBootstrapQuery(
  area: MarketArea | undefined,
  searchQuery: string,
  searchLocation?: { latitude: number; longitude: number } | null,
  searchLocationLabel?: string | null,
): StorefrontListQuery | null {
  if (!area) {
    return null;
  }

  return {
    areaId: area.id,
    searchQuery,
    origin: searchLocation ?? area.center,
    locationLabel: searchLocationLabel ?? area.label,
  };
}

export async function primeAppBootstrap() {
  const [preferences, _appProfile, _storedAreas, _storedDeviceLocation] = await Promise.all([
    loadStorefrontPreferences(),
    ensureAppProfile(),
    primeStoredMarketAreas(),
    primeStoredDeviceLocation(),
    primeStoredStorefrontCommunityState(),
  ]);
  const localRecentStorefrontIds = getCachedRecentStorefrontIds();
  void loadRecentStorefrontIds();

  const areas = getCachedMarketAreas();
  const selectedArea = resolveSelectedArea(areas, preferences?.selectedAreaId);
  const query = createBootstrapQuery(
    selectedArea,
    preferences?.searchQuery ?? '',
    preferences?.searchLocation ?? null,
    preferences?.searchLocationLabel ?? null,
  );

  if (!query) {
    void loadLatestNearbySummarySnapshot();
    return;
  }

  void loadLatestNearbySummarySnapshot();
  void loadNearbySummarySnapshot(query);
  void loadBrowseSummarySnapshot(
    query,
    (preferences?.browseSortKey ?? 'distance') as BrowseSortKey,
    DEFAULT_BROWSE_LIMIT,
  );
  void Promise.all(
    Array.from(
      new Set([
        ...(preferences?.savedStorefrontIds ?? []).slice(0, 3),
        ...localRecentStorefrontIds.slice(0, 3),
      ]),
    ).map((storefrontId) => loadStorefrontDetailSnapshot(storefrontId)),
  );
}

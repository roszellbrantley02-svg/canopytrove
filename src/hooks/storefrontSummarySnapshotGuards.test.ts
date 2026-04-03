import { describe, expect, it } from 'vitest';
import {
  shouldKeepCachedBrowseResults,
  shouldKeepWarmNearbyResults,
  shouldPersistBrowseSnapshot,
  shouldPersistNearbySnapshot,
} from './storefrontSummarySnapshotGuards';
import type {
  BrowseSummaryResult,
  StorefrontListQuery,
  StorefrontSummary,
} from '../types/storefront';

const query: StorefrontListQuery = {
  areaId: undefined,
  searchQuery: '',
  origin: {
    latitude: 40.7128,
    longitude: -74.006,
  },
  locationLabel: 'New York',
  hotDealsOnly: false,
};

const sampleStorefront: StorefrontSummary = {
  id: 'culture-house',
  licenseId: 'ocm-001',
  marketId: 'manhattan',
  displayName: 'Culture House',
  legalName: 'Culture House',
  addressLine1: '958 6th Ave',
  city: 'New York',
  state: 'NY',
  zip: '10001',
  coordinates: {
    latitude: 40.7484,
    longitude: -73.9857,
  },
  rating: 4.7,
  reviewCount: 18,
  distanceMiles: 1.2,
  travelMinutes: 6,
  openNow: true,
  mapPreviewLabel: '1.2 mi route preview',
  isVerified: true,
};

const cachedBrowse: BrowseSummaryResult = {
  items: [sampleStorefront],
  total: 1,
  limit: 8,
  offset: 0,
  hasMore: false,
};

describe('storefront summary snapshot guards', () => {
  it('does not persist an empty default browse page', () => {
    expect(
      shouldPersistBrowseSnapshot(query, {
        items: [],
        total: 0,
        limit: 8,
        offset: 0,
        hasMore: false,
      }),
    ).toBe(false);
  });

  it('keeps cached browse results when the default browse refresh comes back empty', () => {
    expect(
      shouldKeepCachedBrowseResults(query, cachedBrowse, {
        items: [],
        total: 0,
        limit: 8,
        offset: 0,
        hasMore: false,
      }),
    ).toBe(true);
  });

  it('does not overwrite nearby state with an empty refresh when warm data exists', () => {
    expect(shouldPersistNearbySnapshot([])).toBe(false);
    expect(shouldKeepWarmNearbyResults([sampleStorefront], null, [])).toBe(true);
  });
});

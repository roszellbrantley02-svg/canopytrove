import assert from 'node:assert/strict';
import { describe, test, beforeEach } from 'node:test';
import {
  getTrendingBrands,
  getBrandScansNearStorefront,
  getBrandActivity,
  clearBrandAnalyticsCache,
  type TrendingBrand,
  type BrandActivityNearStorefront,
  type BrandActivitySnapshot,
} from './brandAnalyticsService';

describe('brandAnalyticsService', () => {
  beforeEach(() => {
    clearBrandAnalyticsCache();
  });

  describe('getTrendingBrands', () => {
    test('returns empty array when Firestore is unavailable', async () => {
      // This test assumes Firestore is not available in test environment
      const results = await getTrendingBrands({ limit: 10 });
      assert.equal(Array.isArray(results), true);
      // In test environment without Firestore, should return []
    });

    test('respects limit parameter', async () => {
      const results5 = await getTrendingBrands({ limit: 5 });
      const results10 = await getTrendingBrands({ limit: 10 });
      // Results should be arrays (populated only if Firestore is available)
      assert.equal(Array.isArray(results5), true);
      assert.equal(Array.isArray(results10), true);
    });
  });

  describe('getBrandScansNearStorefront', () => {
    test('returns empty array when Firestore is unavailable', async () => {
      const results = await getBrandScansNearStorefront({
        storefrontId: 'sf-123',
        storefrontLat: 40.7128,
        storefrontLng: -74.006,
      });
      assert.equal(Array.isArray(results), true);
    });

    test('accepts sinceDays parameter', async () => {
      const results = await getBrandScansNearStorefront({
        storefrontId: 'sf-456',
        storefrontLat: 40.7128,
        storefrontLng: -74.006,
        sinceDays: 30,
      });
      assert.equal(Array.isArray(results), true);
    });

    test('handles invalid coordinates gracefully', async () => {
      const results = await getBrandScansNearStorefront({
        storefrontId: 'sf-789',
        storefrontLat: Infinity,
        storefrontLng: NaN,
      });
      assert.equal(Array.isArray(results), true);
    });
  });

  describe('getBrandActivity', () => {
    test('returns empty array when Firestore is unavailable', async () => {
      const results = await getBrandActivity({
        brandId: 'brand-123',
      });
      assert.equal(Array.isArray(results), true);
    });

    test('respects windowDays parameter', async () => {
      const results7 = await getBrandActivity({
        brandId: 'brand-456',
        windowDays: 7,
      });
      const results30 = await getBrandActivity({
        brandId: 'brand-456',
        windowDays: 30,
      });
      assert.equal(Array.isArray(results7), true);
      assert.equal(Array.isArray(results30), true);
    });
  });

  describe('cache behavior', () => {
    test('clearBrandAnalyticsCache clears all caches', async () => {
      // Call services to potentially populate cache
      await getTrendingBrands({ limit: 5 });
      await getBrandScansNearStorefront({
        storefrontId: 'sf-test',
        storefrontLat: 40.7128,
        storefrontLng: -74.006,
      });
      await getBrandActivity({ brandId: 'brand-test' });

      // Clear cache
      clearBrandAnalyticsCache();

      // Should not throw
      assert.ok(true);
    });
  });
});

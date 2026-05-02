import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import {
  attachRouteHeatToDetail,
  attachRouteHeatToSummaries,
  clearStorefrontRouteHeatCacheForTests,
  loadRouteStartsForCurrentHour,
} from './storefrontRouteHeatService';
import { createHourBucketKey, createHourlyStorefrontRouteId } from './analyticsEventService';

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  clearStorefrontRouteHeatCacheForTests();
});

afterEach(() => {
  clearStorefrontRouteHeatCacheForTests();
  mock.reset();
});

// ============================================================================
// Hour bucket key helper
// ============================================================================

test('createHourBucketKey produces the YYYYMMDDHH key from an ISO timestamp', () => {
  // 18:34:21 UTC → bucket "2026050218"
  assert.equal(createHourBucketKey('2026-05-02T18:34:21.523Z'), '2026050218');
  // Top of the hour
  assert.equal(createHourBucketKey('2026-05-02T18:00:00.000Z'), '2026050218');
  // Last second of the hour
  assert.equal(createHourBucketKey('2026-05-02T18:59:59.999Z'), '2026050218');
  // Roll-over into next hour
  assert.equal(createHourBucketKey('2026-05-02T19:00:00.000Z'), '2026050219');
});

test('createHourlyStorefrontRouteId joins storefrontId + bucket key', () => {
  assert.equal(
    createHourlyStorefrontRouteId('shop-coughie', '2026050218'),
    'shop-coughie__2026050218',
  );
});

// ============================================================================
// Loader
// ============================================================================

test('loadRouteStartsForCurrentHour returns empty Map for empty input', async () => {
  const result = await loadRouteStartsForCurrentHour([]);
  assert.equal(result.size, 0);
});

test('loadRouteStartsForCurrentHour returns empty Map when Firebase is not configured', async () => {
  // No Firebase config in the test env → getBackendFirebaseDb returns null.
  const result = await loadRouteStartsForCurrentHour(['shop-1', 'shop-2']);
  assert.equal(result.size, 0);
});

// ============================================================================
// Enrichment helpers (no DB available — fail-soft path)
// ============================================================================

test('attachRouteHeatToSummaries returns input unchanged when no Firebase + no cache', async () => {
  const items = [
    { id: 'shop-1', displayName: 'Shop 1' },
    { id: 'shop-2', displayName: 'Shop 2' },
  ];
  const result = await attachRouteHeatToSummaries(items);
  assert.deepEqual(result, items);
  // No routeStartsPerHour added since loader returns empty Map.
  for (const item of result) {
    assert.equal((item as { routeStartsPerHour?: number }).routeStartsPerHour, undefined);
  }
});

test('attachRouteHeatToSummaries returns input unchanged for empty array', async () => {
  const result = await attachRouteHeatToSummaries([]);
  assert.deepEqual(result, []);
});

test('attachRouteHeatToDetail returns input unchanged when no count available', async () => {
  const detail = { storefrontId: 'shop-1', otherField: 'value' };
  const result = await attachRouteHeatToDetail(detail);
  assert.deepEqual(result, detail);
  assert.equal((result as { routeStartsPerHour?: number }).routeStartsPerHour, undefined);
});

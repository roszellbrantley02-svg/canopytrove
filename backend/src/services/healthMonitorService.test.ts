import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RuntimeMonitoringTargetStatus } from '../../../src/types/runtimeOps';
import {
  assessStorefrontDiscoveryFreshness,
  assessStorefrontGooglePlacesReadiness,
  applyFailureConfirmationThreshold,
  classifyApiTargetHealthState,
  classifyStorefrontReadinessState,
  getAlertingFailureTargets,
  getUpdatedTargetFailureCounts,
} from './healthMonitorService';

function createTarget(
  overrides: Partial<RuntimeMonitoringTargetStatus>
): RuntimeMonitoringTargetStatus {
  return {
    id: overrides.id ?? 'target-1',
    label: overrides.label ?? 'Target',
    url: overrides.url ?? 'https://example.com/health',
    kind: overrides.kind ?? 'api',
    ok: overrides.ok ?? true,
    statusCode:
      Object.prototype.hasOwnProperty.call(overrides, 'statusCode')
        ? overrides.statusCode ?? null
        : 200,
    latencyMs:
      Object.prototype.hasOwnProperty.call(overrides, 'latencyMs')
        ? overrides.latencyMs ?? null
        : 120,
    checkedAt: overrides.checkedAt ?? new Date().toISOString(),
    message: overrides.message ?? (overrides.ok === false ? 'Unavailable.' : 'Healthy.'),
  };
}

test('classifyApiTargetHealthState marks a single-path failure as degraded when another API path stays healthy', () => {
  const result = classifyApiTargetHealthState([
    createTarget({
      id: 'api-health-public',
      label: 'Public API',
      ok: false,
      statusCode: null,
      latencyMs: 12000,
      message: 'Request timed out.',
    }),
    createTarget({
      id: 'api-health-origin',
      label: 'Public API origin',
      ok: true,
    }),
  ]);

  assert.equal(result.state, 'degraded');
  assert.equal(result.failingTargets.length, 1);
  assert.equal(result.healthyTargets.length, 1);
});

test('classifyApiTargetHealthState marks the API as down when every monitored API path fails', () => {
  const result = classifyApiTargetHealthState([
    createTarget({
      id: 'api-health-public',
      ok: false,
      statusCode: null,
      latencyMs: 12000,
      message: 'Request timed out.',
    }),
    createTarget({
      id: 'api-health-origin',
      ok: false,
      statusCode: 503,
      latencyMs: 400,
      message: 'Returned HTTP 503.',
    }),
  ]);

  assert.equal(result.state, 'down');
  assert.equal(result.failingTargets.length, 2);
  assert.equal(result.healthyTargets.length, 0);
});

test('getAlertingFailureTargets suppresses alerts for partial API degradation but still alerts for non-api failures', () => {
  const degradedApiTargets = [
    createTarget({
      id: 'api-health-public',
      ok: false,
      statusCode: null,
      latencyMs: 12000,
      message: 'Request timed out.',
    }),
    createTarget({
      id: 'api-health-origin',
      ok: true,
    }),
  ];

  assert.deepEqual(getAlertingFailureTargets(degradedApiTargets), []);

  const siteFailureTargets = [
    ...degradedApiTargets,
    createTarget({
      id: 'site-homepage',
      label: 'Public Site',
      kind: 'website',
      ok: false,
      statusCode: 502,
      latencyMs: 600,
      message: 'Returned HTTP 502.',
    }),
  ];

  assert.deepEqual(
    getAlertingFailureTargets(siteFailureTargets).map((target) => target.id),
    ['site-homepage']
  );
});

test('getUpdatedTargetFailureCounts increments failing targets and resets recovered targets', () => {
  const result = getUpdatedTargetFailureCounts(
    {
      'api-health-public': 1,
      'site-homepage': 2,
    },
    [
      createTarget({
        id: 'api-health-public',
        ok: false,
        statusCode: null,
        message: 'Request timed out.',
      }),
      createTarget({
        id: 'site-homepage',
        kind: 'website',
        ok: true,
      }),
    ]
  );

  assert.deepEqual(result, {
    'api-health-public': 2,
    'site-homepage': 0,
  });
});

test('applyFailureConfirmationThreshold suppresses a first-time timeout until it repeats on a later sweep', () => {
  const firstSweepFailure = createTarget({
    id: 'api-health-public',
    ok: false,
    statusCode: null,
    latencyMs: 12000,
    message: 'Request timed out.',
  });

  const firstSweepResult = applyFailureConfirmationThreshold(
    [firstSweepFailure],
    { 'api-health-public': 1 }
  );
  assert.equal(firstSweepResult[0].ok, true);
  assert.match(firstSweepResult[0].message, /Pending confirmation/);

  const secondSweepResult = applyFailureConfirmationThreshold(
    [firstSweepFailure],
    { 'api-health-public': 2 }
  );
  assert.equal(secondSweepResult[0].ok, false);
  assert.equal(secondSweepResult[0].message, 'Request timed out.');
});

test('classifyStorefrontReadinessState marks required storefront failures as not ready', () => {
  const result = classifyStorefrontReadinessState([
    {
      ok: true,
      severity: 'required',
    },
    {
      ok: false,
      severity: 'required',
    },
    {
      ok: false,
      severity: 'recommended',
    },
  ]);

  assert.equal(result, 'not_ready');
});

test('classifyStorefrontReadinessState marks storefront warnings as degraded when required checks pass', () => {
  const result = classifyStorefrontReadinessState([
    {
      ok: true,
      severity: 'required',
    },
    {
      ok: false,
      severity: 'recommended',
    },
  ]);

  assert.equal(result, 'degraded');
});

test('assessStorefrontDiscoveryFreshness flags stale discovery runs', () => {
  const staleTimestamp = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString();
  const result = assessStorefrontDiscoveryFreshness({
    configured: true,
    intervalHours: 12,
    lastRunAt: staleTimestamp,
    lastSuccessfulRunAt: staleTimestamp,
  });

  assert.equal(result.ok, false);
  assert.equal(result.state, 'stale');
  assert.match(result.detail, /older than the 18\.0h freshness window/);
});

test('assessStorefrontGooglePlacesReadiness flags missing place coverage as degraded', () => {
  const result = assessStorefrontGooglePlacesReadiness({
    configured: true,
    sampleCount: 3,
    placeIdCoverage: 0,
    probeAttempted: true,
    successfulProbeCount: 0,
  });

  assert.equal(result.ok, false);
  assert.equal(result.state, 'degraded');
  assert.match(result.detail, /no live Google Places probe succeeded/i);
});

test('assessStorefrontGooglePlacesReadiness treats successful probes as healthy even with low published coverage', () => {
  const result = assessStorefrontGooglePlacesReadiness({
    configured: true,
    sampleCount: 3,
    placeIdCoverage: 0,
    probeAttempted: true,
    successfulProbeCount: 1,
  });

  assert.equal(result.ok, true);
  assert.equal(result.state, 'healthy');
  assert.match(result.detail, /succeeded for 1 sampled storefront/i);
});

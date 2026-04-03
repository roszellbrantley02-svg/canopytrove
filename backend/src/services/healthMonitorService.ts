import { getOptionalFirestoreCollection } from '../firestoreCollections';
import { serverConfig } from '../config';
import { backendStorefrontSourceStatus } from '../sources';
import type { StorefrontSummaryApiDocument } from '../types';
import {
  RuntimeMonitoringStatus,
  RuntimeMonitoringTargetKind,
  RuntimeMonitoringTargetStatus,
} from '../../../src/types/runtimeOps';
import type { StorefrontSummaryDocument } from '../../../src/types/firestoreDocuments';
import { notifyRuntimeAlertSubscribers } from './opsAlertSubscriptionService';
import { hasGooglePlacesConfig, getGooglePlacesEnrichment } from './googlePlacesService';
import { recordRuntimeIncident } from './runtimeOpsService';
import { getStorefrontDiscoveryStatus } from './storefrontDiscoveryOrchestrationService';

type ConfiguredMonitoringTarget = {
  id: string;
  label: string;
  url: string;
  kind: RuntimeMonitoringTargetKind;
};

type ApiTargetHealthState = 'unconfigured' | 'healthy' | 'degraded' | 'down';

type ApiTargetHealthAssessment = {
  state: ApiTargetHealthState;
  targets: RuntimeMonitoringTargetStatus[];
  failingTargets: RuntimeMonitoringTargetStatus[];
  healthyTargets: RuntimeMonitoringTargetStatus[];
};

type PersistedMonitoringState = Pick<
  RuntimeMonitoringStatus,
  | 'configured'
  | 'schedulerEnabled'
  | 'intervalMinutes'
  | 'timeoutMs'
  | 'alertWebhookConfigured'
  | 'lastRunAt'
  | 'lastSuccessfulRunAt'
  | 'lastAlertAt'
  | 'overallOk'
  | 'healthyTargetCount'
  | 'failingTargetCount'
  | 'targets'
> & {
  lastAlertFingerprint: string | null;
  targetFailureCounts: Record<string, number>;
};

type StorefrontReadinessSeverity = 'required' | 'recommended';

type StorefrontReadinessCheck = {
  name: string;
  ok: boolean;
  severity: StorefrontReadinessSeverity;
  detail: string;
};

type StorefrontReadinessState = 'ready' | 'degraded' | 'not_ready';
type StorefrontDiscoveryFreshnessState = 'fresh' | 'stale' | 'unknown';
type StorefrontGooglePlacesState = 'healthy' | 'degraded' | 'unconfigured' | 'unknown';

type StorefrontReadinessStatus = {
  ok: boolean;
  state: StorefrontReadinessState;
  checkedAt: string;
  source: {
    requestedMode: string;
    activeMode: string;
    fallbackReason: string | null;
  };
  summaries: {
    sampleSize: number;
    minimumRequired: number;
    availableCount: number;
    sampleIds: string[];
    placeIdCoverage: number;
    menuUrlCoverage: number;
    thumbnailCoverage: number;
    openNowTrueCount: number;
    zeroReviewCountCount: number;
    source: 'firestore' | 'unavailable';
    error: string | null;
  };
  discovery: {
    configured: boolean;
    schedulerEnabled: boolean;
    intervalHours: number | null;
    lastRunAt: string | null;
    lastSuccessfulRunAt: string | null;
    nextRunAt: string | null;
    latestRunStatus: string | null;
    publishedCount: number | null;
    readyForPublishCount: number | null;
    freshnessState: StorefrontDiscoveryFreshnessState;
    ageHours: number | null;
    error: string | null;
  };
  googlePlaces: {
    configured: boolean;
    state: StorefrontGooglePlacesState;
    placeIdCoverage: number;
    probeAttempted: boolean;
    probeCandidateCount: number;
    successfulProbeCount: number;
    detail: string;
  };
  checks: StorefrontReadinessCheck[];
};

type StorefrontReadinessOptions = {
  sampleSize?: number;
  minimumSummaryCount?: number;
  probeGooglePlaces?: boolean;
  googleProbeCount?: number;
  timeoutMs?: number;
};

const RUNTIME_MONITORING_COLLECTION = 'ops_runtime_monitoring';
const RUNTIME_MONITORING_DOC_ID = 'current';
const STOREFRONT_SUMMARY_COLLECTION = 'storefront_summaries';
const STOREFRONT_READINESS_SAMPLE_SIZE = 6;
const STOREFRONT_READINESS_MIN_SUMMARY_COUNT = 3;
const STOREFRONT_READINESS_TIMEOUT_MS = 2_500;
const STOREFRONT_READINESS_GOOGLE_PROBE_COUNT = 2;
const STOREFRONT_DISCOVERY_STALE_MULTIPLIER = 1.5;

const monitoringStateStore: PersistedMonitoringState = {
  configured: false,
  schedulerEnabled: false,
  intervalMinutes: serverConfig.opsHealthcheckIntervalMinutes,
  timeoutMs: serverConfig.opsHealthcheckTimeoutMs,
  alertWebhookConfigured: Boolean(serverConfig.opsAlertWebhookUrl),
  lastRunAt: null,
  lastSuccessfulRunAt: null,
  lastAlertAt: null,
  lastAlertFingerprint: null,
  overallOk: null,
  healthyTargetCount: 0,
  failingTargetCount: 0,
  targets: [],
  targetFailureCounts: {},
};

let healthSweepInFlight: Promise<RuntimeMonitoringStatus> | null = null;
let schedulerHandle: ReturnType<typeof setInterval> | null = null;
let schedulerStarted = false;

function getNowIso() {
  return new Date().toISOString();
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function withTimeoutOrThrow<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function normalizeUrl(value: string | null) {
  return value?.trim().replace(/\/+$/, '') || null;
}

function getConfiguredTargets(): ConfiguredMonitoringTarget[] {
  const targets: ConfiguredMonitoringTarget[] = [];
  const apiUrl = normalizeUrl(serverConfig.opsHealthcheckApiUrl);
  const apiRawUrl = normalizeUrl(serverConfig.opsHealthcheckApiRawUrl);
  const siteUrl = normalizeUrl(serverConfig.opsHealthcheckSiteUrl);

  if (apiUrl) {
    targets.push({
      id: 'api-health-public',
      label: 'Public API',
      url: apiUrl,
      kind: 'api',
    });
  }

  if (apiRawUrl) {
    targets.push({
      id: 'api-health-origin',
      label: 'Public API origin',
      url: apiRawUrl,
      kind: 'api',
    });
  }

  if (siteUrl) {
    targets.push({
      id: 'site-homepage',
      label: 'Public Site',
      url: siteUrl,
      kind: 'website',
    });
  }

  return targets;
}

function hasConfiguredTargets() {
  return getConfiguredTargets().length > 0;
}

function roundCoverageRatio(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return 0;
  }

  return Math.round((numerator / denominator) * 1000) / 1000;
}

function toStorefrontSummaryApiDocument(
  storefrontId: string,
  document: StorefrontSummaryDocument
): StorefrontSummaryApiDocument {
  return {
    id: storefrontId,
    licenseId: document.licenseId,
    marketId: document.marketId,
    displayName: document.displayName,
    legalName: document.legalName,
    addressLine1: document.addressLine1,
    city: document.city,
    state: document.state,
    zip: document.zip,
    latitude: document.latitude,
    longitude: document.longitude,
    distanceMiles: document.distanceMiles,
    travelMinutes: document.travelMinutes,
    rating: document.rating,
    reviewCount: document.reviewCount,
    openNow: document.openNow,
    isVerified: document.isVerified,
    mapPreviewLabel: document.mapPreviewLabel,
    promotionText: document.promotionText ?? null,
    promotionBadges: document.promotionBadges ?? [],
    promotionExpiresAt: document.promotionExpiresAt ?? null,
    activePromotionId: document.activePromotionId ?? null,
    activePromotionCount: document.activePromotionCount ?? null,
    favoriteFollowerCount: document.favoriteFollowerCount ?? null,
    menuUrl: document.menuUrl ?? null,
    verifiedOwnerBadgeLabel: document.verifiedOwnerBadgeLabel ?? null,
    ownerFeaturedBadges: document.ownerFeaturedBadges ?? [],
    ownerCardSummary: document.ownerCardSummary ?? null,
    premiumCardVariant: document.premiumCardVariant ?? 'standard',
    promotionPlacementSurfaces: document.promotionPlacementSurfaces ?? [],
    promotionPlacementScope: document.promotionPlacementScope ?? null,
    placeId: document.placeId,
    thumbnailUrl: document.thumbnailUrl ?? null,
  };
}

type StorefrontDiscoveryFreshnessAssessment = {
  ok: boolean;
  state: StorefrontDiscoveryFreshnessState;
  ageHours: number | null;
  detail: string;
};

export function assessStorefrontDiscoveryFreshness(input: {
  configured: boolean;
  intervalHours: number | null;
  lastRunAt: string | null;
  lastSuccessfulRunAt: string | null;
}) {
  if (!input.configured) {
    return {
      ok: false,
      state: 'unknown',
      ageHours: null,
      detail: 'Storefront discovery is not configured.',
    } satisfies StorefrontDiscoveryFreshnessAssessment;
  }

  const referenceTimestamp = input.lastSuccessfulRunAt ?? input.lastRunAt;
  if (!referenceTimestamp || !input.intervalHours) {
    return {
      ok: false,
      state: 'unknown',
      ageHours: null,
      detail: 'Storefront discovery has not completed a recent run yet.',
    } satisfies StorefrontDiscoveryFreshnessAssessment;
  }

  const ageHours = (Date.now() - Date.parse(referenceTimestamp)) / 3_600_000;
  if (!Number.isFinite(ageHours)) {
    return {
      ok: false,
      state: 'unknown',
      ageHours: null,
      detail: 'Storefront discovery freshness could not be calculated.',
    } satisfies StorefrontDiscoveryFreshnessAssessment;
  }

  const staleThresholdHours = Math.max(input.intervalHours * STOREFRONT_DISCOVERY_STALE_MULTIPLIER, 1);
  if (ageHours > staleThresholdHours) {
    return {
      ok: false,
      state: 'stale',
      ageHours,
      detail: `Last successful discovery refresh was ${ageHours.toFixed(1)}h ago, which is older than the ${staleThresholdHours.toFixed(1)}h freshness window.`,
    } satisfies StorefrontDiscoveryFreshnessAssessment;
  }

  return {
    ok: true,
    state: 'fresh',
    ageHours,
    detail: `Last successful discovery refresh was ${ageHours.toFixed(1)}h ago.`,
  } satisfies StorefrontDiscoveryFreshnessAssessment;
}

type StorefrontGooglePlacesAssessment = {
  ok: boolean;
  state: StorefrontGooglePlacesState;
  detail: string;
};

export function assessStorefrontGooglePlacesReadiness(input: {
  configured: boolean;
  sampleCount: number;
  placeIdCoverage: number;
  probeAttempted: boolean;
  successfulProbeCount: number;
}) {
  if (!input.configured) {
    return {
      ok: false,
      state: 'unconfigured',
      detail: 'GOOGLE_MAPS_API_KEY is not configured for storefront enrichment.',
    } satisfies StorefrontGooglePlacesAssessment;
  }

  if (input.sampleCount <= 0) {
    return {
      ok: false,
      state: 'unknown',
      detail: 'No published storefront summaries were available for a Google Places readiness sample.',
    } satisfies StorefrontGooglePlacesAssessment;
  }

  if (input.placeIdCoverage >= 0.5 || input.successfulProbeCount > 0) {
    return {
      ok: true,
      state: 'healthy',
      detail:
        input.successfulProbeCount > 0
          ? `Google Places enrichment succeeded for ${input.successfulProbeCount} sampled storefront${input.successfulProbeCount === 1 ? '' : 's'}.`
          : `Google Places place IDs are present on ${(input.placeIdCoverage * 100).toFixed(0)}% of sampled storefront summaries.`,
    } satisfies StorefrontGooglePlacesAssessment;
  }

  return {
    ok: false,
    state: 'degraded',
    detail:
      input.probeAttempted
        ? `Only ${(input.placeIdCoverage * 100).toFixed(0)}% of sampled storefront summaries have place IDs, and no live Google Places probe succeeded. Summary open/closed state may be stale.`
        : `Only ${(input.placeIdCoverage * 100).toFixed(0)}% of sampled storefront summaries have place IDs. Summary open/closed state may be stale.`,
  } satisfies StorefrontGooglePlacesAssessment;
}

export function classifyStorefrontReadinessState(
  checks: Array<Pick<StorefrontReadinessCheck, 'ok' | 'severity'>>
): StorefrontReadinessState {
  if (checks.some((check) => check.severity === 'required' && !check.ok)) {
    return 'not_ready';
  }

  if (checks.some((check) => check.severity === 'recommended' && !check.ok)) {
    return 'degraded';
  }

  return 'ready';
}

export async function getStorefrontReadinessStatus(
  options?: StorefrontReadinessOptions
): Promise<StorefrontReadinessStatus> {
  const sampleSize = Math.max(options?.sampleSize ?? STOREFRONT_READINESS_SAMPLE_SIZE, 1);
  const minimumSummaryCount = Math.max(
    options?.minimumSummaryCount ?? STOREFRONT_READINESS_MIN_SUMMARY_COUNT,
    1
  );
  const timeoutMs = Math.max(options?.timeoutMs ?? STOREFRONT_READINESS_TIMEOUT_MS, 250);
  const probeGooglePlaces = options?.probeGooglePlaces !== false;
  const googleProbeCount = Math.max(
    options?.googleProbeCount ?? STOREFRONT_READINESS_GOOGLE_PROBE_COUNT,
    0
  );
  const checks: StorefrontReadinessCheck[] = [];
  const pushCheck = (
    name: string,
    ok: boolean,
    detail: string,
    severity: StorefrontReadinessSeverity = 'required'
  ) => {
    checks.push({
      name,
      ok,
      detail,
      severity,
    });
  };

  const summaryCollection = getOptionalFirestoreCollection<StorefrontSummaryDocument>(
    STOREFRONT_SUMMARY_COLLECTION
  );
  let summaryDocuments: Array<{ id: string; data: StorefrontSummaryDocument }> = [];
  let summaryError: string | null = null;

  if (summaryCollection) {
    try {
      const snapshot = await withTimeoutOrThrow(
        summaryCollection.limit(sampleSize).get(),
        timeoutMs,
        'Published storefront summary sample'
      );
      summaryDocuments = snapshot.docs.map((documentSnapshot) => ({
        id: documentSnapshot.id,
        data: documentSnapshot.data(),
      }));
    } catch (error) {
      summaryError = error instanceof Error ? error.message : 'Unable to read storefront summaries.';
    }
  } else {
    summaryError =
      backendStorefrontSourceStatus.activeMode !== 'firestore'
        ? `Published storefront summaries are unavailable because the active backend source is ${backendStorefrontSourceStatus.activeMode}.`
        : 'Published storefront summaries are unavailable because Firestore admin access is not configured.';
  }

  const availableCount = summaryDocuments.length;
  const sampleIds = summaryDocuments.map((item) => item.id);
  const placeIdCount = summaryDocuments.filter((item) => Boolean(item.data.placeId?.trim())).length;
  const menuUrlCount = summaryDocuments.filter((item) => Boolean(item.data.menuUrl?.trim())).length;
  const thumbnailCount = summaryDocuments.filter((item) => Boolean(item.data.thumbnailUrl?.trim())).length;
  const openNowTrueCount = summaryDocuments.filter((item) => item.data.openNow === true).length;
  const zeroReviewCountCount = summaryDocuments.filter((item) => item.data.reviewCount === 0).length;
  const placeIdCoverage = roundCoverageRatio(placeIdCount, availableCount);
  const menuUrlCoverage = roundCoverageRatio(menuUrlCount, availableCount);
  const thumbnailCoverage = roundCoverageRatio(thumbnailCount, availableCount);

  pushCheck(
    'Storefront source mode',
    backendStorefrontSourceStatus.activeMode === 'firestore',
    backendStorefrontSourceStatus.activeMode === 'firestore'
      ? 'Firestore is the active storefront backend source.'
      : `Storefront backend is currently serving ${backendStorefrontSourceStatus.activeMode} data. ${backendStorefrontSourceStatus.fallbackReason ?? 'Check backend Firebase config.'}`
  );
  pushCheck(
    'Published storefront summary availability',
    availableCount >= minimumSummaryCount,
    availableCount >= minimumSummaryCount
      ? `Published storefront summary sample returned ${availableCount} document${availableCount === 1 ? '' : 's'}.`
      : summaryError
        ? summaryError
        : `Only ${availableCount} published storefront summary document${availableCount === 1 ? '' : 's'} were available; need at least ${minimumSummaryCount}.`
  );

  let discoveryConfigured = false;
  let discoverySchedulerEnabled = false;
  let discoveryIntervalHours: number | null = null;
  let discoveryLastRunAt: string | null = null;
  let discoveryLastSuccessfulRunAt: string | null = null;
  let discoveryNextRunAt: string | null = null;
  let discoveryLatestRunStatus: string | null = null;
  let discoveryPublishedCount: number | null = null;
  let discoveryReadyForPublishCount: number | null = null;
  let discoveryError: string | null = null;

  try {
    const discoveryStatus = await withTimeoutOrThrow(
      getStorefrontDiscoveryStatus(),
      timeoutMs,
      'Storefront discovery status'
    );
    discoveryConfigured = discoveryStatus.configured;
    discoverySchedulerEnabled = discoveryStatus.schedulerEnabled;
    discoveryIntervalHours = discoveryStatus.intervalHours;
    discoveryLastRunAt = discoveryStatus.state.lastRunAt;
    discoveryLastSuccessfulRunAt = discoveryStatus.state.lastSuccessfulRunAt;
    discoveryNextRunAt = discoveryStatus.nextRunAt;
    discoveryLatestRunStatus = discoveryStatus.latestRun?.status ?? discoveryStatus.state.lastRunStatus;
    discoveryPublishedCount = discoveryStatus.state.publishedCount;
    discoveryReadyForPublishCount = discoveryStatus.state.readyForPublishCount;
  } catch (error) {
    discoveryError =
      error instanceof Error ? error.message : 'Storefront discovery readiness could not be loaded.';
  }

  const discoveryFreshness = assessStorefrontDiscoveryFreshness({
    configured: discoveryConfigured,
    intervalHours: discoveryIntervalHours,
    lastRunAt: discoveryLastRunAt,
    lastSuccessfulRunAt: discoveryLastSuccessfulRunAt,
  });

  pushCheck(
    'Storefront discovery freshness',
    discoveryFreshness.ok,
    discoveryError ?? discoveryFreshness.detail,
    'recommended'
  );

  let probeAttempted = false;
  let successfulProbeCount = 0;
  const googleConfigured = hasGooglePlacesConfig();
  if (googleConfigured && probeGooglePlaces && summaryDocuments.length > 0 && googleProbeCount > 0) {
    const probeCandidates = summaryDocuments
      .slice(0, Math.min(summaryDocuments.length, googleProbeCount))
      .map(({ id, data }) => toStorefrontSummaryApiDocument(id, data));
    probeAttempted = probeCandidates.length > 0;
    const probeResults = await Promise.allSettled(
      probeCandidates.map((summary) =>
        withTimeoutOrThrow(
          getGooglePlacesEnrichment(summary),
          timeoutMs,
          `Google Places readiness probe for ${summary.id}`
        )
      )
    );
    successfulProbeCount = probeResults.filter(
      (result) => result.status === 'fulfilled' && Boolean(result.value)
    ).length;
  }

  const googlePlacesAssessment = assessStorefrontGooglePlacesReadiness({
    configured: googleConfigured,
    sampleCount: availableCount,
    placeIdCoverage,
    probeAttempted,
    successfulProbeCount,
  });
  pushCheck(
    'Storefront Google Places enrichment',
    googlePlacesAssessment.ok,
    googlePlacesAssessment.detail,
    'recommended'
  );

  const state = classifyStorefrontReadinessState(checks);

  return {
    ok: state !== 'not_ready',
    state,
    checkedAt: getNowIso(),
    source: {
      requestedMode: backendStorefrontSourceStatus.requestedMode,
      activeMode: backendStorefrontSourceStatus.activeMode,
      fallbackReason: backendStorefrontSourceStatus.fallbackReason ?? null,
    },
    summaries: {
      sampleSize,
      minimumRequired: minimumSummaryCount,
      availableCount,
      sampleIds,
      placeIdCoverage,
      menuUrlCoverage,
      thumbnailCoverage,
      openNowTrueCount,
      zeroReviewCountCount,
      source: summaryCollection ? 'firestore' : 'unavailable',
      error: summaryError,
    },
    discovery: {
      configured: discoveryConfigured,
      schedulerEnabled: discoverySchedulerEnabled,
      intervalHours: discoveryIntervalHours,
      lastRunAt: discoveryLastRunAt,
      lastSuccessfulRunAt: discoveryLastSuccessfulRunAt,
      nextRunAt: discoveryNextRunAt,
      latestRunStatus: discoveryLatestRunStatus,
      publishedCount: discoveryPublishedCount,
      readyForPublishCount: discoveryReadyForPublishCount,
      freshnessState: discoveryError ? 'unknown' : discoveryFreshness.state,
      ageHours: discoveryFreshness.ageHours,
      error: discoveryError,
    },
    googlePlaces: {
      configured: googleConfigured,
      state: googlePlacesAssessment.state,
      placeIdCoverage,
      probeAttempted,
      probeCandidateCount: probeAttempted ? Math.min(summaryDocuments.length, googleProbeCount) : 0,
      successfulProbeCount,
      detail: googlePlacesAssessment.detail,
    },
    checks,
  };
}

function createDefaultMonitoringStatus(): RuntimeMonitoringStatus {
  return {
    configured: hasConfiguredTargets(),
    schedulerEnabled: serverConfig.opsHealthcheckEnabled && hasConfiguredTargets(),
    intervalMinutes: serverConfig.opsHealthcheckIntervalMinutes,
    timeoutMs: serverConfig.opsHealthcheckTimeoutMs,
    alertWebhookConfigured: Boolean(serverConfig.opsAlertWebhookUrl),
    lastRunAt: monitoringStateStore.lastRunAt,
    lastSuccessfulRunAt: monitoringStateStore.lastSuccessfulRunAt,
    lastAlertAt: monitoringStateStore.lastAlertAt,
    overallOk: monitoringStateStore.overallOk,
    healthyTargetCount: monitoringStateStore.healthyTargetCount,
    failingTargetCount: monitoringStateStore.failingTargetCount,
    targets: monitoringStateStore.targets,
  };
}

function getRuntimeMonitoringCollection() {
  return getOptionalFirestoreCollection<PersistedMonitoringState>(RUNTIME_MONITORING_COLLECTION);
}

async function loadPersistedMonitoringState() {
  const collectionRef = getRuntimeMonitoringCollection();
  if (!collectionRef) {
    return monitoringStateStore;
  }

  const snapshot = await collectionRef.doc(RUNTIME_MONITORING_DOC_ID).get();
  if (!snapshot.exists) {
    return monitoringStateStore;
  }

  return {
    ...monitoringStateStore,
    ...(snapshot.data() as PersistedMonitoringState),
  };
}

async function persistMonitoringState(state: PersistedMonitoringState) {
  Object.assign(monitoringStateStore, state);

  const collectionRef = getRuntimeMonitoringCollection();
  if (!collectionRef) {
    return state;
  }

  await collectionRef.doc(RUNTIME_MONITORING_DOC_ID).set(state);
  return state;
}

function formatAlertWebhookText(payload: Record<string, unknown>) {
  const type = typeof payload.type === 'string' ? payload.type : 'canopytrove.runtime.health';
  const targets = Array.isArray(payload.targets)
    ? (payload.targets as RuntimeMonitoringTargetStatus[])
    : [];

  if (type === 'canopytrove.runtime.health.failure') {
    const failingTargetCount =
      typeof payload.failingTargetCount === 'number'
        ? payload.failingTargetCount
        : targets.filter((target) => !target.ok).length;
    const targetSummary = targets
      .filter((target) => !target.ok)
      .map((target) => `- ${target.label}: ${target.message}`)
      .join('\n');

    return [
      `Canopy Trove health alert: ${failingTargetCount} target${failingTargetCount === 1 ? '' : 's'} failing.`,
      targetSummary || '- A monitored target is failing health checks.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (type === 'canopytrove.runtime.health.recovery') {
    return 'Canopy Trove recovered: monitored site and API targets are responding again.';
  }

  return 'Canopy Trove runtime alert.';
}

function createAlertWebhookRequest(
  webhookUrl: string,
  payload: Record<string, unknown>
): { headers: Record<string, string>; body: string } {
  let host = '';
  try {
    host = new URL(webhookUrl).host.toLowerCase();
  } catch {
    host = '';
  }

  const text = formatAlertWebhookText(payload);

  if (host.includes('discord.com') || host.includes('discordapp.com')) {
    return {
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: text,
      }),
    };
  }

  if (host.includes('slack.com') || host.includes('chat.googleapis.com')) {
    return {
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
      }),
    };
  }

  return {
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  };
}

async function postAlertWebhook(payload: Record<string, unknown>) {
  const webhookUrl = serverConfig.opsAlertWebhookUrl?.trim();
  if (!webhookUrl) {
    return false;
  }

  try {
    const request = createAlertWebhookRequest(webhookUrl, payload);
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: request.headers,
      body: request.body,
    });

    return response.ok;
  } catch {
    return false;
  }
}

function createFailureFingerprint(targets: RuntimeMonitoringTargetStatus[]) {
  return targets
    .filter((target) => !target.ok)
    .map((target) => `${target.id}:${target.statusCode ?? 'down'}`)
    .sort()
    .join('|');
}

export function getUpdatedTargetFailureCounts(
  previousCounts: Record<string, number>,
  targets: RuntimeMonitoringTargetStatus[]
) {
  const nextCounts: Record<string, number> = {};

  for (const target of targets) {
    nextCounts[target.id] = target.ok ? 0 : (previousCounts[target.id] ?? 0) + 1;
  }

  return nextCounts;
}

export function applyFailureConfirmationThreshold(
  targets: RuntimeMonitoringTargetStatus[],
  targetFailureCounts: Record<string, number>
) {
  const requiredSweeps = Math.max(serverConfig.opsHealthcheckFailureConfirmationSweeps, 1);

  return targets.map((target) => {
    if (target.ok) {
      return target;
    }

    const failureCount = targetFailureCounts[target.id] ?? 0;
    if (failureCount >= requiredSweeps) {
      return target;
    }

    return {
      ...target,
      ok: true,
      message: `${target.message} Pending confirmation (${failureCount}/${requiredSweeps}).`,
    } satisfies RuntimeMonitoringTargetStatus;
  });
}

function getApiTargets(targets: RuntimeMonitoringTargetStatus[]) {
  return targets.filter((target) => target.kind === 'api');
}

export function classifyApiTargetHealthState(
  targets: RuntimeMonitoringTargetStatus[]
): ApiTargetHealthAssessment {
  const apiTargets = getApiTargets(targets);
  const failingTargets = apiTargets.filter((target) => !target.ok);
  const healthyTargets = apiTargets.filter((target) => target.ok);

  if (!apiTargets.length) {
    return {
      state: 'unconfigured',
      targets: [],
      failingTargets: [],
      healthyTargets: [],
    };
  }

  if (failingTargets.length === 0) {
    return {
      state: 'healthy',
      targets: apiTargets,
      failingTargets,
      healthyTargets,
    };
  }

  if (healthyTargets.length === 0) {
    return {
      state: 'down',
      targets: apiTargets,
      failingTargets,
      healthyTargets,
    };
  }

  return {
    state: 'degraded',
    targets: apiTargets,
    failingTargets,
    healthyTargets,
  };
}

export function getAlertingFailureTargets(targets: RuntimeMonitoringTargetStatus[]) {
  const apiAssessment = classifyApiTargetHealthState(targets);
  const nonApiFailingTargets = targets.filter((target) => target.kind !== 'api' && !target.ok);

  if (apiAssessment.state === 'down') {
    return [...apiAssessment.failingTargets, ...nonApiFailingTargets];
  }

  return nonApiFailingTargets;
}

function getApiTransitionMessage(
  previousAssessment: ApiTargetHealthAssessment,
  nextAssessment: ApiTargetHealthAssessment
) {
  if (nextAssessment.state === 'down') {
    return {
      severity: 'critical' as const,
      message: 'Public API is unavailable.',
    };
  }

  if (nextAssessment.state === 'degraded') {
    if (previousAssessment.state === 'down') {
      return {
        severity: 'info' as const,
        message: 'Public API partially recovered, but one monitored API path is still degraded.',
      };
    }

    return {
      severity: 'warning' as const,
      message: 'Public API is degraded on one monitored API path.',
    };
  }

  if (
    nextAssessment.state === 'healthy' &&
    (previousAssessment.state === 'down' || previousAssessment.state === 'degraded')
  ) {
    return {
      severity: 'info' as const,
      message: 'Public API recovered.',
    };
  }

  return null;
}

function createFailedTargetStatus(
  target: ConfiguredMonitoringTarget,
  error: unknown
): RuntimeMonitoringTargetStatus {
  return {
    id: target.id,
    label: target.label,
    url: target.url,
    kind: target.kind,
    ok: false,
    statusCode: null,
    latencyMs: null,
    checkedAt: getNowIso(),
    message: error instanceof Error ? error.message : 'Health evaluation failed.',
  };
}

function shouldSendFailureAlert(
  previousState: PersistedMonitoringState,
  nextAlertingTargets: RuntimeMonitoringTargetStatus[]
) {
  if (!serverConfig.opsAlertWebhookUrl || nextAlertingTargets.length === 0) {
    return false;
  }

  const nextFingerprint = createFailureFingerprint(nextAlertingTargets);
  if (!previousState.lastAlertFingerprint || previousState.lastAlertFingerprint !== nextFingerprint) {
    return true;
  }

  if (!previousState.lastAlertAt) {
    return true;
  }

  const elapsedMs = Date.now() - Date.parse(previousState.lastAlertAt);
  return elapsedMs >= serverConfig.opsAlertCooldownMinutes * 60_000;
}

function shouldSendRecoveryAlert(
  previousState: PersistedMonitoringState,
  nextAlertingTargets: RuntimeMonitoringTargetStatus[]
) {
  return (
    Boolean(serverConfig.opsAlertWebhookUrl) &&
    Boolean(previousState.lastAlertFingerprint) &&
    nextAlertingTargets.length === 0
  );
}

async function evaluateTargetOnce(
  target: ConfiguredMonitoringTarget
): Promise<RuntimeMonitoringTargetStatus> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, serverConfig.opsHealthcheckTimeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(target.url, {
      method: 'GET',
      headers: {
        'user-agent': 'canopytrove-runtime-monitor/1.0',
      },
      signal: controller.signal,
    });

    let ok = response.ok;
    let message = response.ok ? 'Healthy.' : `Returned HTTP ${response.status}.`;
    if (target.kind === 'api' && response.ok) {
      try {
        const payload = (await response.json()) as { ok?: boolean };
        if (payload.ok === false) {
          ok = false;
          message = 'Health endpoint responded with ok=false.';
        }
      } catch {
        message = 'Healthy HTTP response.';
      }
    }

    return {
      id: target.id,
      label: target.label,
      url: target.url,
      kind: target.kind,
      ok,
      statusCode: response.status,
      latencyMs: Date.now() - startedAt,
      checkedAt: getNowIso(),
      message,
    };
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? 'Request timed out.'
        : error instanceof Error
          ? error.message
          : 'Unable to reach target.';

    return {
      id: target.id,
      label: target.label,
      url: target.url,
      kind: target.kind,
      ok: false,
      statusCode: null,
      latencyMs: Date.now() - startedAt,
      checkedAt: getNowIso(),
      message,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function evaluateTarget(target: ConfiguredMonitoringTarget): Promise<RuntimeMonitoringTargetStatus> {
  const retryCount = Math.max(serverConfig.opsHealthcheckFailureRetryCount, 0);
  const retryDelayMs = Math.max(serverConfig.opsHealthcheckFailureRetryDelayMs, 0);
  let lastResult = await evaluateTargetOnce(target);

  for (let attempt = 0; attempt < retryCount && !lastResult.ok; attempt += 1) {
    if (retryDelayMs > 0) {
      await delay(retryDelayMs);
    }

    lastResult = await evaluateTargetOnce(target);
  }

  return lastResult;
}

async function emitTransitionIncidents(
  previousState: PersistedMonitoringState,
  nextTargets: RuntimeMonitoringTargetStatus[],
  nextTargetFailureCounts: Record<string, number>
) {
  const previousTargets = applyFailureConfirmationThreshold(
    previousState.targets,
    previousState.targetFailureCounts
  );
  const confirmedNextTargets = applyFailureConfirmationThreshold(nextTargets, nextTargetFailureCounts);
  const previousTargetsById = new Map(previousTargets.map((target) => [target.id, target]));
  const previousApiAssessment = classifyApiTargetHealthState(previousTargets);
  const nextApiAssessment = classifyApiTargetHealthState(confirmedNextTargets);
  const nextApiTransition = getApiTransitionMessage(previousApiAssessment, nextApiAssessment);

  const incidentResults = await Promise.allSettled(
    confirmedNextTargets.map(async (target) => {
      if (target.kind === 'api') {
        return;
      }

      const previousTarget = previousTargetsById.get(target.id);
      const transitionedToFail = !target.ok && (!previousTarget || previousTarget.ok);
      const transitionedToHealthy = target.ok && previousTarget && !previousTarget.ok;

      if (transitionedToFail) {
        await recordRuntimeIncident({
          kind: 'ops',
          severity: 'warning',
          source: 'health-monitor',
          message: `${target.label} is unavailable.`,
          path: target.url,
          metadata: {
            targetId: target.id,
            statusCode: target.statusCode,
            latencyMs: target.latencyMs,
            message: target.message,
          },
        });
      }

      if (transitionedToHealthy) {
        await recordRuntimeIncident({
          kind: 'ops',
          severity: 'info',
          source: 'health-monitor',
          message: `${target.label} recovered.`,
          path: target.url,
          metadata: {
            targetId: target.id,
            statusCode: target.statusCode,
            latencyMs: target.latencyMs,
            message: target.message,
          },
        });
      }
    })
  );
  incidentResults.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.warn(
        `[healthMonitorService] failed to emit transition incident for ${confirmedNextTargets[index]?.id ?? 'unknown'}:`,
        result.reason
      );
    }
  });

  if (!nextApiTransition) {
    return;
  }

  const focusTarget = nextApiAssessment.failingTargets[0] ?? nextApiAssessment.targets[0] ?? null;
  await recordRuntimeIncident({
    kind: 'ops',
    severity: nextApiTransition.severity,
    source: 'health-monitor',
    message: nextApiTransition.message,
    path: focusTarget?.url ?? null,
    metadata: {
      apiState: nextApiAssessment.state,
      failingTargetCount: nextApiAssessment.failingTargets.length,
      healthyTargetCount: nextApiAssessment.healthyTargets.length,
      failingTargetIds: nextApiAssessment.failingTargets.map((target) => target.id).join(','),
      healthyTargetIds: nextApiAssessment.healthyTargets.map((target) => target.id).join(','),
    },
  });
}

export async function getRuntimeMonitoringStatus() {
  const persistedState = await loadPersistedMonitoringState();
  return {
    ...createDefaultMonitoringStatus(),
    ...persistedState,
  };
}

export async function runRuntimeHealthSweep(options?: { reason?: string }) {
  if (healthSweepInFlight) {
    return healthSweepInFlight;
  }

  const request = (async () => {
    const targets = getConfiguredTargets();
    const previousState = await loadPersistedMonitoringState();

    if (!targets.length) {
      const nextState: PersistedMonitoringState = {
        ...previousState,
        configured: false,
        schedulerEnabled: false,
        intervalMinutes: serverConfig.opsHealthcheckIntervalMinutes,
        timeoutMs: serverConfig.opsHealthcheckTimeoutMs,
        alertWebhookConfigured: Boolean(serverConfig.opsAlertWebhookUrl),
        lastRunAt: getNowIso(),
        overallOk: null,
        healthyTargetCount: 0,
        failingTargetCount: 0,
        targets: [],
        targetFailureCounts: {},
      };
      await persistMonitoringState(nextState);
      return getRuntimeMonitoringStatus();
    }

    const settledTargetStatuses = await Promise.allSettled(
      targets.map((target) => evaluateTarget(target))
    );
    const targetStatuses = settledTargetStatuses.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }

      const target = targets[index];
      console.warn(
        `[healthMonitorService] failed to evaluate target ${target?.id ?? 'unknown'}:`,
        result.reason
      );
      return createFailedTargetStatus(target, result.reason);
    });
    const nextTargetFailureCounts = getUpdatedTargetFailureCounts(
      previousState.targetFailureCounts,
      targetStatuses
    );
    const confirmedTargetStatuses = applyFailureConfirmationThreshold(
      targetStatuses,
      nextTargetFailureCounts
    );
    const failingTargets = confirmedTargetStatuses.filter((target) => !target.ok);
    const alertingTargets = getAlertingFailureTargets(confirmedTargetStatuses);
    const apiAssessment = classifyApiTargetHealthState(confirmedTargetStatuses);
    const overallOk = failingTargets.length === 0;
    const nowIso = getNowIso();

    await emitTransitionIncidents(previousState, targetStatuses, nextTargetFailureCounts);

    let nextState: PersistedMonitoringState = {
      ...previousState,
      configured: true,
      schedulerEnabled: serverConfig.opsHealthcheckEnabled,
      intervalMinutes: serverConfig.opsHealthcheckIntervalMinutes,
      timeoutMs: serverConfig.opsHealthcheckTimeoutMs,
      alertWebhookConfigured: Boolean(serverConfig.opsAlertWebhookUrl),
      lastRunAt: nowIso,
      lastSuccessfulRunAt: overallOk ? nowIso : previousState.lastSuccessfulRunAt,
      overallOk,
      healthyTargetCount: confirmedTargetStatuses.length - failingTargets.length,
      failingTargetCount: failingTargets.length,
      targets: confirmedTargetStatuses,
      targetFailureCounts: nextTargetFailureCounts,
    };

    if (shouldSendFailureAlert(previousState, alertingTargets)) {
      const fingerprint = createFailureFingerprint(alertingTargets);
      const didSendAlert = await postAlertWebhook({
        type: 'canopytrove.runtime.health.failure',
        reason: options?.reason ?? 'scheduled',
        sentAt: nowIso,
        failingTargetCount: alertingTargets.length,
        overallFailingTargetCount: failingTargets.length,
        apiState: apiAssessment.state,
        targets: alertingTargets,
      });
      await notifyRuntimeAlertSubscribers({
        title: 'Canopy Trove health alert',
        body:
          apiAssessment.state === 'down' && alertingTargets.every((target) => target.kind === 'api')
            ? 'Public API is failing health checks across every monitored API path.'
            : alertingTargets.length === 1
              ? `${alertingTargets[0].label} is failing health checks.`
              : `${alertingTargets.length} Canopy Trove targets are failing health checks.`,
        data: {
          alertType: 'health_failure',
          failingTargetCount: String(alertingTargets.length),
        apiState: apiAssessment.state,
      },
      fingerprint: `runtime-health-failure:${fingerprint}`,
      });
      if (didSendAlert) {
        nextState = {
          ...nextState,
          lastAlertAt: nowIso,
          lastAlertFingerprint: fingerprint,
        };
      }
    } else if (shouldSendRecoveryAlert(previousState, alertingTargets)) {
      const didSendRecoveryAlert = await postAlertWebhook({
        type: 'canopytrove.runtime.health.recovery',
        reason: options?.reason ?? 'scheduled',
        sentAt: nowIso,
        targets: targetStatuses,
      });
      await notifyRuntimeAlertSubscribers({
        title: 'Canopy Trove recovered',
        body: 'The monitored site and API targets recovered and are responding again.',
        data: {
          alertType: 'health_recovery',
        },
        fingerprint: 'runtime-health-recovery',
      });
      if (didSendRecoveryAlert) {
        nextState = {
          ...nextState,
          lastAlertAt: nowIso,
          lastAlertFingerprint: null,
        };
      }
    } else if (alertingTargets.length === 0) {
      nextState = {
        ...nextState,
        lastAlertFingerprint: null,
      };
    }

    await persistMonitoringState(nextState);
    return {
      configured: nextState.configured,
      schedulerEnabled: nextState.schedulerEnabled,
      intervalMinutes: nextState.intervalMinutes,
      timeoutMs: nextState.timeoutMs,
      alertWebhookConfigured: nextState.alertWebhookConfigured,
      lastRunAt: nextState.lastRunAt,
      lastSuccessfulRunAt: nextState.lastSuccessfulRunAt,
      lastAlertAt: nextState.lastAlertAt,
      overallOk: nextState.overallOk,
      healthyTargetCount: nextState.healthyTargetCount,
      failingTargetCount: nextState.failingTargetCount,
      targets: nextState.targets,
    } satisfies RuntimeMonitoringStatus;
  })();

  healthSweepInFlight = request;

  try {
    return await request;
  } finally {
    if (healthSweepInFlight === request) {
      healthSweepInFlight = null;
    }
  }
}

export function startRuntimeHealthMonitorScheduler() {
  if (schedulerStarted) {
    return;
  }

  schedulerStarted = true;

  if (!serverConfig.opsHealthcheckEnabled || !hasConfiguredTargets()) {
    return;
  }

  const intervalMs = Math.max(serverConfig.opsHealthcheckIntervalMinutes, 1) * 60_000;

  void runRuntimeHealthSweep({ reason: 'startup' }).catch(() => undefined);

  schedulerHandle = setInterval(() => {
    void runRuntimeHealthSweep({ reason: 'scheduled' }).catch(() => undefined);
  }, intervalMs);
}

export function stopRuntimeHealthMonitorScheduler() {
  if (schedulerHandle) {
    clearInterval(schedulerHandle);
    schedulerHandle = null;
  }

  schedulerStarted = false;
}
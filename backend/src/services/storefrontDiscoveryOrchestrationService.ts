import { StorefrontRecord } from '../../../src/types/storefrontRecord';
import { getBackendFirebaseDb } from '../firebase';
import {
  StorefrontDetailDocument,
  StorefrontSummaryDocument,
} from '../../../src/types/firestoreDocuments';
import { backendStorefrontSource, backendStorefrontSourceStatus } from '../sources';
import { clearStorefrontBackendCache } from './storefrontCacheService';
import {
  buildDiscoveryCandidateDocument,
  buildPublishedStorefrontDetailDocument,
  buildPublishedStorefrontSummaryDocument,
  resolveDiscoveryGoogleData,
} from './storefrontDiscoveryEnrichmentService';
import {
  clearStorefrontDiscoveryRepositoryState,
  getLatestStorefrontDiscoveryRun,
  getStorefrontDiscoveryCandidate,
  listStorefrontDiscoveryCandidates,
  listStorefrontDiscoveryRuns,
  loadStorefrontDiscoveryState,
  saveStorefrontDiscoveryCandidate,
  saveStorefrontDiscoveryRun,
  saveStorefrontDiscoveryState,
  stripUndefinedDeep,
} from './storefrontDiscoveryRepository';
import {
  StorefrontDiscoveryCandidateDocument,
  StorefrontDiscoveryRunDocument,
  StorefrontDiscoveryRunReason,
  StorefrontDiscoveryRunStatus,
  StorefrontDiscoveryStateDocument,
  StorefrontDiscoveryStatusDocument,
} from './storefrontDiscoveryModels';
import {
  clearStorefrontDiscoverySourceCacheForTests,
  getStorefrontDiscoverySourceCount,
  listStorefrontDiscoverySources,
} from './storefrontDiscoverySourceService';
import { clearBackendStorefrontSourceCaches, warmBackendStorefrontSource } from '../sources';

const STOREFRONT_SUMMARIES_COLLECTION = 'storefront_summaries';
const STOREFRONT_DETAILS_COLLECTION = 'storefront_details';
export const STOREFRONT_DISCOVERY_INTERVAL_HOURS = 24 * 14;
const STOREFRONT_DISCOVERY_INTERVAL_MS = STOREFRONT_DISCOVERY_INTERVAL_HOURS * 60 * 60 * 1000;
const DISCOVERY_TIMER_SAFETY_MS = 5_000;
const DISCOVERY_FAILURE_RETRY_MS = 60 * 60 * 1000;

let discoverySweepInFlight: Promise<StorefrontDiscoverySweepResult> | null = null;
let discoverySchedulerStarted = false;
let discoverySchedulerHandle: ReturnType<typeof setTimeout> | null = null;

type DiscoveryPersistenceDocRef = unknown;

type DiscoveryPersistenceBatch = {
  set(
    reference: DiscoveryPersistenceDocRef,
    value: Record<string, unknown>,
  ): DiscoveryPersistenceBatch;
  commit(): Promise<unknown>;
};

type DiscoveryPersistenceDb = {
  collection(name: string): {
    doc(id: string): DiscoveryPersistenceDocRef;
  };
  batch(): DiscoveryPersistenceBatch;
};

function createNowIso() {
  return new Date().toISOString();
}

function createDiscoveryRunId(nowIso: string) {
  return `discovery-${nowIso.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)}`;
}

function parseIsoOrNull(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildEmptyDiscoveryState(): StorefrontDiscoveryStateDocument {
  return {
    lastRunId: null,
    lastRunAt: null,
    lastSuccessfulRunAt: null,
    nextRunAt: null,
    lastRunReason: null,
    lastRunStatus: null,
    lastError: null,
    totalSourceCount: 0,
    candidateCount: 0,
    hiddenCount: 0,
    readyForPublishCount: 0,
    publishedCount: 0,
    suppressedCount: 0,
    lastRunLimit: null,
    lastRunMarketId: null,
  };
}

function isProductionLikeEnvironment() {
  return Boolean(
    process.env.K_SERVICE ||
    process.env.CLOUD_RUN_JOB ||
    process.env.STOREFRONT_DISCOVERY_SCHEDULER_ENABLED === 'true' ||
    process.env.NODE_ENV === 'production',
  );
}

function isDiscoverySchedulerEnabled() {
  return isProductionLikeEnvironment();
}

export function calculateNextStorefrontDiscoveryRunAt(fromIso: string | null, now = new Date()) {
  const startAt = fromIso ? new Date(fromIso) : now;
  return new Date(startAt.getTime() + STOREFRONT_DISCOVERY_INTERVAL_MS).toISOString();
}

export function calculateFailedStorefrontDiscoveryRetryAt(
  fromIso: string | null,
  now = new Date(),
) {
  const startAt = fromIso ? new Date(fromIso) : now;
  return new Date(startAt.getTime() + DISCOVERY_FAILURE_RETRY_MS).toISOString();
}

export function isStorefrontDiscoverySweepDue(
  state: Pick<StorefrontDiscoveryStateDocument, 'lastSuccessfulRunAt' | 'nextRunAt'>,
  now = Date.now(),
) {
  const nextRunAtMs = parseIsoOrNull(state.nextRunAt);
  if (nextRunAtMs === null) {
    return !state.lastSuccessfulRunAt;
  }

  return now >= nextRunAtMs;
}

function countCandidateStatuses(candidates: StorefrontDiscoveryCandidateDocument[]) {
  return candidates.reduce(
    (counts, candidate) => {
      if (candidate.publicationStatus === 'hidden') {
        counts.hiddenCount += 1;
      } else if (candidate.publicationStatus === 'ready_for_publish') {
        counts.readyForPublishCount += 1;
      } else if (candidate.publicationStatus === 'published') {
        counts.publishedCount += 1;
      } else {
        counts.suppressedCount += 1;
      }

      return counts;
    },
    {
      hiddenCount: 0,
      readyForPublishCount: 0,
      publishedCount: 0,
      suppressedCount: 0,
    },
  );
}

async function persistPublishedStorefrontDocuments(
  storefrontId: string,
  summary: StorefrontSummaryDocument,
  detail: StorefrontDetailDocument,
  publishedAt: string,
  options?: {
    refreshCaches?: boolean;
    dbOverride?: DiscoveryPersistenceDb | null;
  },
) {
  const db = (options?.dbOverride ?? getBackendFirebaseDb()) as DiscoveryPersistenceDb | null;
  if (!db) {
    return;
  }

  const summaryRef = db.collection(STOREFRONT_SUMMARIES_COLLECTION).doc(storefrontId);
  const detailRef = db.collection(STOREFRONT_DETAILS_COLLECTION).doc(storefrontId);
  const batch = db.batch();
  batch.set(summaryRef, {
    ...stripUndefinedDeep(summary),
    ingestSource: 'registry',
    publishedAt,
  });
  batch.set(detailRef, {
    ...stripUndefinedDeep(detail),
    ingestSource: 'registry',
    publishedAt,
  });
  await batch.commit();

  if (options?.refreshCaches === false) {
    return;
  }

  clearStorefrontBackendCache();
  clearBackendStorefrontSourceCaches();
  await warmBackendStorefrontSource();
}

function buildRunDocument(input: {
  id: string;
  reason: StorefrontDiscoveryRunReason;
  status: StorefrontDiscoveryRunStatus;
  startedAt: string;
  finishedAt: string | null;
  sourceCount: number;
  candidateCount: number;
  hiddenCount: number;
  readyForPublishCount: number;
  publishedCount: number;
  suppressedCount: number;
  failedCount: number;
  limit: number | null;
  marketId: string | null;
  lastError: string | null;
}): StorefrontDiscoveryRunDocument {
  return { ...input };
}

function buildDiscoveryStateFromRun(input: {
  runId: string;
  startedAt: string;
  finishedAt: string | null;
  reason: StorefrontDiscoveryRunReason;
  status: StorefrontDiscoveryRunStatus;
  lastError: string | null;
  sourceCount: number;
  candidateCount: number;
  hiddenCount: number;
  readyForPublishCount: number;
  publishedCount: number;
  suppressedCount: number;
  limit: number | null;
  marketId: string | null;
}): StorefrontDiscoveryStateDocument {
  const completedAt = input.finishedAt ?? input.startedAt;
  return {
    lastRunId: input.runId,
    lastRunAt: input.startedAt,
    lastSuccessfulRunAt: input.status === 'completed' ? completedAt : null,
    nextRunAt:
      input.status === 'completed'
        ? calculateNextStorefrontDiscoveryRunAt(completedAt)
        : calculateNextStorefrontDiscoveryRunAt(input.startedAt),
    lastRunReason: input.reason,
    lastRunStatus: input.status,
    lastError: input.lastError,
    totalSourceCount: input.sourceCount,
    candidateCount: input.candidateCount,
    hiddenCount: input.hiddenCount,
    readyForPublishCount: input.readyForPublishCount,
    publishedCount: input.publishedCount,
    suppressedCount: input.suppressedCount,
    lastRunLimit: input.limit,
    lastRunMarketId: input.marketId,
  };
}

export async function runStorefrontDiscoverySweep(input: {
  reason: StorefrontDiscoveryRunReason;
  limit?: number | null;
  marketId?: string | null;
}): Promise<StorefrontDiscoverySweepResult> {
  if (discoverySweepInFlight) {
    return discoverySweepInFlight;
  }

  const task = (async () => {
    const startedAt = createNowIso();
    const runId = createDiscoveryRunId(startedAt);
    const previousState = await loadStorefrontDiscoveryState();
    let sourceRecords: StorefrontRecord[];
    let publicStorefrontIds: Set<string>;

    try {
      sourceRecords = await listStorefrontDiscoverySources({
        limit: input.limit ?? null,
        marketId: input.marketId ?? null,
      });
      publicStorefrontIds = new Set(
        (await backendStorefrontSource.getAllSummaries()).map((summary) => summary.id),
      );
    } catch (error) {
      const finishedAt = createNowIso();
      const message =
        error instanceof Error ? error.message : 'Unknown storefront discovery source failure';
      const failedRun = buildRunDocument({
        id: runId,
        reason: input.reason,
        status: 'failed',
        startedAt,
        finishedAt,
        sourceCount: 0,
        candidateCount: 0,
        hiddenCount: 0,
        readyForPublishCount: 0,
        publishedCount: 0,
        suppressedCount: 0,
        failedCount: 1,
        limit: typeof input.limit === 'number' ? Math.max(0, Math.floor(input.limit)) : null,
        marketId: input.marketId ?? null,
        lastError: message,
      });
      await saveStorefrontDiscoveryRun(failedRun);
      await saveStorefrontDiscoveryState({
        ...previousState,
        lastRunId: runId,
        lastRunAt: startedAt,
        nextRunAt: calculateFailedStorefrontDiscoveryRetryAt(finishedAt),
        lastRunReason: input.reason,
        lastRunStatus: 'failed',
        lastError: message,
        totalSourceCount: 0,
        candidateCount: 0,
        hiddenCount: 0,
        readyForPublishCount: 0,
        publishedCount: 0,
        suppressedCount: 0,
        lastRunLimit: failedRun.limit,
        lastRunMarketId: failedRun.marketId,
      });
      throw error;
    }

    const runBase = buildRunDocument({
      id: runId,
      reason: input.reason,
      status: 'running',
      startedAt,
      finishedAt: null,
      sourceCount: sourceRecords.length,
      candidateCount: 0,
      hiddenCount: 0,
      readyForPublishCount: 0,
      publishedCount: 0,
      suppressedCount: 0,
      failedCount: 0,
      limit: typeof input.limit === 'number' ? Math.max(0, Math.floor(input.limit)) : null,
      marketId: input.marketId ?? null,
      lastError: null,
    });

    await saveStorefrontDiscoveryRun(runBase);

    const nextCandidates: StorefrontDiscoveryCandidateDocument[] = [];
    let failedCount = 0;
    let refreshedPublishedDocuments = false;

    try {
      for (const source of sourceRecords) {
        try {
          const existing = await getStorefrontDiscoveryCandidate(source.id);
          const discoveryGoogleData = await resolveDiscoveryGoogleData(source);
          const stagedCandidate = buildDiscoveryCandidateDocument(source, {
            googlePlaceId: discoveryGoogleData.googlePlaceId,
            googleEnrichment: discoveryGoogleData.googleEnrichment,
            existing,
            nowIso: startedAt,
          });
          const alreadyPublic = publicStorefrontIds.has(source.id);
          let nextCandidate = stagedCandidate;

          if (alreadyPublic && stagedCandidate.publicationStatus !== 'suppressed') {
            const publishedSummary: StorefrontSummaryDocument =
              buildPublishedStorefrontSummaryDocument(
                source,
                stagedCandidate.googlePlaceId,
                stagedCandidate.googleEnrichment,
              );
            const publishedDetail: StorefrontDetailDocument =
              buildPublishedStorefrontDetailDocument(source, stagedCandidate.googleEnrichment);
            await persistPublishedStorefrontDocuments(
              source.id,
              publishedSummary,
              publishedDetail,
              startedAt,
              {
                refreshCaches: false,
              },
            );
            refreshedPublishedDocuments = true;
            nextCandidate = {
              ...stagedCandidate,
              publicationStatus: 'published',
              publicationReason:
                existing?.publicationStatus === 'published'
                  ? stagedCandidate.publicationReason
                  : 'Source storefront is already present in the public feed.',
              publishedAt: existing?.publishedAt ?? startedAt,
              publishedSummaryId: existing?.publishedSummaryId ?? source.id,
              publishedDetailId: existing?.publishedDetailId ?? source.id,
              updatedAt: startedAt,
              lastCheckedAt: startedAt,
            };
          }

          nextCandidates.push(nextCandidate);
          await saveStorefrontDiscoveryCandidate(nextCandidate);
        } catch (error) {
          failedCount += 1;
          const existing = await getStorefrontDiscoveryCandidate(source.id);
          const candidate = buildDiscoveryCandidateDocument(source, {
            googlePlaceId: existing?.googlePlaceId ?? null,
            googleEnrichment: existing?.googleEnrichment ?? null,
            existing,
            nowIso: startedAt,
          });
          const nextCandidate: StorefrontDiscoveryCandidateDocument = {
            ...candidate,
            publicationStatus:
              existing?.publicationStatus === 'published' ? 'published' : 'suppressed',
            publicationReason:
              existing?.publicationReason ??
              (error instanceof Error ? error.message : 'Discovery source evaluation failed.'),
            updatedAt: startedAt,
            lastCheckedAt: startedAt,
          };
          nextCandidates.push(nextCandidate);
          await saveStorefrontDiscoveryCandidate(nextCandidate);
        }
      }

      if (refreshedPublishedDocuments) {
        clearStorefrontBackendCache();
        clearBackendStorefrontSourceCaches();
        await warmBackendStorefrontSource();
      }

      const totals = countCandidateStatuses(nextCandidates);
      const finishedAt = createNowIso();
      const completedRun = buildRunDocument({
        ...runBase,
        status: 'completed',
        finishedAt,
        candidateCount: nextCandidates.length,
        hiddenCount: totals.hiddenCount,
        readyForPublishCount: totals.readyForPublishCount,
        publishedCount: totals.publishedCount,
        suppressedCount: totals.suppressedCount,
        failedCount,
      });

      await saveStorefrontDiscoveryRun(completedRun);
      await saveStorefrontDiscoveryState(
        buildDiscoveryStateFromRun({
          runId,
          startedAt,
          finishedAt,
          reason: input.reason,
          status: 'completed',
          lastError: null,
          sourceCount: sourceRecords.length,
          candidateCount: nextCandidates.length,
          hiddenCount: totals.hiddenCount,
          readyForPublishCount: totals.readyForPublishCount,
          publishedCount: totals.publishedCount,
          suppressedCount: totals.suppressedCount,
          limit: completedRun.limit,
          marketId: completedRun.marketId,
        }),
      );

      return {
        ok: true as const,
        run: completedRun,
        sourceCount: sourceRecords.length,
        candidateCount: nextCandidates.length,
        hiddenCount: totals.hiddenCount,
        readyForPublishCount: totals.readyForPublishCount,
        publishedCount: totals.publishedCount,
        suppressedCount: totals.suppressedCount,
        failedCount,
        candidates: nextCandidates,
      };
    } catch (error) {
      const finishedAt = createNowIso();
      const message = error instanceof Error ? error.message : 'Unknown discovery sweep failure';
      const failedTotals = countCandidateStatuses(nextCandidates);
      const failedRun = buildRunDocument({
        ...runBase,
        status: 'failed',
        finishedAt,
        candidateCount: nextCandidates.length,
        hiddenCount: failedTotals.hiddenCount,
        readyForPublishCount: failedTotals.readyForPublishCount,
        publishedCount: failedTotals.publishedCount,
        suppressedCount: failedTotals.suppressedCount,
        failedCount: failedCount + 1,
        lastError: message,
      });
      await saveStorefrontDiscoveryRun(failedRun);
      await saveStorefrontDiscoveryState({
        ...previousState,
        lastRunId: runId,
        lastRunAt: startedAt,
        nextRunAt: calculateFailedStorefrontDiscoveryRetryAt(finishedAt ?? startedAt),
        lastRunReason: input.reason,
        lastRunStatus: 'failed',
        lastError: message,
        totalSourceCount: sourceRecords.length,
        candidateCount: nextCandidates.length,
        hiddenCount: failedTotals.hiddenCount,
        readyForPublishCount: failedTotals.readyForPublishCount,
        publishedCount: failedTotals.publishedCount,
        suppressedCount: failedTotals.suppressedCount,
        lastRunLimit: runBase.limit,
        lastRunMarketId: runBase.marketId,
      });
      throw error;
    }
  })();

  discoverySweepInFlight = task;

  try {
    return await task;
  } finally {
    if (discoverySweepInFlight === task) {
      discoverySweepInFlight = null;
    }
  }
}

export async function publishStorefrontDiscoveryCandidate(candidateId: string) {
  const candidate = await getStorefrontDiscoveryCandidate(candidateId);
  if (!candidate) {
    throw new Error(`Discovery candidate not found: ${candidateId}`);
  }

  if (candidate.publicationStatus === 'suppressed') {
    throw new Error(`Discovery candidate is suppressed and cannot be published: ${candidateId}`);
  }

  if (
    candidate.publicationStatus !== 'ready_for_publish' &&
    candidate.publicationStatus !== 'published'
  ) {
    throw new Error(`Discovery candidate is not ready for publish yet: ${candidateId}`);
  }

  const source = candidate.source;
  const publishedSummary: StorefrontSummaryDocument = buildPublishedStorefrontSummaryDocument(
    source,
    candidate.googlePlaceId,
    candidate.googleEnrichment,
  );
  const publishedDetail: StorefrontDetailDocument = buildPublishedStorefrontDetailDocument(
    source,
    candidate.googleEnrichment,
  );

  await persistPublishedStorefrontDocuments(
    candidate.id,
    publishedSummary,
    publishedDetail,
    createNowIso(),
  );

  const nowIso = createNowIso();
  const nextCandidate: StorefrontDiscoveryCandidateDocument = {
    ...candidate,
    publicationStatus: 'published',
    publicationReason: 'Published manually from the discovery staging queue.',
    publishedAt: candidate.publishedAt ?? nowIso,
    publishedSummaryId: candidate.publishedSummaryId ?? candidate.id,
    publishedDetailId: candidate.publishedDetailId ?? candidate.id,
    updatedAt: nowIso,
    lastCheckedAt: nowIso,
  };
  await saveStorefrontDiscoveryCandidate(nextCandidate);

  const latestRun = await getLatestStorefrontDiscoveryRun();
  const currentState = await loadStorefrontDiscoveryState();
  const allCandidates = await listStorefrontDiscoveryCandidates(5000);
  const totals = countCandidateStatuses(allCandidates);
  await saveStorefrontDiscoveryState({
    ...currentState,
    hiddenCount: totals.hiddenCount,
    readyForPublishCount: totals.readyForPublishCount,
    publishedCount: totals.publishedCount,
    suppressedCount: totals.suppressedCount,
    candidateCount: allCandidates.length,
    totalSourceCount: currentState.totalSourceCount || (await getStorefrontDiscoverySourceCount()),
    lastRunId: currentState.lastRunId ?? latestRun?.id ?? null,
  });

  return {
    ok: true as const,
    candidate: nextCandidate,
    summary: publishedSummary,
    detail: publishedDetail,
  };
}

export async function getStorefrontDiscoveryStatus(): Promise<StorefrontDiscoveryStatusDocument> {
  const state = await loadStorefrontDiscoveryState();
  const latestRun = await getLatestStorefrontDiscoveryRun();
  const sourceCount = await getStorefrontDiscoverySourceCount();

  return {
    configured: sourceCount > 0,
    schedulerEnabled: isDiscoverySchedulerEnabled(),
    intervalHours: STOREFRONT_DISCOVERY_INTERVAL_HOURS,
    nextRunAt:
      state.nextRunAt ??
      (state.lastSuccessfulRunAt || state.lastRunAt
        ? calculateNextStorefrontDiscoveryRunAt(state.lastSuccessfulRunAt ?? state.lastRunAt)
        : null),
    latestRun,
    state,
  };
}

export async function getStorefrontDiscoveryCandidates(limit = 25) {
  return listStorefrontDiscoveryCandidates(limit);
}

export async function getStorefrontDiscoveryRuns(limit = 10) {
  return listStorefrontDiscoveryRuns(limit);
}

export function shouldRunStorefrontDiscoveryScheduler(state: StorefrontDiscoveryStateDocument) {
  if (!isDiscoverySchedulerEnabled()) {
    return false;
  }

  return isStorefrontDiscoverySweepDue(state, Date.now());
}

function normalizeSchedulerDelay(nextRunAt: string | null) {
  if (!nextRunAt) {
    return DISCOVERY_TIMER_SAFETY_MS;
  }

  const nextRunAtMs = Date.parse(nextRunAt);
  if (!Number.isFinite(nextRunAtMs)) {
    return DISCOVERY_TIMER_SAFETY_MS;
  }

  return Math.max(DISCOVERY_TIMER_SAFETY_MS, nextRunAtMs - Date.now());
}

async function scheduleNextStorefrontDiscoverySweep() {
  if (!discoverySchedulerStarted || !isDiscoverySchedulerEnabled()) {
    return;
  }

  if (discoverySchedulerHandle) {
    clearTimeout(discoverySchedulerHandle);
    discoverySchedulerHandle = null;
  }

  const state = await loadStorefrontDiscoveryState();
  if (!shouldRunStorefrontDiscoveryScheduler(state) && state.nextRunAt) {
    discoverySchedulerHandle = setTimeout(async () => {
      discoverySchedulerHandle = null;
      try {
        await runStorefrontDiscoverySweep({ reason: 'scheduled' });
      } catch {
        // Scheduler errors are surfaced in persisted state and run history.
      } finally {
        void scheduleNextStorefrontDiscoverySweep();
      }
    }, normalizeSchedulerDelay(state.nextRunAt));
    return;
  }

  discoverySchedulerHandle = setTimeout(async () => {
    discoverySchedulerHandle = null;
    try {
      await runStorefrontDiscoverySweep({ reason: 'scheduled' });
    } catch {
      // Scheduler errors are surfaced in persisted state and run history.
    } finally {
      void scheduleNextStorefrontDiscoverySweep();
    }
  }, DISCOVERY_TIMER_SAFETY_MS);
}

async function recoverStaleDiscoveryRun() {
  try {
    const latestRun = await getLatestStorefrontDiscoveryRun();
    if (!latestRun || latestRun.status !== 'running') {
      return;
    }

    const staleThresholdMs = 60 * 60 * 1000;
    const startedAtMs = Date.parse(latestRun.startedAt);
    if (!Number.isFinite(startedAtMs) || Date.now() - startedAtMs < staleThresholdMs) {
      return;
    }

    const finishedAt = createNowIso();
    const recoveredRun = buildRunDocument({
      ...latestRun,
      status: 'failed',
      finishedAt,
      lastError:
        'Run was still in progress when the backend restarted. Marked as failed by startup recovery.',
    });
    await saveStorefrontDiscoveryRun(recoveredRun);
  } catch {
    // Startup recovery should never block the scheduler from starting.
  }
}

export async function startStorefrontDiscoveryScheduler() {
  if (discoverySchedulerStarted || !isDiscoverySchedulerEnabled()) {
    return getStorefrontDiscoveryStatus();
  }

  discoverySchedulerStarted = true;
  await recoverStaleDiscoveryRun();
  const state = await loadStorefrontDiscoveryState();

  if (shouldRunStorefrontDiscoveryScheduler(state)) {
    void runStorefrontDiscoverySweep({ reason: 'scheduled' }).finally(() => {
      void scheduleNextStorefrontDiscoverySweep();
    });
  } else {
    void scheduleNextStorefrontDiscoverySweep();
  }

  return getStorefrontDiscoveryStatus();
}

export function stopStorefrontDiscoveryScheduler() {
  discoverySchedulerStarted = false;
  if (discoverySchedulerHandle) {
    clearTimeout(discoverySchedulerHandle);
    discoverySchedulerHandle = null;
  }
}

export function getStorefrontDiscoverySchedulerStarted() {
  return discoverySchedulerStarted;
}

export type StorefrontDiscoverySweepResult = {
  ok: true;
  run: StorefrontDiscoveryRunDocument;
  sourceCount: number;
  candidateCount: number;
  hiddenCount: number;
  readyForPublishCount: number;
  publishedCount: number;
  suppressedCount: number;
  failedCount: number;
  candidates: StorefrontDiscoveryCandidateDocument[];
};

export {
  buildDiscoveryCandidateDocument,
  buildPublishedStorefrontDetailDocument,
  buildPublishedStorefrontSummaryDocument,
  resolveDiscoveryGoogleData,
  clearStorefrontDiscoveryRepositoryState,
  clearStorefrontDiscoverySourceCacheForTests,
  persistPublishedStorefrontDocuments as persistPublishedStorefrontDocumentsForTests,
};

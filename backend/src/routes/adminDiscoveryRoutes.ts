import { Router } from 'express';
import { disableRequestTimeout } from '../http/requestTimeout';
import {
  forceSyncSeedToFirestore,
  getStorefrontDiscoveryCandidates,
  getStorefrontDiscoveryRunById,
  getStorefrontDiscoveryRuns,
  getStorefrontDiscoveryStatus,
  publishStorefrontDiscoveryCandidate,
  refreshPublishedStorefrontWebsiteHours,
  runStorefrontDiscoverySweep,
  startStorefrontDiscoverySweepAsync,
} from '../services/storefrontDiscoveryOrchestrationService';

function parseOptionalLimit(value: unknown, fallback: number) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, 100);
}

function parseOptionalMarketId(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function parseOptionalIds(value: unknown) {
  if (typeof value !== 'string') {
    return [];
  }

  return value
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .slice(0, 200);
}

export const adminDiscoveryRoutes = Router();

adminDiscoveryRoutes.get('/status', async (_request, response) => {
  try {
    response.json({
      ok: true,
      ...(await getStorefrontDiscoveryStatus()),
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown discovery status failure',
    });
  }
});

adminDiscoveryRoutes.get('/candidates', async (request, response) => {
  try {
    response.json({
      ok: true,
      items: await getStorefrontDiscoveryCandidates(parseOptionalLimit(request.query.limit, 25)),
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown discovery candidate failure',
    });
  }
});

adminDiscoveryRoutes.get('/runs', async (request, response) => {
  try {
    response.json({
      ok: true,
      items: await getStorefrontDiscoveryRuns(parseOptionalLimit(request.query.limit, 10)),
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown discovery run failure',
    });
  }
});

adminDiscoveryRoutes.get('/runs/:runId', async (request, response) => {
  try {
    const run = await getStorefrontDiscoveryRunById(request.params.runId);
    if (!run) {
      response.status(404).json({ ok: false, error: 'Run not found' });
      return;
    }
    response.json({ ok: true, run });
  } catch (error) {
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown discovery run failure',
    });
  }
});

/**
 * POST /sweep — fires the sweep in the background and returns 202 immediately.
 * Poll GET /status or GET /runs for progress.
 *
 * Pass ?mode=sync to wait for the full result (legacy behavior).
 */
adminDiscoveryRoutes.post('/sweep', disableRequestTimeout(), async (request, response) => {
  const mode = typeof request.query.mode === 'string' ? request.query.mode : 'async';

  if (mode === 'sync') {
    // Legacy synchronous path — waits for the entire sweep to finish.
    // The disableRequestTimeout() middleware above already cleared the 30s timer.
    try {
      response.json(
        await runStorefrontDiscoverySweep({
          reason: 'manual',
          limit: parseOptionalLimit(request.query.limit, 0) || null,
          marketId: parseOptionalMarketId(request.query.marketId),
        }),
      );
    } catch (error) {
      response.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown discovery sweep failure',
      });
    }
    return;
  }

  // Default async path — fire-and-forget.
  try {
    const { alreadyRunning } = startStorefrontDiscoverySweepAsync({
      reason: 'manual',
      limit: parseOptionalLimit(request.query.limit, 0) || null,
      marketId: parseOptionalMarketId(request.query.marketId),
    });

    response.status(202).json({
      ok: true,
      message: alreadyRunning
        ? 'A discovery sweep is already in progress. Poll GET /status for updates.'
        : 'Discovery sweep started. Poll GET /status or GET /runs for progress.',
      alreadyRunning,
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown discovery sweep failure',
    });
  }
});

adminDiscoveryRoutes.post('/candidates/:candidateId/publish', async (request, response) => {
  try {
    response.json(await publishStorefrontDiscoveryCandidate(request.params.candidateId));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown discovery publish failure';
    response.status(message.includes('not found') ? 404 : 409).json({
      ok: false,
      error: message,
    });
  }
});

/**
 * POST /admin/discovery/force-seed-sync
 *
 * Pushes any seed-file storefront records that are missing from Firestore
 * into the storefront_summaries + storefront_details collections. Does NOT
 * overwrite existing docs — owner-edited fields, manual admin updates, or
 * any drift from the seed are preserved.
 *
 * Catches the failure mode where the live discovery sweep silently drops
 * newly-licensed shops because their geocoding fails (the seed already
 * has coordinates baked in, so it bypasses the geocode-or-die path).
 *
 * Query params:
 *   ?dryRun=true — preview which IDs would be added without writing
 *
 * Response shape:
 *   { ok, dryRun, totalSeedRecords, alreadyPresent, added, errored,
 *     addedIds: string[], erroredIds: { id, reason }[] }
 */
adminDiscoveryRoutes.post(
  '/force-seed-sync',
  disableRequestTimeout(),
  async (request, response) => {
    try {
      const dryRun = request.query.dryRun === 'true';
      response.json(await forceSyncSeedToFirestore({ dryRun }));
    } catch (error) {
      response.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown force-seed-sync failure',
      });
    }
  },
);

adminDiscoveryRoutes.post('/published/refresh-hours', async (request, response) => {
  try {
    response.json(
      await refreshPublishedStorefrontWebsiteHours({
        limit: parseOptionalLimit(request.query.limit, 50),
        marketId: parseOptionalMarketId(request.query.marketId),
        storefrontIds: parseOptionalIds(request.query.ids),
      }),
    );
  } catch (error) {
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown storefront hours refresh failure',
    });
  }
});

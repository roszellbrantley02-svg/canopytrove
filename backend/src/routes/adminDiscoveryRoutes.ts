import { Router } from 'express';
import {
  getStorefrontDiscoveryCandidates,
  getStorefrontDiscoveryRuns,
  getStorefrontDiscoveryStatus,
  publishStorefrontDiscoveryCandidate,
  runStorefrontDiscoverySweep,
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

adminDiscoveryRoutes.post('/sweep', async (request, response) => {
  try {
    response.json(
      await runStorefrontDiscoverySweep({
        reason: 'manual',
        limit: parseOptionalLimit(request.query.limit, 0) || null,
        marketId: parseOptionalMarketId(request.query.marketId),
      })
    );
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

import { Router } from 'express';
import { serverConfig } from '../config';
import { createRateLimitMiddleware } from '../http/rateLimit';
import { ensureAdminRuntimeAccess, ensureAdminRuntimeAccessConfigured } from '../http/adminAccess';
import { parseRuntimeAlertSyncBody, parseRuntimePolicyBody } from '../http/validation';
import {
  evaluateRuntimePolicy,
  getRuntimeOpsStatus,
  saveRuntimePolicy,
} from '../services/runtimeOpsService';
import {
  getAdminRuntimeAlertSubscriptionStatus,
  syncAdminRuntimeAlertSubscription,
} from '../services/opsAlertSubscriptionService';
import {
  getStorefrontReadinessStatus,
  getRuntimeMonitoringStatus,
  runRuntimeHealthSweep,
} from '../services/healthMonitorService';

export const opsRoutes = Router();
opsRoutes.use(
  '/admin/runtime',
  createRateLimitMiddleware({
    name: 'admin',
    windowMs: 10 * 60_000,
    max: serverConfig.adminRateLimitPerTenMinutes,
  }),
);
opsRoutes.use('/admin/runtime', ensureAdminRuntimeAccessConfigured);
opsRoutes.use('/admin/runtime', ensureAdminRuntimeAccess);

opsRoutes.get('/admin/runtime/status', async (_request, response) => {
  try {
    response.json(await getRuntimeOpsStatus(20));
  } catch (error) {
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown runtime status failure',
    });
  }
});

opsRoutes.put('/admin/runtime/policy', async (request, response) => {
  try {
    response.json(await saveRuntimePolicy(parseRuntimePolicyBody(request.body)));
  } catch (error) {
    response.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown runtime policy failure',
    });
  }
});

opsRoutes.post('/admin/runtime/policy/evaluate', async (_request, response) => {
  try {
    const policy = await evaluateRuntimePolicy();
    response.json({
      ok: true,
      policy,
      status: await getRuntimeOpsStatus(20),
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown runtime evaluation failure',
    });
  }
});

opsRoutes.get('/admin/runtime/monitoring', async (_request, response) => {
  try {
    response.json(await getRuntimeMonitoringStatus());
  } catch (error) {
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown runtime monitoring failure',
    });
  }
});

opsRoutes.get('/admin/runtime/readiness', async (request, response) => {
  try {
    const readiness = await getStorefrontReadinessStatus({
      probeGooglePlaces: request.query.probe !== 'false',
    });
    response.status(readiness.ok ? 200 : 503).json(readiness);
  } catch (error) {
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown storefront readiness failure',
    });
  }
});

opsRoutes.post('/admin/runtime/monitoring/run', async (_request, response) => {
  try {
    response.json(await runRuntimeHealthSweep({ reason: 'manual' }));
  } catch (error) {
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown runtime health sweep failure',
    });
  }
});

opsRoutes.post('/admin/runtime/alerts/status', async (request, response) => {
  try {
    response.json(
      await getAdminRuntimeAlertSubscriptionStatus(parseRuntimeAlertSyncBody(request.body)),
    );
  } catch (error) {
    response.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown runtime alert status failure',
    });
  }
});

opsRoutes.post('/admin/runtime/alerts/sync', async (request, response) => {
  try {
    response.json(await syncAdminRuntimeAlertSubscription(parseRuntimeAlertSyncBody(request.body)));
  } catch (error) {
    response.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown runtime alert sync failure',
    });
  }
});

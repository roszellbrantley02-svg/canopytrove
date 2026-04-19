import { Router } from 'express';
import { parseClientRuntimeErrorBody } from '../http/validation';
import { recordClientRuntimeError } from '../services/clientRuntimeReportingService';
import { getRuntimeOpsStatus } from '../services/runtimeOpsService';
import { createRateLimitMiddleware } from '../http/rateLimit';
import { resolveVerifiedRequestIdentity } from '../services/profileAccessService';

export const clientRuntimeRoutes = Router();

const clientErrorRateLimiter = createRateLimitMiddleware({
  name: 'client-errors',
  windowMs: 60_000,
  max: 10,
  methods: ['POST'],
});

clientRuntimeRoutes.get('/runtime/status', async (_request, response) => {
  const runtimeStatus = await getRuntimeOpsStatus(6);
  response.json({
    policy: runtimeStatus.policy,
    incidentCounts: runtimeStatus.incidentCounts,
    generatedAt: new Date().toISOString(),
  });
});

clientRuntimeRoutes.post('/client-errors', clientErrorRateLimiter, async (request, response) => {
  const identity = await resolveVerifiedRequestIdentity(request, {
    invalidTokenBehavior: 'ignore',
  });
  if (identity.role === null) {
    response.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const payload = parseClientRuntimeErrorBody(request.body);
  await recordClientRuntimeError(payload, request.ip, {
    accountId: identity.accountId,
  });
  response.status(202).json({ accepted: true });
});

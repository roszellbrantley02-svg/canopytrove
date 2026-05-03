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
  // 60/min/IP. The previous 10/min cap was easy to trip during a real
  // bug burst (a buggy screen rendering 11 errors in one minute would
  // accumulate enough abuse points to globally flag the IP for 30 min,
  // then every other POST from that user 429s — including normal
  // /analytics/events and /profile-state writes from the same session).
  // Diagnostic ingestion is more valuable than aggressive throttling
  // here; abuse is bounded by the cap itself.
  max: 60,
  methods: ['POST'],
  // Don't escalate client-error 429s into the global IP-flag scoring.
  // Crash reports are noisy by nature; a user whose app is misbehaving
  // shouldn't be punished by a 30-min global block on every other
  // write endpoint just because their app is firing too many error
  // reports at once.
  abuseSignalPoints: 0,
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
  // Client crash reports are valuable even before a user signs in (crashes on
  // the launch/sign-in screens would otherwise never reach the server).
  // Resolve identity opportunistically so authenticated reports carry an
  // accountId for attribution, but accept anonymous reports too. The IP rate
  // limiter above caps abuse at 10/min/IP.
  const identity = await resolveVerifiedRequestIdentity(request, {
    invalidTokenBehavior: 'ignore',
  });

  const payload = parseClientRuntimeErrorBody(request.body);
  await recordClientRuntimeError(payload, request.ip, {
    accountId: identity.accountId,
  });
  response.status(202).json({ accepted: true });
});

import { Router } from 'express';
import { parseClientRuntimeErrorBody } from '../http/validation';
import { recordClientRuntimeError } from '../services/clientRuntimeReportingService';
import { getRuntimeOpsStatus } from '../services/runtimeOpsService';

export const clientRuntimeRoutes = Router();

clientRuntimeRoutes.get('/runtime/status', async (_request, response) => {
  const runtimeStatus = await getRuntimeOpsStatus(6);
  response.json({
    policy: runtimeStatus.policy,
    incidentCounts: runtimeStatus.incidentCounts,
    generatedAt: new Date().toISOString(),
  });
});

clientRuntimeRoutes.post('/client-errors', async (request, response) => {
  const payload = parseClientRuntimeErrorBody(request.body);
  await recordClientRuntimeError(payload, request.ip);
  response.status(202).json({ ok: true });
});

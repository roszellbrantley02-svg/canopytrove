import { Router } from 'express';
import { parseClientRuntimeErrorBody } from '../http/validation';
import { recordClientRuntimeError } from '../services/clientRuntimeReportingService';

export const clientRuntimeRoutes = Router();

clientRuntimeRoutes.post('/client-errors', (request, response) => {
  const payload = parseClientRuntimeErrorBody(request.body);
  recordClientRuntimeError(payload, request.ip);
  response.status(202).json({ ok: true });
});

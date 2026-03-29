import { Router } from 'express';
import { serverConfig } from '../config';
import { createRateLimitMiddleware } from '../http/rateLimit';
import { parseAnalyticsEventBatchBody } from '../http/validation';
import { recordAnalyticsEvents } from '../services/analyticsEventService';

export const analyticsRoutes = Router();

analyticsRoutes.use(
  createRateLimitMiddleware({
    name: 'write',
    windowMs: 60_000,
    max: serverConfig.writeRateLimitPerMinute,
    methods: ['POST'],
  })
);

analyticsRoutes.post('/analytics/events', async (request, response) => {
  const body = parseAnalyticsEventBatchBody(request.body);
  const result = await recordAnalyticsEvents(body, {
    ipAddress: request.ip ?? null,
    userAgent: request.headers['user-agent'] ?? null,
  });

  response.status(202).json(result);
});
